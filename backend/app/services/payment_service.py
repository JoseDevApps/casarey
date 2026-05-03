import uuid
from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.payment import PaymentVoucher, PaymentMethod
from app.models.reservation import Reservation, ReservationStatus
from app.services import storage_service

ALLOWED_VOUCHER_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_VOUCHER_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_METHOD_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


async def upload_payment_voucher(
    db: AsyncSession,
    reservation_id: str,
    client_id: str,
    file: UploadFile,
) -> PaymentVoucher:
    """Uploads a payment voucher for a reservation. Only the reservation's client may upload."""
    result = await db.execute(
        select(Reservation).where(Reservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Reserva no encontrada", "code": "RESERVATION_NOT_FOUND"},
        )
    if str(reservation.client_id) != str(client_id):
        raise HTTPException(
            status_code=403,
            detail={"detail": "No tienes permiso para esta reserva", "code": "FORBIDDEN"},
        )
    if reservation.status != ReservationStatus.APPROVED_WAITING_PAYMENT:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": "La reserva debe estar en estado APPROVED_WAITING_PAYMENT para subir un comprobante",
                "code": "INVALID_STATUS",
            },
        )

    if file.content_type not in ALLOWED_VOUCHER_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Tipo de archivo no permitido", "code": "INVALID_FILE_TYPE"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_VOUCHER_SIZE:
        raise HTTPException(
            status_code=422,
            detail={"detail": "El archivo excede el tamaño máximo permitido (10 MB)", "code": "FILE_TOO_LARGE"},
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    key = f"vouchers/{reservation_id}/{uuid.uuid4()}.{ext}"
    storage_service.upload_file(
        storage_service.BUCKET_PAYMENT_VOUCHERS,
        key,
        file_bytes,
        file.content_type,
    )

    # Replace existing voucher if one exists
    existing_result = await db.execute(
        select(PaymentVoucher).where(PaymentVoucher.reservation_id == reservation_id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        storage_service.delete_file(storage_service.BUCKET_PAYMENT_VOUCHERS, existing.minio_key)
        existing.minio_key = key
        await db.flush()
        return existing

    voucher = PaymentVoucher(reservation_id=reservation_id, minio_key=key)
    db.add(voucher)
    await db.flush()
    return voucher


async def upload_payment_method_image(
    db: AsyncSession,
    payment_method_id: str,
    owner_id: str,
    file: UploadFile,
) -> PaymentMethod:
    """Uploads an image for a payment method. Only the owner admin may update."""
    result = await db.execute(
        select(PaymentMethod).where(PaymentMethod.id == payment_method_id)
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Método de pago no encontrado", "code": "NOT_FOUND"},
        )
    if str(method.owner_id) != str(owner_id):
        raise HTTPException(
            status_code=403,
            detail={"detail": "No tienes permiso para este método de pago", "code": "FORBIDDEN"},
        )

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Tipo de imagen no permitido", "code": "INVALID_FILE_TYPE"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_METHOD_IMAGE_SIZE:
        raise HTTPException(
            status_code=422,
            detail={"detail": "La imagen excede el tamaño máximo (5 MB)", "code": "FILE_TOO_LARGE"},
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    key = f"methods/{payment_method_id}/{uuid.uuid4()}.{ext}"
    storage_service.upload_file(
        storage_service.BUCKET_PAYMENT_METHODS,
        key,
        file_bytes,
        file.content_type,
    )

    # Delete old image if present
    if method.minio_key:
        storage_service.delete_file(storage_service.BUCKET_PAYMENT_METHODS, method.minio_key)

    method.minio_key = key
    await db.flush()
    return method
