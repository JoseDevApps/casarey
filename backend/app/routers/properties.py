import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.property import Property, PropertyImage, VideoStatus
from app.schemas.property import (
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    PropertyListResponse,
    PropertyImageResponse,
    PropertyImageReorderRequest,
)
from app.dependencies import get_current_user, require_role
from app.services import storage_service, video_service

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB

# Video upload limits — origen crudo del celular puede ser grande, pero
# 100 MB es el techo: arriba de eso ffmpeg en una VPS modesta puede tardar
# 5+ minutos y bloquear nuevos uploads.
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-matroska"}
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB


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
        rate_adult=body.rate_night_1,
        rate_child=body.rate_child,
        rate_night_1=body.rate_night_1,
        rate_night_2=body.rate_night_2,
        rate_night_3=body.rate_night_3,
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

    if any(key in update_data for key in ("rate_night_1", "rate_night_2", "rate_night_3")):
        prop.rate_adult = prop.rate_night_1

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


@router.delete("/{property_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property_image(
    property_id: UUID,
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    await _get_property_for_owner(property_id, current_user, db)

    image_result = await db.execute(
        select(PropertyImage).where(
            PropertyImage.id == image_id,
            PropertyImage.property_id == property_id,
        )
    )
    image = image_result.scalar_one_or_none()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Imagen no encontrada", "code": "IMAGE_NOT_FOUND"},
        )

    storage_service.delete_file(storage_service.BUCKET_PROPERTY_IMAGES, image.minio_key)
    await db.delete(image)
    await db.commit()


@router.patch("/{property_id}/images/reorder", response_model=list[PropertyImageResponse])
async def reorder_property_images(
    property_id: UUID,
    body: PropertyImageReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    await _get_property_for_owner(property_id, current_user, db)

    if len(set(body.image_ids)) != len(body.image_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Hay imágenes repetidas en el orden", "code": "INVALID_IMAGE_ORDER"},
        )

    images_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
    )
    images = images_result.scalars().all()

    existing_ids = {img.id for img in images}
    requested_ids = set(body.image_ids)
    if existing_ids != requested_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Debes enviar todas las imágenes de la propiedad", "code": "INVALID_IMAGE_ORDER"},
        )

    image_by_id = {img.id: img for img in images}
    for idx, image_id in enumerate(body.image_ids):
        image_by_id[image_id].sort_order = idx

    await db.commit()

    refreshed_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
    )
    refreshed_images = refreshed_result.scalars().all()

    return [
        PropertyImageResponse(
            id=img.id,
            property_id=img.property_id,
            minio_key=img.minio_key,
            sort_order=img.sort_order,
            url=storage_service.get_public_url(storage_service.BUCKET_PROPERTY_IMAGES, img.minio_key),
        )
        for img in refreshed_images
    ]


# ─────────────────────────  VIDEO  ─────────────────────────

async def _get_property_for_owner(
    property_id: UUID, current_user: User, db: AsyncSession
) -> Property:
    """Fetches a property and asserts the caller may modify it."""
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
    return prop


@router.post(
    "/{property_id}/video",
    response_model=PropertyResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_property_video(
    property_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Uploads a raw video and queues it for transcoding.

    Returns immediately with `video_status=PROCESSING`. The frontend should
    poll `GET /properties/{id}` until the status flips to `READY` (typically
    a few seconds for short clips, up to a minute for ~50 MB phone-shot
    originals)."""
    prop = await _get_property_for_owner(property_id, current_user, db)

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "Tipo de video no permitido (mp4, mov, webm, mkv)",
                "code": "INVALID_FILE_TYPE",
            },
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "El video excede 100 MB. Comprime el video antes de subirlo.",
                "code": "FILE_TOO_LARGE",
            },
        )

    # Eliminar artefactos del video anterior (si existían) para no acumular
    # basura en MinIO.
    for old_key in (prop.video_minio_key, prop.video_poster_key):
        if old_key:
            storage_service.delete_file(storage_service.BUCKET_PROPERTY_VIDEOS, old_key)

    # Subir el original crudo a un bucket privado de staging. La key incluye
    # un UUID para que dos uploads simultáneos no se pisen.
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    raw_key = f"raw/{property_id}/{uuid.uuid4()}.{ext}"
    storage_service.upload_file(
        storage_service.BUCKET_PROPERTY_VIDEOS_RAW,
        raw_key,
        file_bytes,
        file.content_type,
    )

    # Marcar el property como PROCESSING. Los keys se setearán cuando la
    # background task termine (READY) o se quedará así si falla (FAILED).
    prop.video_status = VideoStatus.PROCESSING
    prop.video_minio_key = None
    prop.video_poster_key = None
    await db.commit()
    await db.refresh(prop)

    # Encola la transcodificación. FastAPI la ejecuta DESPUÉS de devolver
    # la respuesta — el admin no espera 30s mirando un spinner.
    background_tasks.add_task(
        video_service.transcode_property_video, property_id, raw_key
    )

    img_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
    )
    images = img_result.scalars().all()
    return _build_property_response(prop, images)


@router.delete(
    "/{property_id}/video",
    response_model=PropertyResponse,
)
async def delete_property_video(
    property_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Removes the video and its poster, freeing the bucket entries."""
    prop = await _get_property_for_owner(property_id, current_user, db)

    for old_key in (prop.video_minio_key, prop.video_poster_key):
        if old_key:
            storage_service.delete_file(storage_service.BUCKET_PROPERTY_VIDEOS, old_key)

    prop.video_minio_key = None
    prop.video_poster_key = None
    prop.video_status = None
    await db.commit()
    await db.refresh(prop)

    img_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
    )
    images = img_result.scalars().all()
    return _build_property_response(prop, images)
