import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class AdminNotificationPreference(Base):
    __tablename__ = "admin_notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    notification_email = Column(String, nullable=True)
    notification_phone = Column(String, nullable=True)

    client_approved_subject = Column(String, nullable=False)
    client_approved_body = Column(Text, nullable=False)
    client_rejected_subject = Column(String, nullable=False)
    client_rejected_body = Column(Text, nullable=False)
    client_payment_received_subject = Column(String, nullable=False)
    client_payment_received_body = Column(Text, nullable=False)
    client_payment_confirmed_subject = Column(String, nullable=False)
    client_payment_confirmed_body = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
