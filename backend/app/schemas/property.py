from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from typing import Optional, List


class PropertyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    checkin_time: time
    checkout_time: time
    max_guests: int
    rate_adult: Decimal
    rate_child: Decimal
    image_keys: List[str] = []


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    checkin_time: Optional[time] = None
    checkout_time: Optional[time] = None
    max_guests: Optional[int] = None
    rate_adult: Optional[Decimal] = None
    rate_child: Optional[Decimal] = None
    is_active: Optional[bool] = None


class PropertyImageResponse(BaseModel):
    id: UUID
    property_id: UUID
    minio_key: str
    sort_order: int
    url: Optional[str] = None

    model_config = {"from_attributes": True}


class PropertyResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: Optional[str]
    address: Optional[str]
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]
    checkin_time: time
    checkout_time: time
    max_guests: int
    rate_adult: Decimal
    rate_child: Decimal
    is_active: bool
    created_at: datetime
    images: List[PropertyImageResponse] = []

    model_config = {"from_attributes": True}


class PropertyListResponse(BaseModel):
    items: List[PropertyResponse]
    total: int
    page: int
    page_size: int


class CalendarEntryResponse(BaseModel):
    date: str
    status: str
    blocked_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class CalendarMonthResponse(BaseModel):
    property_id: UUID
    year: int
    month: int
    entries: List[CalendarEntryResponse]


class BlockDatesRequest(BaseModel):
    dates: List[str]  # List of YYYY-MM-DD strings
    reason: Optional[str] = None
