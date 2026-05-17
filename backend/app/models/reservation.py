import uuid
import enum
from sqlalchemy import Column, String, Integer, Numeric, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class ReservationStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED_WAITING_PAYMENT = "APPROVED_WAITING_PAYMENT"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    check_in_date = Column(String, nullable=False)   # YYYY-MM-DD
    check_out_date = Column(String, nullable=False)  # YYYY-MM-DD (exclusive)
    num_adults = Column(Integer, nullable=False)
    num_children = Column(Integer, default=0)
    snapshot_rate_adult = Column(Numeric(10, 2), nullable=False)
    snapshot_rate_child = Column(Numeric(10, 2), nullable=False)
    snapshot_nightly_rate = Column(Numeric(10, 2), nullable=False)
    snapshot_pricing_tier = Column(Integer, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0, nullable=False)
    status = Column(Enum(ReservationStatus), nullable=False, default=ReservationStatus.PENDING_APPROVAL)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BookingGuest(Base):
    __tablename__ = "booking_guests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reservation_id = Column(UUID(as_uuid=True), ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String, nullable=False)
    id_number = Column(String, nullable=False)
    phone = Column(String)
