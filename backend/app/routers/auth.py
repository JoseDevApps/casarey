import hashlib
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_email_verification_token,
    create_password_reset_token,
    verify_token,
)
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.models.otp_code import OtpPurpose
from app.services import email_service, otp_service, whatsapp_service
from app.utils.phone import is_valid_phone, normalize_phone_e164
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    RegisterResponse,
    TokenResponse,
    ChangePasswordRequest,
    EmailVerificationRequest,
    EmailVerificationResendRequest,
    EmailVerificationResult,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetPasswordWithCodeRequest,
    ResendVerificationResult,
    VerifyCodeRequest,
    WhatsAppOptinResponse,
    ProfileUpdateRequest,
    PhoneChangeRequest,
    PhoneChangeResult,
    VerifyPhoneRequest,
)
from app.dependencies import get_current_user

logger = logging.getLogger("app.auth")

router = APIRouter()

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _cookie_opts() -> dict:
    secure_cookie = settings.COOKIE_SECURE or settings.cookie_samesite_value == "none"
    opts = {
        "httponly": True,
        "samesite": settings.cookie_samesite_value,
        "secure": secure_cookie,
    }
    if settings.cookie_domain_value:
        opts["domain"] = settings.cookie_domain_value
    return opts


def _delete_cookie_opts() -> dict:
    secure_cookie = settings.COOKIE_SECURE or settings.cookie_samesite_value == "none"
    opts = {
        "path": "/",
        "httponly": True,
        "samesite": settings.cookie_samesite_value,
        "secure": secure_cookie,
    }
    if settings.cookie_domain_value:
        opts["domain"] = settings.cookie_domain_value
    return opts


async def _send_verification(
    db: AsyncSession, user: User, channel: str = "whatsapp"
) -> str:
    """Envía el CÓDIGO de verificación de cuenta (6 dígitos).

    Medio de entrega:
    - WhatsApp: solo si el usuario lo eligió, hay teléfono válido y WhatsApp
      Business puede entregar de verdad (can_deliver: credenciales Meta, sin dry-run).
    - Correo: en cualquier otro caso (elección del usuario, WhatsApp no operativo
      aún, o fallo del envío por WhatsApp). Mismo código, otro medio.

    Retorna el medio efectivamente usado ("whatsapp" | "email"). Lanza si el
    envío por correo (último recurso) falla.
    """
    want_whatsapp = (
        channel == "whatsapp"
        and whatsapp_service.can_deliver()
        and user.phone
        and is_valid_phone(user.phone)
    )
    if want_whatsapp:
        try:
            code = await otp_service.create_otp(
                db=db, user=user, purpose=OtpPurpose.VERIFY_ACCOUNT, channel="whatsapp"
            )
            await whatsapp_service.send_otp(
                to_phone=normalize_phone_e164(user.phone), code=code
            )
            return "whatsapp"
        except Exception:
            logger.warning(
                "Fallo OTP por WhatsApp para %s, usando fallback email", user.id
            )

    code = await otp_service.create_otp(
        db=db, user=user, purpose=OtpPurpose.VERIFY_ACCOUNT, channel="email"
    )
    await email_service.send_otp_email(
        to_email=user.email,
        full_name=user.full_name,
        code=code,
        purpose="verify",
    )
    return "email"


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "El email ya está registrado", "code": "EMAIL_TAKEN"},
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
        role=UserRole.CLIENT,
        email_verified=False,
    )
    db.add(user)

    await db.flush()

    try:
        channel = await _send_verification(
            db=db, user=user, channel=body.verification_channel
        )
    except Exception:
        # Solo si fallan ambos canales (WhatsApp ya cayó a email dentro del helper)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "No se pudo enviar la verificación. Intenta de nuevo.",
                "code": "DELIVERY_FAILED",
            },
        )

    await db.commit()
    await db.refresh(user)
    return RegisterResponse(
        **UserResponse.model_validate(user).model_dump(),
        verification_channel=channel,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Credenciales inválidas", "code": "INVALID_CREDENTIALS"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "Cuenta desactivada", "code": "ACCOUNT_DISABLED"},
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": "Debes verificar tu correo electrónico antes de iniciar sesión",
                "code": "EMAIL_NOT_VERIFIED",
            },
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Persist hashed refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.commit()

    response.set_cookie(
        "access_token",
        access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_cookie_opts(),
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        **_cookie_opts(),
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Refresh token no proporcionado", "code": "MISSING_REFRESH_TOKEN"},
        )

    payload = verify_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Token inválido", "code": "INVALID_TOKEN"},
        )

    token_hash = _hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    db_token = result.scalar_one_or_none()
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Refresh token inválido o revocado", "code": "TOKEN_REVOKED"},
        )

    user_id = payload.get("sub")
    user_result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Usuario no encontrado", "code": "USER_NOT_FOUND"},
        )

    # Rotate: revoke old, issue new
    db_token.revoked_at = datetime.now(timezone.utc)

    new_access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh_token = create_refresh_token({"sub": str(user.id)})

    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_refresh_token),
        expires_at=new_expires_at,
    )
    db.add(new_db_token)
    await db.commit()

    response.set_cookie(
        "access_token",
        new_access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_cookie_opts(),
    )
    response.set_cookie(
        "refresh_token",
        new_refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        **_cookie_opts(),
    )

    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/verify-email", response_model=EmailVerificationResult)
