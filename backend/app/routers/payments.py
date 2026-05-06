from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.payment import PaymentMethod
from app.schemas.payment import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    PaymentMethodResponse,
    PaymentMethodListResponse,
)
from app.dependencies import get_current_user, require_role
from app.services import payment_service, storage_service

router = APIRouter()


def _build_method_response(method: PaymentMethod) -> PaymentMethodResponse:
    image_url = None
    if method.minio_key:
        image_url = storage_service.get_public_url(
            storage_service.BUCKET_PAYMENT_METHODS, method.minio_key
        )
    return PaymentMethodResponse(
        id=method.id,
        owner_id=method.owner_id,
        name=method.name,
        description=method.description,
        minio_key=method.minio_key,
        is_active=method.is_active,
        image_url=image_url,
    )


@router.get("", response_model=PaymentMethodListResponse)
async def list_payment_methods(
    owner_id: Optional[UUID] = Query(
        None, description="If omitted, returns the authenticated admin's own methods."
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List payment methods.

    - When `owner_id` is omitted: caller must be ADMIN/SUPER_ADMIN; returns
      all of their methods (active + inactive) so they can manage them.
    - When `owner_id` is supplied: returns only active methods of that
      owner. Used by clients during the reservation payment flow.
    - Owners (or super admins) querying their own `owner_id` get the full
      list including inactive ones.
    """
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

    if owner_id is None:
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "Solo administradores pueden listar sus propios métodos", "code": "FORBIDDEN"},
            )
        target_owner_id = current_user.id
        include_inactive = True
    else:
        target_owner_id = owner_id
        include_inactive = (
            current_user.role == UserRole.SUPER_ADMIN
            or (is_admin and str(current_user.id) == str(owner_id))
        )

    query = select(PaymentMethod).where(PaymentMethod.owner_id == target_owner_id)
    if not include_inactive:
        query = query.where(PaymentMethod.is_active == True)

    result = await db.execute(query)
    methods = result.scalars().all()
    return PaymentMethodListResponse(
        items=[_build_method_response(m) for m in methods], total=len(methods)
    )


@router.post("", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    body: PaymentMethodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    method = PaymentMethod(
        owner_id=current_user.id,
        name=body.name,
        description=body.description,
    )
    db.add(method)
    await db.commit()
    await db.refresh(method)
    return _build_method_response(method)


@router.put("/{method_id}", response_model=PaymentMethodResponse)
async def update_payment_method(
    method_id: UUID,
    body: PaymentMethodUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.id == method_id))
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Método de pago no encontrado", "code": "NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(method.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(method, field, value)

    await db.commit()
    await db.refresh(method)
    return _build_method_response(method)


@router.delete("/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_method(
    method_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.id == method_id))
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Método de pago no encontrado", "code": "NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(method.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso", "code": "FORBIDDEN"},
        )

    # Delete associated image if present
    if method.minio_key:
        storage_service.delete_file(storage_service.BUCKET_PAYMENT_METHODS, method.minio_key)

    await db.delete(method)
    await db.commit()


@router.post("/{method_id}/image", response_model=PaymentMethodResponse)
async def upload_method_image(
    method_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    method = await payment_service.upload_payment_method_image(
        db=db,
        payment_method_id=str(method_id),
        owner_id=str(current_user.id),
        file=file,
    )
    await db.commit()
    await db.refresh(method)
    return _build_method_response(method)
