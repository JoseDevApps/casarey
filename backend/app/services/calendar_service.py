from datetime import date, timedelta
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.property import PropertyCalendar, CalendarStatus
from app.models.reservation import Reservation, ReservationStatus


def date_range(start: str, end: str) -> List[str]:
    """Returns dates from start (inclusive) to end (exclusive) as YYYY-MM-DD strings."""
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return [(s + timedelta(days=i)).isoformat() for i in range((e - s).days)]


async def check_availability(
    db: AsyncSession,
    property_id: str,
    check_in: str,
    check_out: str,
) -> bool:
    """Returns True if all dates in the range are fully available."""
    dates = date_range(check_in, check_out)
    if not dates:
        return False

    # Check BOOKED/BLOCKED calendar entries
    cal_result = await db.execute(
        select(PropertyCalendar).where(
            and_(
                PropertyCalendar.property_id == property_id,
                PropertyCalendar.date.in_(dates),
            )
        )
    )
    if cal_result.scalars().first():
        return False

    # Check active reservations (soft block — overlapping date ranges)
    active_statuses = [
        ReservationStatus.PENDING_APPROVAL,
        ReservationStatus.APPROVED_WAITING_PAYMENT,
        ReservationStatus.CONFIRMED,
    ]
    res_result = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.property_id == property_id,
                Reservation.status.in_(active_statuses),
                Reservation.check_in_date < check_out,
                Reservation.check_out_date > check_in,
            )
        )
    )
    if res_result.scalars().first():
        return False

    return True


async def block_dates_for_reservation(
    db: AsyncSession,
    property_id: str,
    check_in: str,
    check_out: str,
):
    """Inserts BOOKED entries for the date range. Must be called within an atomic transaction."""
    for d in date_range(check_in, check_out):
        entry = PropertyCalendar(
            property_id=property_id,
            date=d,
            status=CalendarStatus.BOOKED,
        )
        db.add(entry)
