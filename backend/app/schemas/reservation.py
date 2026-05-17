from pydantic import BaseModel, computed_field
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from app.models.reservation import ReservationStatus


class ApproveRequest(BaseModel):
    discount_amount: Decimal = Decimal(0)


class ReservationCreate(BaseModel):
    property_id: UUID
    check_in_date: str   # YYYY-MM-DD
    check_out_date: str  # YYYY-MM-DD
    num_adults: int
    num_children: int = 0


class ReservationPropertySummary(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    address: Optional[str] = None
    image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ReservationResponse(BaseModel):
    id: UUID
    property_id: UUID
    client_id: UUID
    check_in_date: str
    check_out_date: str
    num_adults: int
    num_children: int
    snapshot_rate_adult: Decimal
    snapshot_rate_child: Decimal
    snapshot_nightly_rate: Decimal
    snapshot_pricing_tier: int
    total_amount: Decimal
    discount_amount: Decimal = Decimal(0)
    status: ReservationStatus
    created_at: datetime
    updated_at: datetime
    property: Optional[ReservationPropertySummary] = None

    model_config = {"from_attributes": True}

    @computed_field
    def final_amount(self) -> Decimal:
        return self.total_amount - self.discount_amount


class ReservationListResponse(BaseModel):
    items: List[ReservationResponse]
    total: int
    page: int
    page_size: int


class BookingGuestCreate(BaseModel):
    full_name: str
    id_number: str
    phone: Optional[str] = None


class BookingGuestResponse(BaseModel):
    id: UUID
    reservation_id: UUID
    full_name: str
    id_number: str
    phone: Optional[str]

    model_config = {"from_attributes": True}


class GuestListResponse(BaseModel):
    items: List[BookingGuestResponse]
    total: int
