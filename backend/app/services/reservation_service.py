from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from fastapi import HTTPException
from app.models.reservation import Reservation, ReservationStatus
from app.models.property import Property
from app.services.calendar_service import check_availability, block_dates_for_reservation

VALID_TRANSITIONS: dict[ReservationStatus, list[ReservationStatus]] = {
    ReservationStatus.PENDING_APPROVAL: [
        ReservationStatus.APPROVED_WAITING_PAYMENT,
        ReservationStatus.REJECTED,
    ],
    ReservationStatus.APPROVED_WAITING_PAYMENT: [
        ReservationStatus.CONFIRMED,
        ReservationStatus.CANCELLED,
    ],
    ReservationStatus.CONFIRMED: [],
    ReservationStatus.REJECTED: [],
    ReservationStatus.CANCELLED: [],
}


def _resolve_pricing_tier(nights: int) -> int:
    if nights <= 1:
        return 1
    if nights == 2:
        return 2
    return 3


def _resolve_nightly_rate(prop: Property, pricing_tier: int) -> Decimal:
    if pricing_tier == 1:
        return Decimal(str(prop.rate_night_1))
    if pricing_tier == 2:
        return Decimal(str(prop.rate_night_2))
    return Decimal(str(prop.rate_night_3))


async def create_reservation(
    db: AsyncSession,
    property_id: str,
    client_id: str,
    check_in: str,
    check_out: str,
    num_adults: int,
    num_children: int,
) -> Reservation:
    """Caller is responsible for committing the transaction."""
    # Advisory lock — serialize all reservation attempts for this property within this tx
    lock_id = abs(hash(str(property_id))) % (2**31)
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id}
    )

    # Fetch property and snapshot prices
    result = await db.execute(
        select(Property).where(
            Property.id == property_id, Property.is_active == True
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    # Check availability (includes soft-blocked by active reservations)
    available = await check_availability(db, property_id, check_in, check_out)
    if not available:
        raise HTTPException(
            status_code=409,
            detail={"detail": "Fechas no disponibles", "code": "DATES_UNAVAILABLE"},
        )

    # Validate date order
    check_in_date = date.fromisoformat(check_in)
    check_out_date = date.fromisoformat(check_out)
    if check_out_date <= check_in_date:
        raise HTTPException(
            status_code=422,
            detail={"detail": "La fecha de salida debe ser posterior a la de entrada", "code": "INVALID_DATES"},
        )

    # Calculate total with frozen prices
    nights = (check_out_date - check_in_date).days
    pricing_tier = _resolve_pricing_tier(nights)
    nightly_rate = _resolve_nightly_rate(prop, pricing_tier)
    child_rate = Decimal(str(prop.rate_child))
    total = nights * (
        nightly_rate * Decimal(num_adults)
        + child_rate * Decimal(num_children)
    )

    reservation = Reservation(
        property_id=property_id,
        client_id=client_id,
        check_in_date=check_in,
        check_out_date=check_out,
        num_adults=num_adults,
        num_children=num_children,
        snapshot_rate_adult=nightly_rate,
        snapshot_rate_child=child_rate,
        snapshot_nightly_rate=nightly_rate,
        snapshot_pricing_tier=pricing_tier,
        total_amount=total,
    )
    db.add(reservation)
    await db.flush()
    return reservation


async def transition_reservation(
    db: AsyncSession,
    reservation: Reservation,
    new_status: ReservationStatus,
    discount_amount: Decimal = Decimal(0),
) -> Reservation:
    """Validates and applies a state transition. Caller is responsible for committing."""
    allowed = VALID_TRANSITIONS.get(reservation.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": f"Transición de estado inválida: {reservation.status} -> {new_status}",
                "code": "INVALID_TRANSITION",
            },
        )
    reservation.status = new_status

    if new_status == ReservationStatus.APPROVED_WAITING_PAYMENT:
        if discount_amount < 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "El descuento no puede ser negativo",
                    "code": "INVALID_DISCOUNT",
                },
            )
        if discount_amount > reservation.total_amount:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "El descuento no puede exceder el total",
                    "code": "INVALID_DISCOUNT",
                },
            )
        reservation.discount_amount = discount_amount

    return reservation


async def confirm_reservation_with_payment(
    db: AsyncSession,
    reservation: Reservation,
) -> Reservation:
    """Sets status to CONFIRMED and writes BOOKED calendar entries.
    Caller is responsible for committing the transaction."""
    if reservation.status != ReservationStatus.APPROVED_WAITING_PAYMENT:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": "La reserva debe estar en estado APPROVED_WAITING_PAYMENT",
                "code": "INVALID_STATUS",
            },
        )
    reservation.status = ReservationStatus.CONFIRMED
    await block_dates_for_reservation(
        db,
        str(reservation.property_id),
        reservation.check_in_date,
        reservation.check_out_date,
    )
    await db.flush()
    return reservation
