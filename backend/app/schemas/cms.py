from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List

from app.schemas.property import PropertyResponse

from app.schemas.property import PropertyResponse


class CmsBannerCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    minio_key: Optional[str] = None
    is_visible: bool = True
    sort_order: int = 0


class CmsBannerUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    minio_key: Optional[str] = None
    is_visible: Optional[bool] = None
    sort_order: Optional[int] = None


class CmsBannerResponse(BaseModel):
    id: UUID
    title: str
    subtitle: Optional[str]
    minio_key: Optional[str]
    is_visible: bool
    sort_order: int
    image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CmsBannerListResponse(BaseModel):
    items: List[CmsBannerResponse]
    total: int


class CmsStaticPageUpdate(BaseModel):
    content: str


class CmsStaticPageResponse(BaseModel):
    id: UUID
    slug: str
    content: str
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CmsFeaturedPropertyCreate(BaseModel):
    property_id: UUID
    sort_order: int = 0


class CmsFeaturedPropertyResponse(BaseModel):
    property_id: UUID
    sort_order: int

    model_config = {"from_attributes": True}


class CmsFeaturedWithPropertyResponse(BaseModel):
    property: PropertyResponse
    sort_order: int


class CmsFeaturedListResponse(BaseModel):
    items: List[CmsFeaturedWithPropertyResponse]
    total: int
