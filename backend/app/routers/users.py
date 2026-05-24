from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.core.security import hash_password
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole, AdminPasswordResetAudit
from app.schemas.user import (
    UserResponse,
    UserListResponse,
    UserRoleUpdate,
    UserStatusUpdate,
    AdminPasswordResetRequest,
    PasswordResetResult,
)
from app.dependencies import require_role

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    offset = (page - 1) * page_size
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar_one()

    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = result.scalars().all()
    return UserListResponse(items=list(users), total=total, page=page, page_size=page_size)


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Usuario no encontrado", "code": "USER_NOT_FOUND"},
        )

    # Cannot promote anyone to SUPER_ADMIN (only one allowed, created via other means)
    if body.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "No se puede asignar el rol SUPER_ADMIN mediante esta ruta",
                "code": "SUPER_ADMIN_RESTRICTED",
            },
        )

    # Prevent removing SUPER_ADMIN role from the existing super admin
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "No se puede cambiar el rol del SUPER_ADMIN",
                "code": "SUPER_ADMIN_IMMUTABLE",
            },
        )

    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: UUID,
    body: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Usuario no encontrado", "code": "USER_NOT_FOUND"},
        )

    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "No se puede habilitar o deshabilitar una cuenta SUPER_ADMIN",
                "code": "SUPER_ADMIN_IMMUTABLE",
            },
        )

    if user.is_active == body.is_active:
        return user

    user.is_active = body.is_active

    if not body.is_active:
        now = datetime.now(timezone.utc)
        token_result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at == None,
                RefreshToken.expires_at > now,
            )
        )
        active_tokens = token_result.scalars().all()
        for token in active_tokens:
            token.revoked_at = now

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/password-reset", response_model=PasswordResetResult)
async def reset_user_password(
    user_id: UUID,
    body: AdminPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Usuario no encontrado", "code": "USER_NOT_FOUND"},
        )

    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "No se puede restablecer la contraseña de un SUPER_ADMIN desde esta ruta",
                "code": "INVALID_TARGET_ROLE",
            },
        )

    now = datetime.now(timezone.utc)
    token_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at == None,
            RefreshToken.expires_at > now,
        )
    )
    active_tokens = token_result.scalars().all()
    for token in active_tokens:
        token.revoked_at = now

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = True

    audit = AdminPasswordResetAudit(
        target_user_id=user.id,
        actor_user_id=current_user.id,
        reason=body.reason,
        revoked_sessions=len(active_tokens),
    )
    db.add(audit)

    await db.commit()
    return PasswordResetResult(revoked_sessions=len(active_tokens))
