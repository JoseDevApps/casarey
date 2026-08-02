"""Cliente de la WhatsApp Business Cloud API (Meta).

Solo envía mensajes de PLANTILLA (`type=template`) — Meta prohíbe texto libre
iniciado por el negocio fuera de la ventana de servicio de 24 h. Las plantillas
se crean y aprueban en Meta Business Manager; aquí solo se referencian por
nombre (configurable vía settings.WHATSAPP_TEMPLATE_*).

Con WHATSAPP_DRY_RUN=true no se llama a la API: se loguea el payload y se
retorna un wamid ficticio (útil para desarrollo sin cuenta Meta).
"""

import asyncio
import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger("app.whatsapp")

# Códigos de error de la Graph API relevantes para el enrutamiento
_RECIPIENT_ERROR_CODES = {131026, 131030}  # número inválido / no está en WhatsApp
_RETRYABLE_ERROR_CODES = {131048, 131056}  # límites de tasa / spam
_MAX_RETRIES = 2
_RETRY_DELAYS = (1.0, 3.0)

_WHITESPACE_RE = re.compile(r"\s+")
_PARAM_MAX_LEN = 1024


class WhatsAppError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: int | None = None,
        retryable: bool = False,
        recipient_error: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.recipient_error = recipient_error


def is_enabled() -> bool:
    """El servicio puede ACEPTAR llamadas (incluye dry-run sin credenciales)."""
    # En dry-run no se necesitan credenciales (no se llama a la API real)
    if settings.WHATSAPP_ENABLED and settings.WHATSAPP_DRY_RUN:
        return True
    return bool(
        settings.WHATSAPP_ENABLED
        and settings.WHATSAPP_ACCESS_TOKEN
        and settings.WHATSAPP_PHONE_NUMBER_ID
    )


def can_deliver() -> bool:
    """WhatsApp puede ENTREGAR mensajes reales (credenciales de Meta y sin dry-run).

    Mientras esto sea False (no hay WhatsApp Business operativo), el sistema
    enruta códigos y notificaciones por CORREO. Al cargar credenciales reales
    y apagar el dry-run, WhatsApp toma el relevo automáticamente.
    """
    return bool(
        settings.WHATSAPP_ENABLED
        and not settings.WHATSAPP_DRY_RUN
        and settings.WHATSAPP_ACCESS_TOKEN
        and settings.WHATSAPP_PHONE_NUMBER_ID
    )


def _sanitize_param(value: object) -> str:
    """Meta rechaza parámetros con saltos de línea/tabs o >1024 caracteres."""
    text = "" if value is None else str(value)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text[:_PARAM_MAX_LEN]


def _messages_url() -> str:
    return (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )


def _parse_error(response: httpx.Response) -> WhatsAppError:
    try:
        error = response.json().get("error", {})
    except Exception:
        error = {}
    code = error.get("code")
    message = error.get("message", f"HTTP {response.status_code}")

    if code in _RECIPIENT_ERROR_CODES:
        return WhatsAppError(message, code=code, recipient_error=True)
    if code in _RETRYABLE_ERROR_CODES or response.status_code == 429:
        return WhatsAppError(message, code=code, retryable=True)
    if response.status_code >= 500:
        return WhatsAppError(message, code=code, retryable=True)
    # 190 token expirado, 132001 plantilla inexistente, 132000 params, 10/200 permisos:
    # errores de configuración — no reintentables, el dispatcher cae a email.
    return WhatsAppError(message, code=code)


async def _post_payload(payload: dict) -> str:
    if settings.WHATSAPP_DRY_RUN:
        logger.info(
            "DRY-RUN WhatsApp -> %s | template=%s | payload=%s",
            payload.get("to"),
            payload.get("template", {}).get("name"),
            payload,
        )
        return "wamid.DRYRUN"

    last_error: WhatsAppError | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    _messages_url(),
                    json=payload,
                    headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                )
        except httpx.HTTPError as exc:
            last_error = WhatsAppError(f"Error de red: {exc}", retryable=True)
        else:
            if response.status_code < 300:
                data = response.json()
                wamid = (data.get("messages") or [{}])[0].get("id", "")
                logger.info(
                    "WhatsApp enviado -> %s | template=%s | wamid=%s",
                    payload.get("to"),
                    payload.get("template", {}).get("name"),
                    wamid,
                )
                return wamid
            last_error = _parse_error(response)
            if not last_error.retryable:
                break

        if attempt < _MAX_RETRIES:
            await asyncio.sleep(_RETRY_DELAYS[attempt])

    assert last_error is not None
    logger.warning(
        "Fallo envio WhatsApp -> %s | template=%s | code=%s | %s",
        payload.get("to"),
        payload.get("template", {}).get("name"),
        last_error.code,
        last_error,
    )
    raise last_error


async def send_template(
    to_phone: str,
    template_name: str,
    body_params: list[str],
    lang: str | None = None,
) -> str:
    """Envía una plantilla UTILITY con parámetros posicionales {{1}}..{{n}}.

    `to_phone` debe venir ya normalizado en E.164 sin '+' (ej. 59171234567).
    Retorna el wamid del mensaje.
    """
    if not is_enabled() and not settings.WHATSAPP_DRY_RUN:
        raise WhatsAppError("WhatsApp no está configurado")

    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang or settings.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": _sanitize_param(p)} for p in body_params
                    ],
                }
            ],
        },
    }
    return await _post_payload(payload)


async def send_text(to_phone: str, body: str) -> str:
    """Envía un mensaje de TEXTO LIBRE (sin plantilla).

    Meta solo lo permite dentro de la ventana de servicio de 24 h, es decir,
    después de que el usuario haya escrito al negocio. Se usa para entregar el
    código de verificación por WhatsApp sin depender de una plantilla
    AUTHENTICATION (que exige verificación del negocio).
    """
    if not is_enabled() and not settings.WHATSAPP_DRY_RUN:
        raise WhatsAppError("WhatsApp no está configurado")

    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }
    return await _post_payload(payload)


async def send_otp(to_phone: str, code: str) -> str:
    """Envía el código OTP con la plantilla AUTHENTICATION.

    Las plantillas de autenticación de Meta exigen el parámetro del código en
    el body Y en el botón copy-code (sub_type url, index 0).
    """
    if not is_enabled() and not settings.WHATSAPP_DRY_RUN:
        raise WhatsAppError("WhatsApp no está configurado")

    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": settings.WHATSAPP_TEMPLATE_OTP,
            "language": {"code": settings.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": _sanitize_param(code)}],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": _sanitize_param(code)}],
                },
            ],
        },
    }
    return await _post_payload(payload)
