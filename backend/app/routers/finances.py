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
            func.sum(Reservation.total_amount).label("total_income"),
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
            confirmed_reservations=row.confirmed_reservations,
        )
        for row in rows
    ]
    total_income = sum(i.total_income for i in items) if items else Decimal("0")
    return AdminFinanceSummaryResponse(items=items, total_income=total_income)


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
            func.sum(Reservation.total_amount).label("total_income"),
            func.count(Reservation.id).label("confirmed_reservations"),
        )
        .join(Property, Property.owner_id == User.id)
        .join(Reservation, Reservation.property_id == Property.id)
        .where(and_(*base_filters))
        .group_by(User.id, User.full_name)
        .order_by(func.sum(Reservation.total_amount).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    items = [
        GlobalAdminSummary(
            admin_id=row.admin_id,
            admin_name=row.admin_name,
            total_income=Decimal(str(row.total_income or 0)),
            confirmed_reservations=row.confirmed_reservations,
        )
        for row in rows
    ]
    grand_total = sum(i.total_income for i in items) if items else Decimal("0")
    return GlobalFinanceSummaryResponse(items=items, grand_total=grand_total)
