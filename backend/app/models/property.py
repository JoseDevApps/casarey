import uuid
import enum
from sqlalchemy import Column, String, Text, Boolean, Numeric, Integer, Time, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CalendarStatus(str, enum.Enum):
    BOOKED = "BOOKED"
    BLOCKED = "BLOCKED"


class VideoStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


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
    rate_night_1 = Column(Numeric(10, 2), nullable=False)
    rate_night_2 = Column(Numeric(10, 2), nullable=False)
    rate_night_3 = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Video opcional por propiedad. Pipeline:
    # admin sube → video_status=PROCESSING → background ffmpeg → video_status=READY
    video_minio_key = Column(String, nullable=True)
    video_poster_key = Column(String, nullable=True)
    video_status = Column(Enum(VideoStatus), nullable=True)


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
