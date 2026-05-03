from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class PaymentMethodCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PaymentMethodResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: Optional[str]
    minio_key: Optional[str]
    is_active: bool
    image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class PaymentMethodListResponse(BaseModel):
    items: List[PaymentMethodResponse]
    total: int


class PaymentVoucherResponse(BaseModel):
    id: UUID
    reservation_id: UUID
    minio_key: str
    uploaded_at: datetime
    url: Optional[str] = None

    model_config = {"from_attributes": True}
