from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import require_role
from app.models.notification import AdminNotificationPreference
from app.models.user import User, UserRole
from app.schemas.notification import (
    AdminNotificationPreferenceResponse,
    AdminNotificationPreferenceUpdate,
)
from app.services import whatsapp_service
from app.services.notification_preferences_service import (
    get_or_create_admin_notification_preferences,
)

router = APIRouter()


def _build_response(
    preferences: AdminNotificationPreference,
) -> AdminNotificationPreferenceResponse:
    """Añade a la respuesta el estado read-only del canal WhatsApp (desde settings)."""
    response = AdminNotificationPreferenceResponse.model_validate(preferences)
    # Refleja capacidad REAL de entrega (credenciales Meta, sin dry-run)
    response.whatsapp_enabled = whatsapp_service.can_deliver()
    response.whatsapp_templates = {
        "otp": settings.WHATSAPP_TEMPLATE_OTP,
        "admin_nueva_reserva": settings.WHATSAPP_TEMPLATE_ADMIN_NEW_RESERVATION,
        "admin_comprobante_subido": settings.WHATSAPP_TEMPLATE_ADMIN_VOUCHER_UPLOADED,
        "reserva_aprobada": settings.WHATSAPP_TEMPLATE_RESERVATION_APPROVED,
        "reserva_rechazada": settings.WHATSAPP_TEMPLATE_RESERVATION_REJECTED,
        "pago_recibido": settings.WHATSAPP_TEMPLATE_PAYMENT_RECEIVED,
        "pago_confirmado": settings.WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED,
    }
    return response


@router.get("", response_model=AdminNotificationPreferenceResponse)
async def get_my_notification_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    preferences = await get_or_create_admin_notification_preferences(
        db=db, owner_id=current_user.id
    )
    await db.commit()
    await db.refresh(preferences)
    return _build_response(preferences)


@router.put("", response_model=AdminNotificationPreferenceResponse)
async def update_my_notification_preferences(
    body: AdminNotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    preferences = await get_or_create_admin_notification_preferences(
        db=db, owner_id=current_user.id
    )
    for field, value in body.model_dump().items():
        setattr(preferences, field, value)

    await db.commit()
    await db.refresh(preferences)
    return _build_response(preferences)
