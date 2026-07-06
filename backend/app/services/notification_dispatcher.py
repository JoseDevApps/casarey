"""Decide el canal de cada notificación: WhatsApp primero, email como respaldo.

Contrato heredado del sistema de emails: una notificación NUNCA rompe el
request que la dispara. Todos los errores terminan en log, no en excepción.
"""

import logging
from dataclasses import dataclass, field

from app.services import email_service, whatsapp_service
from app.utils.phone import normalize_phone_e164

logger = logging.getLogger("app.notifications")


@dataclass
class NotificationMessage:
    # Canal WhatsApp (plantilla Meta pre-aprobada)
    wa_phone: str | None  # crudo; se normaliza aquí (legacy puede venir sucio)
    wa_template: str
    wa_params: list[str] = field(default_factory=list)
    # Canal email (respaldo — plantillas actuales, incl. personalizadas del admin)
    email_to: str = ""
    email_subject: str = ""
    email_body: str = ""
    email_vars: dict[str, object] | None = None


def _normalized_or_none(raw_phone: str | None) -> str | None:
    if not raw_phone:
        return None
    try:
        return normalize_phone_e164(raw_phone)
    except ValueError:
        return None


async def dispatch(message: NotificationMessage, *, context: str) -> str:
    """Envía por WhatsApp si es posible; si no (o falla), por email.

    Retorna el canal efectivo: "whatsapp" | "email" | "none".
    """
    phone = _normalized_or_none(message.wa_phone)

    # can_deliver: solo se intenta WhatsApp cuando puede ENTREGAR de verdad
    # (credenciales Meta y sin dry-run); mientras tanto, todo sale por correo.
    if whatsapp_service.can_deliver() and phone:
        try:
            await whatsapp_service.send_template(
                to_phone=phone,
                template_name=message.wa_template,
                body_params=message.wa_params,
            )
            return "whatsapp"
        except whatsapp_service.WhatsAppError as exc:
            logger.warning(
                "[%s] WhatsApp fallo (code=%s), usando fallback email: %s",
                context,
                exc.code,
                exc,
            )
        except Exception:
            logger.exception("[%s] Error inesperado en WhatsApp, fallback email", context)

    if message.email_to:
        try:
            await email_service.send_custom_email(
                to_email=message.email_to,
                subject=message.email_subject,
                body=message.email_body,
                template_vars=message.email_vars,
            )
            return "email"
        except Exception:
            logger.exception("[%s] Fallo tambien el canal email", context)

    return "none"
