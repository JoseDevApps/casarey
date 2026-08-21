import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class OtpPurpose(str, enum.Enum):
    VERIFY_ACCOUNT = "VERIFY_ACCOUNT"
    PASSWORD_RESET = "PASSWORD_RESET"
    VERIFY_PHONE = "VERIFY_PHONE"


class OtpCode(Base):
    """Código OTP de 6 dígitos enviado por WhatsApp (o email como respaldo).

    Mismo patrón que PasswordResetToken, con `attempts` para quemar el código
    tras demasiados intentos y `purpose` para separar verificación de reset.
    """

    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purpose = Column(Enum(OtpPurpose), nullable=False, index=True)
    code_hash = Column(String, nullable=False)
    channel = Column(String, nullable=False)  # "whatsapp" | "email"
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