async def verify_email(
    body: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(body.token)
    if payload.get("type") != "email_verify":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Token inválido", "code": "INVALID_TOKEN"},
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Token inválido", "code": "INVALID_TOKEN"},
        )

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or user.email.lower() != str(email).lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Token inválido", "code": "INVALID_TOKEN"},
        )

    if not user.email_verified:
        user.email_verified = True
        await db.commit()

    return EmailVerificationResult(verified=True)


@router.post("/resend-verification", response_model=ResendVerificationResult)
async def resend_verification(
    body: EmailVerificationResendRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or user.email_verified:
        # Respuesta genérica anti-enumeración: no revelar si la cuenta existe
        return ResendVerificationResult(channel=body.channel or "email")

    await otp_service.check_rate_limit(db=db, user=user, purpose=OtpPurpose.VERIFY_ACCOUNT)

    try:
        channel = await _send_verification(
            db=db, user=user, channel=body.channel or "whatsapp"
        )
        await db.commit()
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "No se pudo reenviar la verificación. Intenta de nuevo.",
                "code": "DELIVERY_FAILED",
            },
        )
    return ResendVerificationResult(channel=channel)


@router.get("/whatsapp-optin", response_model=WhatsAppOptinResponse)
async def whatsapp_optin():
    """Enlace para recibir el código por WhatsApp (click-to-chat).

    El usuario envía el mensaje prellenado; eso abre la ventana de servicio de
    24 h y el webhook le responde con el código. Permite entregar el OTP por
    WhatsApp sin plantilla AUTHENTICATION.
    """
    number = settings.WHATSAPP_BUSINESS_NUMBER.strip()
    if not (whatsapp_service.can_deliver() and number):
        return WhatsAppOptinResponse(enabled=False)

    text = quote("Hola, quiero recibir mi codigo de verificacion", safe="")
    return WhatsAppOptinResponse(enabled=True, link=f"https://wa.me/{number}?text={text}")


