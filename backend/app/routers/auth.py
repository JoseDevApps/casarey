import hashlib
from datetime import datetime, timedelta, timezone
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
from app.services import email_service
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    ChangePasswordRequest,
    EmailVerificationRequest,
    EmailVerificationResendRequest,
    EmailVerificationResult,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.dependencies import get_current_user

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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
        verification_token = create_email_verification_token(
            {"sub": str(user.id), "email": user.email}
        )
        await email_service.send_verification_email(
            to_email=user.email,
            full_name=user.full_name,
            token=verification_token,
        )
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "No se pudo enviar el correo de verificación. Intenta de nuevo.",
                "code": "EMAIL_DELIVERY_FAILED",
            },
        )

    await db.commit()
    await db.refresh(user)
    return user


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


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
async def resend_verification(
    body: EmailVerificationResendRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or user.email_verified:
        return

    try:
        verification_token = create_email_verification_token(
            {"sub": str(user.id), "email": user.email}
        )
        await email_service.send_verification_email(
            to_email=user.email,
            full_name=user.full_name,
            token=verification_token,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "No se pudo reenviar el correo de verificación. Intenta de nuevo.",
                "code": "EMAIL_DELIVERY_FAILED",
            },
        )


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

        now = datetime.now(timezone.utc)
        active_tokens_result = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at == None,
                PasswordResetToken.expires_at > now,
            )
        )
        active_tokens = active_tokens_result.scalars().all()
        for token in active_tokens:
            token.used_at = now

        reset_token = create_password_reset_token({"sub": str(user.id), "email": user.email})
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_token(reset_token),
                expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
            )
        )
        await db.commit()

        try:
            await email_service.send_password_reset_email(
                to_email=user.email,
                full_name=user.full_name,
                token=reset_token,
            )
        except Exception:
            # Keep generic response behavior to avoid account enumeration.
            pass
    except Exception:
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

    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "La nueva contraseña debe ser distinta a la actual",
                "code": "PASSWORD_REUSE",
            },
        )

    refresh_tokens_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > now,
        )
    )
    refresh_tokens = refresh_tokens_result.scalars().all()
    for token in refresh_tokens:
        token.revoked_at = now

    password_reset_token.used_at = now
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
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
