import asyncio
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import quote

from app.core.config import settings

logger = logging.getLogger("app.email")


def _from_email() -> str:
    return settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME


def _build_verification_link(token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/verify-email?token={quote(token, safe='')}"


def _build_password_reset_link(token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/reset-password?token={quote(token, safe='')}"


def render_template_text(template: str, template_vars: dict[str, object] | None = None) -> str:
    text = template
    if not template_vars:
        return text
    for key, value in template_vars.items():
        replacement = "" if value is None else str(value)
        # Support both {var} and {{var}} notations.
        text = text.replace(f"{{{{{key}}}}}", replacement)
        text = text.replace(f"{{{key}}}", replacement)
    return text


def _basic_html_from_plain_text(plain_text: str) -> str:
    escaped = html.escape(plain_text).replace("\n", "<br/>")
    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <p>{escaped}</p>
      </body>
    </html>
    """


def smtp_is_configured() -> bool:
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USERNAME
        and settings.SMTP_PASSWORD
        and _from_email()
    )


def _send_message_sync(message: EmailMessage) -> None:
    encryption = settings.SMTP_ENCRYPTION.lower()
    context = ssl.create_default_context()

    if encryption == "ssl":
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            context=context,
            timeout=20,
        ) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return

    if encryption in {"tls", "starttls"}:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return

    raise ValueError("SMTP_ENCRYPTION debe ser 'ssl', 'tls' o 'starttls'")


async def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    if not smtp_is_configured():
        raise RuntimeError("SMTP no está configurado")

    link = _build_verification_link(token)
    from_email = _from_email()

    message = EmailMessage()
    message["Subject"] = "Verifica tu cuenta en Casas de Campo"
    message["From"] = from_email
    message["To"] = to_email

    plain_text = (
        f"Hola {full_name},\n\n"
        "Gracias por registrarte en Casas de Campo.\n"
        "Para activar tu cuenta, verifica tu correo en el siguiente enlace:\n\n"
        f"{link}\n\n"
        f"Este enlace expira en {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} horas.\n"
        "Si no creaste esta cuenta, puedes ignorar este mensaje."
    )
    message.set_content(plain_text)

    html_text = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937;">
        <p>Hola <strong>{full_name}</strong>,</p>
        <p>Gracias por registrarte en Casas de Campo.</p>
        <p>Para activar tu cuenta, verifica tu correo en el siguiente enlace:</p>
        <p>
          <a href="{link}">Verificar cuenta</a>
        </p>
        <p>Este enlace expira en {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} horas.</p>
        <p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
      </body>
    </html>
    """
    message.add_alternative(html_text, subtype="html")

    try:
        await asyncio.to_thread(_send_message_sync, message)
    except Exception:
        logger.exception("Fallo al enviar correo de verificación a %s", to_email)
        raise


async def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    if not smtp_is_configured():
        raise RuntimeError("SMTP no está configurado")

    link = _build_password_reset_link(token)
    from_email = _from_email()

    message = EmailMessage()
    message["Subject"] = "Restablece tu contraseña en Casas de Campo"
    message["From"] = from_email
    message["To"] = to_email

    plain_text = (
        f"Hola {full_name},\n\n"
        "Recibimos una solicitud para restablecer tu contraseña.\n"
        "Usa este enlace para definir una nueva contraseña:\n\n"
        f"{link}\n\n"
        f"Este enlace expira en {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos.\n"
        "Si no realizaste esta solicitud, ignora este mensaje."
    )
    message.set_content(plain_text)

    html_text = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937;">
        <p>Hola <strong>{full_name}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Usa este enlace para definir una nueva contraseña:</p>
        <p><a href="{link}">Restablecer contraseña</a></p>
        <p>Este enlace expira en {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos.</p>
        <p>Si no realizaste esta solicitud, ignora este mensaje.</p>
      </body>
    </html>
    """
    message.add_alternative(html_text, subtype="html")

    try:
        await asyncio.to_thread(_send_message_sync, message)
    except Exception:
        logger.exception("Fallo al enviar correo de recuperación a %s", to_email)
        raise


async def send_custom_email(
    to_email: str,
    subject: str,
    body: str,
    template_vars: dict[str, object] | None = None,
) -> None:
    if not smtp_is_configured():
        raise RuntimeError("SMTP no está configurado")

    from_email = _from_email()
    rendered_subject = render_template_text(subject, template_vars)
    rendered_body = render_template_text(body, template_vars)

    message = EmailMessage()
    message["Subject"] = rendered_subject
    message["From"] = from_email
    message["To"] = to_email
    message.set_content(rendered_body)
    message.add_alternative(_basic_html_from_plain_text(rendered_body), subtype="html")

    try:
        await asyncio.to_thread(_send_message_sync, message)
    except Exception:
        logger.exception("Fallo al enviar correo personalizado a %s", to_email)
        raise
