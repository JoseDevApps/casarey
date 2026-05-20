from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User, UserRole
from uuid import UUID


async def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "No autenticado", "code": "NOT_AUTHENTICATED"},
        )
    payload = verify_token(access_token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Token inválido", "code": "INVALID_TOKEN"},
        )
    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Usuario no encontrado", "code": "USER_NOT_FOUND"},
        )
    return user


async def get_current_user_optional(
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not access_token:
        return None
    payload = verify_token(access_token)
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    return result.scalar_one_or_none()


def require_role(*roles: UserRole):
    async def check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "Permisos insuficientes", "code": "INSUFFICIENT_PERMISSIONS"},
            )
        return current_user

    return check_role
