from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from app.models.reservation import ReservationStatus


class ReservationCreate(BaseModel):
    property_id: UUID
    check_in_date: str   # YYYY-MM-DD
    check_out_date: str  # YYYY-MM-DD
    num_adults: int
    num_children: int = 0


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
    total_amount: Decimal
    status: ReservationStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