@router.post("/verify-code", response_model=EmailVerificationResult)
async def verify_code(
    body: VerifyCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verifica la cuenta con el código OTP recibido por WhatsApp."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"detail": "Código inválido o expirado", "code": "INVALID_CODE"},
    )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        # Misma respuesta que un código incorrecto (anti-enumeración)
        raise invalid

    if user.email_verified:
        return EmailVerificationResult(verified=True)

    ok = await otp_service.verify_otp(
        db=db, user=user, purpose=OtpPurpose.VERIFY_ACCOUNT, code=body.code
    )
    if not ok:
        await db.commit()  # persistir el incremento de intentos
        raise invalid

    user.email_verified = True
    # El código llegó al teléfono del usuario: el número queda verificado.
    user.phone_verified = True
    await db.commit()
    return EmailVerificationResult(verified=True)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            return Response(status_code=status.HTTP_204_NO_CONTENT)

        # Rate limit común: es el mismo tipo de código sin importar el medio
        try:
            await otp_service.check_rate_limit(
                db=db, user=user, purpose=OtpPurpose.PASSWORD_RESET
            )
        except HTTPException:
            # Respuesta genérica igualmente (anti-enumeración)
            return Response(status_code=status.HTTP_204_NO_CONTENT)

        # Medio preferido: WhatsApp solo si el usuario no pidió correo, hay
        # teléfono válido y WhatsApp Business puede ENTREGAR (can_deliver).
        if (
            body.channel != "email"
            and whatsapp_service.can_deliver()
            and user.phone
            and is_valid_phone(user.phone)
        ):
            try:
                code = await otp_service.create_otp(
                    db=db, user=user, purpose=OtpPurpose.PASSWORD_RESET, channel="whatsapp"
                )
                await whatsapp_service.send_otp(
                    to_phone=normalize_phone_e164(user.phone), code=code
                )
                await db.commit()
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            except Exception:
                await db.rollback()
                logger.warning(
                    "Fallo OTP de reset por WhatsApp para %s, usando correo",
                    user.id,
                )

        # Correo: mismo código de 6 dígitos, entregado por email. (El flujo
        # legacy por enlace sigue vivo en /reset-password?token= para enlaces
        # ya emitidos, pero los nuevos envíos son siempre códigos.)
        code = await otp_service.create_otp(
            db=db, user=user, purpose=OtpPurpose.PASSWORD_RESET, channel="email"
        )
        await email_service.send_otp_email(
            to_email=user.email,
            full_name=user.full_name,
            code=code,
            purpose="reset",
        )
        await db.commit()
    except Exception:
        # La respuesta sigue siendo 204 (anti-enumeración), pero el error debe
        # quedar visible para diagnóstico — antes se tragaba silenciosamente.
        logger.exception("Error inesperado en forgot-password")
        await db.rollback()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(body.token)
    if payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Enlace inválido o expirado", "code": "INVALID_TOKEN"},
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Enlace inválido o expirado", "code": "INVALID_TOKEN"},
        )

    now = datetime.now(timezone.utc)
    token_hash = _hash_token(body.token)

    token_result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at == None,
            PasswordResetToken.expires_at > now,
        )
    )
    password_reset_token = token_result.scalar_one_or_none()
    if not password_reset_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Enlace inválido o expirado", "code": "INVALID_TOKEN"},
        )

    user_result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = user_result.scalar_one_or_none()
    if (
        not user
        or str(user.email).lower() != str(email).lower()
        or password_reset_token.user_id != user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Enlace inválido o expirado", "code": "INVALID_TOKEN"},
        )

    await _apply_password_reset(db=db, user=user, new_password=body.new_password)

    password_reset_token.used_at = datetime.now(timezone.utc)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _apply_password_reset(db: AsyncSession, user: User, new_password: str) -> None:
    """Lógica común de reset (por link o por código): rechaza reutilización,
    revoca sesiones activas y aplica el nuevo hash. No hace commit."""
    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "La nueva contraseña debe ser distinta a la actual",
                "code": "PASSWORD_REUSE",
            },
        )

    now = datetime.now(timezone.utc)
    refresh_tokens_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > now,
        )
    )
    for token in refresh_tokens_result.scalars().all():
        token.revoked_at = now

    user.password_hash = hash_password(new_password)
    user.must_change_password = False


