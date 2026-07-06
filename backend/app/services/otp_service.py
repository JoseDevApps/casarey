"""Gestión de códigos OTP de 6 dígitos (verificación de cuenta y reset).

Reglas (settings): expiración OTP_EXPIRE_MINUTES, quema tras OTP_MAX_ATTEMPTS
intentos fallidos, cooldown de reenvío OTP_RESEND_COOLDOWN_SECONDS y tope
OTP_MAX_SENDS_PER_HOUR por usuario+propósito. Los códigos se guardan hasheados.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.otp_code import OtpCode, OtpPurpose
from app.models.user import User


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_code(code: str, user_id) -> str:
    return hashlib.sha256(f"{code}:{user_id}".encode()).hexdigest()


async def check_rate_limit(db: AsyncSession, user: User, purpose: OtpPurpose) -> None:
    """429 si el usuario pide códigos demasiado rápido o demasiadas veces."""
    now = datetime.now(timezone.utc)

    last_result = await db.execute(
        select(func.max(OtpCode.created_at)).where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == purpose,
        )
    )
    last_created = last_result.scalar_one_or_none()
    if last_created is not None:
        elapsed = (now - last_created).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "detail": "Espera un momento antes de pedir otro código",
                    "code": "OTP_COOLDOWN",
                },
            )

    hour_ago = now - timedelta(hours=1)
    count_result = await db.execute(
        select(func.count()).select_from(OtpCode).where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == purpose,
            OtpCode.created_at >= hour_ago,
        )
    )
    if count_result.scalar_one() >= settings.OTP_MAX_SENDS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "Demasiados códigos solicitados. Intenta más tarde.",
                "code": "OTP_RATE_LIMITED",
            },
        )


async def create_otp(
    db: AsyncSession,
    user: User,
    purpose: OtpPurpose,
    channel: str = "whatsapp",
) -> str:
    """Invalida los OTP activos previos del mismo propósito y crea uno nuevo.

    Retorna el código EN CLARO (para enviarlo); solo se persiste el hash.
    No hace commit — el caller decide la transacción.
    """
    now = datetime.now(timezone.utc)

    active_result = await db.execute(
        select(OtpCode).where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == purpose,
            OtpCode.used_at == None,  # noqa: E711
            OtpCode.expires_at > now,
        )
    )
    for previous in active_result.scalars().all():
        previous.used_at = now

    code = generate_code()
    db.add(
        OtpCode(
            user_id=user.id,
            purpose=purpose,
            code_hash=_hash_code(code, user.id),
            channel=channel,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        )
    )
    await db.flush()
    return code


async def verify_otp(
    db: AsyncSession,
    user: User,
    purpose: OtpPurpose,
    code: str,
) -> bool:
    """True si el código es válido; lo marca como usado. Incrementa intentos y
    quema el código al llegar a OTP_MAX_ATTEMPTS. No hace commit."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OtpCode)
        .where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == purpose,
            OtpCode.used_at == None,  # noqa: E711
            OtpCode.expires_at > now,
        )
        .order_by(OtpCode.created_at.desc())
    )
    otp = result.scalars().first()
    if not otp:
        return False

    if otp.code_hash == _hash_code(code, user.id):
        otp.used_at = now
        return True

    otp.attempts += 1
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        otp.used_at = now  # quemado: demasiados intentos
    return False
