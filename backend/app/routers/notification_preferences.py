from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.notification import (
    AdminNotificationPreferenceResponse,
    AdminNotificationPreferenceUpdate,
)
from app.services.notification_preferences_service import (
    get_or_create_admin_notification_preferences,
)

router = APIRouter()


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
    return preferences


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
    return preferences
