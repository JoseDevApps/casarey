import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.property import Property, PropertyImage
from app.schemas.property import (
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    PropertyListResponse,
    PropertyImageResponse,
)
from app.dependencies import get_current_user, require_role
from app.services import storage_service

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB


def _build_property_response(prop: Property, images: list[PropertyImage]) -> PropertyResponse:
    image_responses = []
    for img in images:
        url = storage_service.get_public_url(storage_service.BUCKET_PROPERTY_IMAGES, img.minio_key)
        image_responses.append(
            PropertyImageResponse(
                id=img.id,
                property_id=img.property_id,
                minio_key=img.minio_key,
                sort_order=img.sort_order,
                url=url,
            )
        )
    data = PropertyResponse.model_validate(prop)
    data.images = image_responses
    return data


@router.get("", response_model=PropertyListResponse)
async def list_properties(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size

    count_result = await db.execute(
        select(func.count()).select_from(Property).where(Property.is_active == True)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Property)
        .where(Property.is_active == True)
        .order_by(Property.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    properties = result.scalars().all()

    items = []
    for prop in properties:
        img_result = await db.execute(
            select(PropertyImage)
            .where(PropertyImage.property_id == prop.id)
            .order_by(PropertyImage.sort_order)
        )
        images = img_result.scalars().all()
        items.append(_build_property_response(prop, images))

    return PropertyListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
async def create_property(
    body: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    prop = Property(
        owner_id=current_user.id,
        name=body.name,
        description=body.description,
        address=body.address,
        latitude=body.latitude,
        longitude=body.longitude,
        checkin_time=body.checkin_time,
        checkout_time=body.checkout_time,
        max_guests=body.max_guests,
        rate_adult=body.rate_adult,
        rate_child=body.rate_child,
    )
    db.add(prop)
    await db.flush()

    images: list[PropertyImage] = []
    for idx, key in enumerate(body.image_keys):
        img = PropertyImage(property_id=prop.id, minio_key=key, sort_order=idx)
        db.add(img)
        images.append(img)

    await db.commit()
    await db.refresh(prop)
    for img in images:
        await db.refresh(img)
    return _build_property_response(prop, images)


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Property).where(Property.id == property_id, Property.is_active == True)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )
    img_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == prop.id)
        .order_by(PropertyImage.sort_order)
    )
    images = img_result.scalars().all()
    return _build_property_response(prop, images)


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    body: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    # Admins can only update their own properties; super admin can update any
    if current_user.role == UserRole.ADMIN and str(prop.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso para esta propiedad", "code": "FORBIDDEN"},
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prop, field, value)

    await db.commit()
    await db.refresh(prop)

    img_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == prop.id)
        .order_by(PropertyImage.sort_order)
    )
    images = img_result.scalars().all()
    return _build_property_response(prop, images)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(prop.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso para esta propiedad", "code": "FORBIDDEN"},
        )

    prop.is_active = False
    await db.commit()


@router.post("/{property_id}/images", response_model=PropertyImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_property_image(
    property_id: UUID,
    file: UploadFile = File(...),
    sort_order: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada", "code": "PROPERTY_NOT_FOUND"},
        )

    if current_user.role == UserRole.ADMIN and str(prop.owner_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "No tienes permiso para esta propiedad", "code": "FORBIDDEN"},
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Tipo de imagen no permitido", "code": "INVALID_FILE_TYPE"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "La imagen excede 8 MB", "code": "FILE_TOO_LARGE"},
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    key = f"properties/{property_id}/{uuid.uuid4()}.{ext}"

    storage_service.upload_file(
        storage_service.BUCKET_PROPERTY_IMAGES, key, file_bytes, file.content_type
    )

    image = PropertyImage(property_id=property_id, minio_key=key, sort_order=sort_order)
    db.add(image)
    await db.commit()
    await db.refresh(image)

    url = storage_service.get_public_url(storage_service.BUCKET_PROPERTY_IMAGES, key)
    return PropertyImageResponse(
        id=image.id,
        property_id=image.property_id,
        minio_key=image.minio_key,
        sort_order=image.sort_order,
        url=url,
    )
