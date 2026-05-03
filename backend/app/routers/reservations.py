from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.property import Property
from app.models.reservation import Reservation, ReservationStatus, BookingGuest
from app.models.payment import PaymentVoucher
from app.schemas.reservation import (
    ReservationCreate,
    ReservationResponse,
    ReservationListResponse,
    BookingGuestCreate,
    BookingGuestResponse,
    GuestListResponse,
)
from app.schemas.payment import PaymentVoucherResponse
from app.dependencies import get_current_user, require_role
from app.services import reservation_service, payment_service, storage_service

router = APIRouter()


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    body: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    reservation = await reservation_service.create_reservation(
        db=db,
        property_id=str(body.property_id),
        client_id=str(current_user.id),
        check_in=body.check_in_date,
        check_out=body.check_out_date,
        num_adults=body.num_adults,
        num_children=body.num_children,
    )
    return reservation


@router.get("", response_model=ReservationListResponse)
async def list_reservations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[ReservationStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offset = (page - 1) * page_size
    filters = []

    if status_filter:
        filters.append(Reservation.status == status_filter)

    if current_user.role == UserRole.CLIENT:
        filters.append(Reservation.client_id == current_user.id)
    elif current_user.role == UserRole.ADMIN:
        # Admin sees reservations for their properties only
        admin_props = await db.execute(
            select(Property.id).where(Property.owner_id == current_user.id)
        )
        prop_ids = [row[0] for row in admin_props.all()]
        filters.append(Reservation.property_id.in_(prop_ids))
    # SUPER_ADMIN sees all — no extra filter

    where_clause = and_(*filters) if filters else True

    count_result = await db.execute(
        select(func.count()).select_from(Reservation).where(where_clause)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Reservation)
        .where(where_clause)
        .order_by(Reservation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    reservations = result.scalars().all()

    return ReservationListResponse(
        items=list(reservations), total=total, page=page, page_size=page_size
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Reserva no encontrada", "code": "NOT_FOUND"},
        )

    await _assert_can_access_reservation(current_user, reservation, db)
    return reservation


@router.patch("/{reservation_id}/approve", response_model=ReservationResponse)
async def approve_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    reservation = await _get_reservation_for_admin(reservation_id, current_user, db)
    await reservation_service.transition_reservation(
        db, reservation, ReservationStatus.APPROVED_WAITING_PAYMENT
    )
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.patch("/{reservation_id}/reject", response_model=ReservationResponse)
async def reject_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    reservation = await _get_reservation_for_admin(reservation_id, current_user, db)
    await reservation_service.transition_reservation(
        db, reservation, ReservationStatus.REJECTED
    )
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.patch("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Reserva no encontrada", "code": "NOT_FOUND"},
        )

    # Client can cancel their own; admin can cancel for their properties; super admin can cancel any
    if current_user.role == UserRole.CLIENT:
        if str(reservation.client_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
            )
    elif current_user.role == UserRole.ADMIN:
        prop_result = await db.execute(
            select(Property).where(
                Property.id == reservation.property_id, Property.owner_id == current_user.id
            )
        )
        if not prop_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
            )

    await reservation_service.transition_reservation(
        db, reservation, ReservationStatus.CANCELLED
    )
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/voucher", response_model=PaymentVoucherResponse, status_code=status.HTTP_201_CREATED)
async def upload_voucher(
    reservation_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    voucher = await payment_service.upload_payment_voucher(
        db=db,
        reservation_id=str(reservation_id),
        client_id=str(current_user.id),
        file=file,
    )
    await db.commit()
    await db.refresh(voucher)
    url = storage_service.get_presigned_url(
        storage_service.BUCKET_PAYMENT_VOUCHERS, voucher.minio_key
    )
    return PaymentVoucherResponse(
        id=voucher.id,
        reservation_id=voucher.reservation_id,
        minio_key=voucher.minio_key,
        uploaded_at=voucher.uploaded_at,
        url=url,
    )


@router.patch("/{reservation_id}/confirm-payment", response_model=ReservationResponse)
async def confirm_payment(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    reservation = await _get_reservation_for_admin(reservation_id, current_user, db)

    # Verify a voucher has been uploaded
    voucher_result = await db.execute(
        select(PaymentVoucher).where(PaymentVoucher.reservation_id == reservation_id)
    )
    if not voucher_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "El cliente no ha subido comprobante de pago",
                "code": "MISSING_VOUCHER",
            },
        )

    reservation = await reservation_service.confirm_reservation_with_payment(db, reservation)
    return reservation


@router.post("/{reservation_id}/guests", response_model=BookingGuestResponse, status_code=status.HTTP_201_CREATED)
async def add_guest(
    reservation_id: UUID,
    body: BookingGuestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    reservation = await _get_reservation_for_admin(reservation_id, current_user, db)
    if reservation.status != ReservationStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "Solo se pueden agregar huéspedes a reservas CONFIRMED",
                "code": "INVALID_STATUS",
            },
        )

    guest = BookingGuest(
        reservation_id=reservation_id,
        full_name=body.full_name,
        id_number=body.id_number,
        phone=body.phone,
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return guest


@router.get("/{reservation_id}/guests", response_model=GuestListResponse)
async def list_guests(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Reserva no encontrada", "code": "NOT_FOUND"},
        )

    await _assert_can_access_reservation(current_user, reservation, db)

    guests_result = await db.execute(
        select(BookingGuest).where(BookingGuest.reservation_id == reservation_id)
    )
    guests = guests_result.scalars().all()
    return GuestListResponse(items=list(guests), total=len(guests))


# ---- helpers ----

async def _get_reservation_for_admin(
    reservation_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> Reservation:
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Reserva no encontrada", "code": "NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN:
        prop_result = await db.execute(
            select(Property).where(
                Property.id == reservation.property_id,
                Property.owner_id == current_user.id,
            )
        )
        if not prop_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "No tienes permiso para esta reserva", "code": "FORBIDDEN"},
            )
    return reservation


async def _assert_can_access_reservation(
    current_user: User,
    reservation: Reservation,
    db: AsyncSession,
):
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    if current_user.role == UserRole.CLIENT:
        if str(reservation.client_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
            )
        return
    if current_user.role == UserRole.ADMIN:
        prop_result = await db.execute(
            select(Property).where(
                Property.id == reservation.property_id,
                Property.owner_id == current_user.id,
            )
        )
        if not prop_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
            )
