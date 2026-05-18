import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.cms import CmsBanner, CmsStaticPage, CmsFeaturedProperty
from app.models.property import Property, PropertyImage
from app.schemas.cms import (
    CmsBannerCreate,
    CmsBannerUpdate,
    CmsBannerResponse,
    CmsBannerListResponse,
    CmsStaticPageUpdate,
    CmsStaticPageResponse,
    CmsFeaturedPropertyCreate,
    CmsFeaturedPropertyResponse,
    CmsFeaturedListResponse,
    CmsFeaturedWithPropertyResponse,
)
from app.dependencies import require_role
from app.routers.properties import _build_property_response
from app.services import storage_service

router = APIRouter()

ALLOWED_BANNER_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BANNER_SIZE = 8 * 1024 * 1024  # 8 MB


def _banner_response(banner: CmsBanner) -> CmsBannerResponse:
    image_url = None
    if banner.minio_key:
        image_url = storage_service.get_public_url(
            storage_service.BUCKET_PROPERTY_IMAGES, banner.minio_key
        )
    return CmsBannerResponse(
        id=banner.id,
        title=banner.title,
        subtitle=banner.subtitle,
        minio_key=banner.minio_key,
        is_visible=banner.is_visible,
        sort_order=banner.sort_order,
        image_url=image_url,
    )


# ---- BANNERS ----

@router.get("/banners", response_model=CmsBannerListResponse)
async def list_banners(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CmsBanner).order_by(CmsBanner.sort_order, CmsBanner.id)
    )
    banners = result.scalars().all()
    return CmsBannerListResponse(items=[_banner_response(b) for b in banners], total=len(banners))


@router.post("/banners", response_model=CmsBannerResponse, status_code=status.HTTP_201_CREATED)
async def create_banner(
    body: CmsBannerCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    banner = CmsBanner(
        title=body.title,
        subtitle=body.subtitle,
        minio_key=body.minio_key,
        is_visible=body.is_visible,
        sort_order=body.sort_order,
    )
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return _banner_response(banner)


@router.put("/banners/{banner_id}", response_model=CmsBannerResponse)
async def update_banner(
    banner_id: UUID,
    body: CmsBannerUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(CmsBanner).where(CmsBanner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Banner no encontrado", "code": "NOT_FOUND"},
        )
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(banner, field, value)
    await db.commit()
    await db.refresh(banner)
    return _banner_response(banner)


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_banner(
    banner_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(CmsBanner).where(CmsBanner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Banner no encontrado", "code": "NOT_FOUND"},
        )
    if banner.minio_key:
        storage_service.delete_file(storage_service.BUCKET_PROPERTY_IMAGES, banner.minio_key)
    await db.delete(banner)
    await db.commit()


@router.post("/banners/{banner_id}/image", response_model=CmsBannerResponse)
async def upload_banner_image(
    banner_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(CmsBanner).where(CmsBanner.id == banner_id))
    banner = result.scalar_one_or_none()
    if not banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Banner no encontrado", "code": "NOT_FOUND"},
        )

    if file.content_type not in ALLOWED_BANNER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Tipo de imagen no permitido", "code": "INVALID_FILE_TYPE"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_BANNER_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "La imagen excede 8 MB", "code": "FILE_TOO_LARGE"},
        )

    if banner.minio_key:
        storage_service.delete_file(storage_service.BUCKET_PROPERTY_IMAGES, banner.minio_key)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    key = f"banners/{banner_id}/{uuid.uuid4()}.{ext}"
    storage_service.upload_file(
        storage_service.BUCKET_PROPERTY_IMAGES, key, file_bytes, file.content_type
    )

    banner.minio_key = key
    await db.commit()
    await db.refresh(banner)
    return _banner_response(banner)


# ---- STATIC PAGES ----

@router.get("/pages/{slug}", response_model=CmsStaticPageResponse)
async def get_page(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CmsStaticPage).where(CmsStaticPage.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Página no encontrada", "code": "NOT_FOUND"},
        )
    return page


@router.put("/pages/{slug}", response_model=CmsStaticPageResponse)
async def upsert_page(
    slug: str,
    body: CmsStaticPageUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(select(CmsStaticPage).where(CmsStaticPage.slug == slug))
    page = result.scalar_one_or_none()
    if page:
        page.content = body.content
    else:
        page = CmsStaticPage(slug=slug, content=body.content)
        db.add(page)
    await db.commit()
    await db.refresh(page)
    return page


# ---- FEATURED PROPERTIES ----

@router.get("/featured", response_model=CmsFeaturedListResponse)
async def list_featured(db: AsyncSession = Depends(get_db)):
    # Get featured properties with their property data
    result = await db.execute(
        select(CmsFeaturedProperty, Property)
        .join(Property, CmsFeaturedProperty.property_id == Property.id)
        .order_by(CmsFeaturedProperty.sort_order)
    )
    rows = result.all()

    # Load images for all featured properties
    property_ids = [prop.id for _, prop in rows]
    images_result = await db.execute(
        select(PropertyImage)
        .where(PropertyImage.property_id.in_(property_ids))
        .order_by(PropertyImage.sort_order)
    )
    all_images = images_result.scalars().all()
    images_by_property: dict[UUID, list[PropertyImage]] = {}
    for img in all_images:
        images_by_property.setdefault(img.property_id, []).append(img)

    items = [
        CmsFeaturedWithPropertyResponse(
            property=_build_property_response(prop, images_by_property.get(prop.id, [])),
            sort_order=fp.sort_order,
        )
        for fp, prop in rows
    ]
    return CmsFeaturedListResponse(items=items, total=len(items))


@router.post("/featured", response_model=CmsFeaturedPropertyResponse, status_code=status.HTTP_201_CREATED)
async def add_featured(
    body: CmsFeaturedPropertyCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    # Check if already featured
    result = await db.execute(
        select(CmsFeaturedProperty).where(CmsFeaturedProperty.property_id == body.property_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "La propiedad ya está destacada", "code": "ALREADY_FEATURED"},
        )

    featured = CmsFeaturedProperty(property_id=body.property_id, sort_order=body.sort_order)
    db.add(featured)
    await db.commit()
    await db.refresh(featured)
    return featured


@router.delete("/featured/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_featured(
    property_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    result = await db.execute(
        select(CmsFeaturedProperty).where(CmsFeaturedProperty.property_id == property_id)
    )
    featured = result.scalar_one_or_none()
    if not featured:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Propiedad no encontrada en destacados", "code": "NOT_FOUND"},
        )
    await db.delete(featured)
    await db.commit()
