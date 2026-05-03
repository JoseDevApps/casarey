import uuid
import enum
from sqlalchemy import Column, String, Text, Boolean, Numeric, Integer, Time, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CalendarStatus(str, enum.Enum):
    BOOKED = "BOOKED"
    BLOCKED = "BLOCKED"


class Property(Base):
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    address = Column(String)
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))
    checkin_time = Column(Time, nullable=False)
    checkout_time = Column(Time, nullable=False)
    max_guests = Column(Integer, nullable=False)
    rate_adult = Column(Numeric(10, 2), nullable=False)
    rate_child = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PropertyImage(Base):
    __tablename__ = "property_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    minio_key = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)


class PropertyCalendar(Base):
    __tablename__ = "property_calendar"
    # Sparse: only BOOKED or BLOCKED entries. Absence = AVAILABLE.

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # ISO date string YYYY-MM-DD
    status = Column(Enum(CalendarStatus), nullable=False)
    blocked_reason = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint("property_id", "date", name="uq_property_calendar_date"),)
