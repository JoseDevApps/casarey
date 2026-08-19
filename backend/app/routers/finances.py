from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from decimal import Decimal
from typing import Optional

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.property import Property
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.finances import (
    AdminFinanceSummaryResponse,
    MonthlyIncomeSummary,
    GlobalFinanceSummaryResponse,
    GlobalAdminSummary,
)
from app.dependencies import require_role

router = APIRouter()

# Facturado = total - descuento (antes se sumaba total_amount, inflando ingresos)
_FINAL_AMOUNT = Reservation.total_amount - func.coalesce(Reservation.discount_amount, 0)
# Cobrado = anticipo confirmado. NULL (reservas legacy) = se cobró todo.
_COLLECTED = func.coalesce(Reservation.deposit_amount, _FINAL_AMOUNT)
# Por cobrar = saldo que el cliente paga al llegar
_PENDING = _FINAL_AMOUNT - _COLLECTED


@router.get("/summary", response_model=AdminFinanceSummaryResponse)
async def admin_finance_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Monthly income grouped by property for the current admin's properties."""
    year_expr = func.extract("year", func.to_date(Reservation.check_in_date, "YYYY-MM-DD"))
    month_expr = func.extract("month", func.to_date(Reservation.check_in_date, "YYYY-MM-DD"))

    base_filters = [
        Reservation.status == ReservationStatus.CONFIRMED,
        Property.owner_id == current_user.id,
    ]
    if year:
        base_filters.append(year_expr == year)

    stmt = (
        select(
            year_expr.label("year"),
            month_expr.label("month"),
            Property.id.label("property_id"),
            Property.name.label("property_name"),
            func.sum(_FINAL_AMOUNT).label("total_income"),
            func.sum(_COLLECTED).label("collected_income"),
            func.sum(_PENDING).label("pending_income"),
            func.count(Reservation.id).label("confirmed_reservations"),
        )
        .join(Property, Property.id == Reservation.property_id)
        .where(and_(*base_filters))
        .group_by(
            year_expr,
            month_expr,
            Property.id,
            Property.name,
        )
        .order_by(year_expr.desc(), month_expr.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    items = [
        MonthlyIncomeSummary(
            year=int(row.year),
            month=int(row.month),
            property_id=row.property_id,
            property_name=row.property_name,
            total_income=Decimal(str(row.total_income or 0)),
            collected_income=Decimal(str(row.collected_income or 0)),
            pending_income=Decimal(str(row.pending_income or 0)),
            confirmed_reservations=row.confirmed_reservations,
        )
        for row in rows
    ]
    total_income = sum((i.total_income for i in items), Decimal("0"))
    collected_income = sum((i.collected_income for i in items), Decimal("0"))
    pending_income = sum((i.pending_income for i in items), Decimal("0"))
    return AdminFinanceSummaryResponse(
        items=items,
        total_income=total_income,
        collected_income=collected_income,
        pending_income=pending_income,
    )


@router.get("/global", response_model=GlobalFinanceSummaryResponse)
async def global_finance_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Global totals aggregated by admin. Super Admin only."""
    year_expr = func.extract("year", func.to_date(Reservation.check_in_date, "YYYY-MM-DD"))

    base_filters = [Reservation.status == ReservationStatus.CONFIRMED]
    if year:
        base_filters.append(year_expr == year)

    stmt = (
        select(
            User.id.label("admin_id"),
            User.full_name.label("admin_name"),
            func.sum(_FINAL_AMOUNT).label("total_income"),
            func.sum(_COLLECTED).label("collected_income"),
            func.sum(_PENDING).label("pending_income"),
            func.count(Reservation.id).label("confirmed_reservations"),
        )
        .join(Property, Property.owner_id == User.id)
        .join(Reservation, Reservation.property_id == Property.id)
        .where(and_(*base_filters))
        .group_by(User.id, User.full_name)
        .order_by(func.sum(_FINAL_AMOUNT).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    items = [
        GlobalAdminSummary(
            admin_id=row.admin_id,
            admin_name=row.admin_name,
            total_income=Decimal(str(row.total_income or 0)),
            collected_income=Decimal(str(row.collected_income or 0)),
            pending_income=Decimal(str(row.pending_income or 0)),
            confirmed_reservations=row.confirmed_reservations,
        )
        for row in rows
    ]
    grand_total = sum((i.total_income for i in items), Decimal("0"))
    collected_total = sum((i.collected_income for i in items), Decimal("0"))
    pending_total = sum((i.pending_income for i in items), Decimal("0"))
    return GlobalFinanceSummaryResponse(
        items=items,
        grand_total=grand_total,
        collected_total=collected_total,
        pending_total=pending_total,
    )
