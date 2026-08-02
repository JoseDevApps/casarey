"""Webhook de WhatsApp Cloud API — mensajes entrantes.

Flujo "click-to-chat": el usuario abre WhatsApp desde la app y envía un mensaje
al negocio. Eso abre la ventana de servicio de 24 h, dentro de la cual Meta
permite responder con TEXTO LIBRE (sin plantilla). Aprovechamos esa ventana
para entregar el código de verificación por WhatsApp aunque la plantilla
AUTHENTICATION siga bloqueada (requiere verificación del negocio).

Las conversaciones de servicio no tienen costo para el negocio.
"""

import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.otp_code import OtpPurpose
from app.models.user import User
from app.services import otp_service, whatsapp_service
from app.utils.phone import normalize_phone_e164

logger = logging.getLogger("app.whatsapp")

router = APIRouter()


def _verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Valida X-Hub-Signature-256 con el app secret. Si no hay secret
    configurado, no se puede validar (se acepta y se registra el aviso)."""
    if not settings.WHATSAPP_APP_SECRET:
        logger.warning(
            "WHATSAPP_APP_SECRET sin configurar: webhook aceptado sin validar firma"
        )
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


@router.get("")
async def verify_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
):
    """Handshake de verificación que Meta hace al registrar el webhook."""
    if (
        hub_mode == "subscribe"
        and settings.WHATSAPP_VERIFY_TOKEN
        and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN
    ):
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"detail": "Token de verificación inválido", "code": "INVALID_VERIFY_TOKEN"},
    )


async def _handle_inbound(db: AsyncSession, from_phone: str) -> None:
    """Un usuario escribió al negocio: si tiene cuenta sin verificar, le
    enviamos su código de verificación como texto libre."""
    try:
        phone = normalize_phone_e164(from_phone)
    except ValueError:
        logger.warning("Webhook: teléfono no normalizable %s", from_phone)
        return

    result = await db.execute(
        select(User)
        .where(User.phone == phone, User.is_active == True)  # noqa: E712
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    if not users:
        await whatsapp_service.send_text(
            to_phone=phone,
            body=(
                "No encontramos una cuenta registrada con este número. "
                "Regístrate en nuestro sitio y vuelve a escribirnos para "
                "recibir tu código de verificación."
            ),
        )
        return

    pending = next((u for u in users if not u.email_verified), None)
    if not pending:
        await whatsapp_service.send_text(
            to_phone=phone,
            body="Tu cuenta ya está verificada. ¡Puedes iniciar sesión cuando quieras!",
        )
        return

    try:
        await otp_service.check_rate_limit(
            db=db, user=pending, purpose=OtpPurpose.VERIFY_ACCOUNT
        )
    except HTTPException:
        await whatsapp_service.send_text(
            to_phone=phone,
            body="Ya te enviamos un código hace poco. Espera un momento antes de pedir otro.",
        )
        return

    code = await otp_service.create_otp(
        db=db, user=pending, purpose=OtpPurpose.VERIFY_ACCOUNT, channel="whatsapp"
    )
    await whatsapp_service.send_text(
        to_phone=phone,
        body=(
            f"Tu código de verificación de Cabañas Coroico es: {code}\n\n"
            f"Expira en {settings.OTP_EXPIRE_MINUTES} minutos. "
            "Por tu seguridad, no lo compartas con nadie."
        ),
    )
    await db.commit()
    logger.info("Código de verificación enviado por WhatsApp a %s", phone)


@router.post("")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Recibe eventos de Meta. Siempre responde 200 para que no reintente."""
    raw = await request.body()
    if not _verify_signature(raw, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "Firma inválida", "code": "INVALID_SIGNATURE"},
        )

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            # Los eventos de estado (sent/delivered/read) no traen "messages"
            for message in value.get("messages", []):
                from_phone = message.get("from")
                if not from_phone:
                    continue
                try:
                    await _handle_inbound(db=db, from_phone=from_phone)
                except Exception:
                    logger.exception("Error procesando mensaje entrante de %s", from_phone)

    return {"status": "ok"}