@router.post("/reset-password-with-code", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password_with_code(
    body: ResetPasswordWithCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset de contraseña con el código OTP recibido por WhatsApp."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"detail": "Código inválido o expirado", "code": "INVALID_CODE"},
    )

    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise invalid

    ok = await otp_service.verify_otp(
        db=db, user=user, purpose=OtpPurpose.PASSWORD_RESET, code=body.code
    )
    if not ok:
        await db.commit()  # persistir el incremento de intentos
        raise invalid

    await _apply_password_reset(db=db, user=user, new_password=body.new_password)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if refresh_token:
        token_hash = _hash_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        db_token = result.scalar_one_or_none()
        if db_token and db_token.revoked_at is None:
            db_token.revoked_at = datetime.now(timezone.utc)
            await db.commit()

    response.delete_cookie("access_token", **_delete_cookie_opts())
    response.delete_cookie("refresh_token", **_delete_cookie_opts())


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "La contraseña actual es incorrecta", "code": "INVALID_CURRENT_PASSWORD"},
        )

    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "La nueva contraseña debe ser distinta a la actual",
                "code": "PASSWORD_REUSE",
            },
        )

    now = datetime.now(timezone.utc)
    token_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > now,
        )
    )
    active_tokens = token_result.scalars().all()
    for token in active_tokens:
        token.revoked_at = now

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    await db.commit()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edita los datos no sensibles del perfil. El telefono se cambia por
    /auth/change-phone porque requiere contrasena y verificacion."""
    current_user.full_name = body.full_name
    await db.commit()
    await db.refresh(current_user)
    return current_user


async def _send_phone_code(db: AsyncSession, user: User, to_phone: str) -> str:
    """Envia el codigo al numero NUEVO. Si WhatsApp no puede entregar, usa correo
    (asi el usuario no queda bloqueado, aunque el codigo viaje por otro medio)."""
    code = await otp_service.create_otp(
        db=db, user=user, purpose=OtpPurpose.VERIFY_PHONE, channel="whatsapp"
    )
    if whatsapp_service.can_deliver():
        try:
            await whatsapp_service.send_otp(to_phone=to_phone, code=code)
            return "whatsapp"
        except Exception:
            logger.warning("Fallo el envio del codigo de cambio de telefono a %s", to_phone)

    await email_service.send_otp_email(
        to_email=user.email,
        full_name=user.full_name,
        code=code,
        purpose="verify",
    )
    return "email"


@router.post("/change-phone", response_model=PhoneChangeResult)
async def change_phone(
    body: PhoneChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia el cambio de telefono.

    El numero nuevo queda en `pending_phone` y NO reemplaza al actual hasta que
    el usuario confirme el codigo. Asi, si se equivoca al escribirlo, sus
    notificaciones siguen llegando al numero verificado y no a un desconocido.
    """
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "La contraseña actual es incorrecta", "code": "INVALID_CURRENT_PASSWORD"},
        )

    if body.new_phone == current_user.phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Ese ya es tu número actual", "code": "PHONE_UNCHANGED"},
        )

    await otp_service.check_rate_limit(
        db=db, user=current_user, purpose=OtpPurpose.VERIFY_PHONE
    )

    current_user.pending_phone = body.new_phone
    try:
        channel = await _send_phone_code(db=db, user=current_user, to_phone=body.new_phone)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"detail": "No se pudo enviar el código. Intenta de nuevo.", "code": "DELIVERY_FAILED"},
        )

    await db.commit()
    return PhoneChangeResult(pending_phone=body.new_phone, channel=channel)


@router.post("/verify-phone", response_model=UserResponse)
async def verify_phone(
    body: VerifyPhoneRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma el codigo y promueve el numero pendiente a numero activo."""
    if not current_user.pending_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "No hay un cambio de teléfono en curso", "code": "NO_PENDING_PHONE"},
        )

    ok = await otp_service.verify_otp(
        db=db, user=current_user, purpose=OtpPurpose.VERIFY_PHONE, code=body.code
    )
    if not ok:
        await db.commit()  # persistir el intento fallido
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Código inválido o expirado", "code": "INVALID_CODE"},
        )

    current_user.phone = current_user.pending_phone
    current_user.pending_phone = None
    current_user.phone_verified = True
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/change-phone", response_model=UserResponse)
async def cancel_phone_change(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela un cambio de telefono en curso."""
    current_user.pending_phone = None
    await db.commit()
    await db.refresh(current_user)
    return current_user
