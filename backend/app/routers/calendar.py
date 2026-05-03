from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from uuid import UUID
from calendar import monthrange

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.property import Property, PropertyCalendar, CalendarStatus
from app.schemas.property import (
    CalendarMonthResponse,
    CalendarEntryResponse,
    BlockDatesRequest,
)
from app.dependencies import require_role

router = APIRouter()


@router.get("/{property_id}/calendar", response_model=CalendarMonthResponse)
async def get_calendar(
    property_id: UUID,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    # Verify property exists
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    # Build date strings for the whole month
    _, days_in_month = monthrange(year, month)
    date_strings = [
        f"{year}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)
    ]

    cal_result = await db.execute(
        select(PropertyCalendar).where(
            and_(
                PropertyCalendar.property_id == property_id,
                PropertyCalendar.date.in_(date_strings),
            )
        )
    )
    entries = cal_result.scalars().all()

    response_entries = [
        CalendarEntryResponse(
            date=e.date, status=e.status.value, blocked_reason=e.blocked_reason
        )
        for e in entries
    ]

    return CalendarMonthResponse(
        property_id=property_id,
        year=year,
        month=month,
        entries=response_entries,
    )


@router.post("/{property_id}/calendar/block", status_code=status.HTTP_201_CREATED)
async def block_dates(
    property_id: UUID,
    body: BlockDatesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(prop.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso para esta propiedad", "code": "FORBIDDEN"},
        )

    # Validate date format
    import datetime as dt
    for d in body.dates:
        try:
            dt.date.fromisoformat(d)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"detail": f"Fecha inválida: {d}", "code": "INVALID_DATE"},
            )

    # Check for existing entries on these dates
    existing_result = await db.execute(
        select(PropertyCalendar).where(
            and_(
                PropertyCalendar.property_id == property_id,
                PropertyCalendar.date.in_(body.dates),
            )
        )
    )
    existing = {e.date: e for e in existing_result.scalars().all()}

    created = 0
    for d in body.dates:
        if d in existing:
            continue  # Skip already blocked/booked dates
        entry = PropertyCalendar(
            property_id=property_id,
            date=d,
            status=CalendarStatus.BLOCKED,
            blocked_reason=body.reason,
        )
        db.add(entry)
        created += 1

    await db.commit()
    return {"detail": f"{created} fecha(s) bloqueada(s)", "created": created}


@router.delete("/{property_id}/calendar/{date_str}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_date(
    property_id: UUID,
    date_str: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(prop.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso para esta propiedad", "code": "FORBIDDEN"},
        )

    entry_result = await db.execute(
        select(PropertyCalendar).where(
            and_(
                PropertyCalendar.property_id == property_id,
                PropertyCalendar.date == date_str,
            )
        )
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Fecha no bloqueada", "code": "DATE_NOT_FOUND"},
        )

    if entry.status == CalendarStatus.BOOKED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "No se puede desbloquear una fecha reservada (BOOKED)",
                "code": "CANNOT_UNBLOCK_BOOKED",
            },
        )

    await db.delete(entry)
    await db.commit()
