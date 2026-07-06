from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.phone import normalize_phone_e164


class AdminNotificationPreferenceUpdate(BaseModel):
    notification_email: Optional[EmailStr] = None
    notification_phone: Optional[str] = None
    client_approved_subject: str = Field(min_length=3, max_length=200)
    client_approved_body: str = Field(min_length=10, max_length=5000)
    client_rejected_subject: str = Field(min_length=3, max_length=200)
    client_rejected_body: str = Field(min_length=10, max_length=5000)
    client_payment_received_subject: str = Field(min_length=3, max_length=200)
    client_payment_received_body: str = Field(min_length=10, max_length=5000)
    client_payment_confirmed_subject: str = Field(min_length=3, max_length=200)
    client_payment_confirmed_body: str = Field(min_length=10, max_length=5000)

    @field_validator(
        "client_approved_subject",
        "client_approved_body",
        "client_rejected_subject",
        "client_rejected_body",
        "client_payment_received_subject",
        "client_payment_received_body",
        "client_payment_confirmed_subject",
        "client_payment_confirmed_body",
        mode="before",
    )
    @classmethod
    def _strip_required_text(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("notification_email", mode="before")
    @classmethod
    def _normalize_optional_email(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("notification_phone")
    @classmethod
    def _normalize_optional_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        return normalize_phone_e164(str(value))


class AdminNotificationPreferenceResponse(BaseModel):
    id: UUID
    owner_id: UUID
    notification_email: Optional[str]
    notification_phone: Optional[str] = None
    # Solo lectura, inyectados desde settings en el router (no persistidos)
    whatsapp_enabled: bool = False
    whatsapp_templates: Dict[str, str] = {}
    client_approved_subject: str
    client_approved_body: str
    client_rejected_subject: str
    client_rejected_body: str
    client_payment_received_subject: str
    client_payment_received_body: str
    client_payment_confirmed_subject: str
    client_payment_confirmed_body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
