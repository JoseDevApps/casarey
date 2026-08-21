from pydantic import BaseModel, EmailStr, field_validator
from uuid import UUID
from datetime import datetime
from typing import Literal, Optional, List

from app.models.user import UserRole
from app.utils.phone import normalize_phone_e164


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if not any(char.isupper() for char in value):
        raise ValueError("La contraseña debe tener al menos una letra mayúscula")
    if not any(char.isdigit() for char in value):
        raise ValueError("La contraseña debe tener al menos un número")
    return value


def _validate_phone(value: str) -> str:
    try:
        return normalize_phone_e164(value)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    # Requerido: es el canal principal de notificaciones (WhatsApp).
    # Se persiste ya normalizado en E.164 sin '+' (ej. 59171234567).
    phone: str
    # Canal elegido por el usuario para verificar su cuenta.
    verification_channel: Literal["whatsapp", "email"] = "whatsapp"

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return _validate_phone(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        return _validate_phone(value)


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    is_active: bool
    email_verified: bool
    phone_verified: bool
    # Numero nuevo esperando confirmacion por codigo (None si no hay cambio en curso)
    pending_phone: Optional[str] = None
    must_change_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RegisterResponse(UserResponse):
    # Canal por el que se envió la verificación; el frontend decide el redirect
    verification_channel: Literal["whatsapp", "email"]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


class AdminPasswordResetRequest(BaseModel):
    new_password: str
    reason: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class EmailVerificationRequest(BaseModel):
    token: str


class EmailVerificationResendRequest(BaseModel):
    email: EmailStr
    # Canal preferido para el reenvío; None = usar el default (whatsapp con fallback)
    channel: Optional[Literal["whatsapp", "email"]] = None


class EmailVerificationResult(BaseModel):
    verified: bool


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        value = value.strip()
        if not (value.isdigit() and len(value) == 6):
            raise ValueError("El código debe tener 6 dígitos")
        return value


class ResendVerificationResult(BaseModel):
    channel: Literal["whatsapp", "email"]


class WhatsAppOptinResponse(BaseModel):
    """Enlace click-to-chat: al enviarlo se abre la ventana de servicio de 24 h
    y el webhook responde con el código de verificación."""

    enabled: bool
    link: Optional[str] = None


class ResetPasswordWithCodeRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        value = value.strip()
        if not (value.isdigit() and len(value) == 6):
            raise ValueError("El código debe tener 6 dígitos")
        return value

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    # Canal elegido para recibir el reset; None = whatsapp con fallback a email
    channel: Optional[Literal["whatsapp", "email"]] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class PasswordResetResult(BaseModel):
    revoked_sessions: int


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    page_size: int


class ProfileUpdateRequest(BaseModel):
    """Datos del perfil que el usuario puede editar por si mismo."""

    full_name: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")
        if len(value) > 100:
            raise ValueError("El nombre es demasiado largo")
        return value


class PhoneChangeRequest(BaseModel):
    """Solicitud de cambio de telefono.

    Exige la contrasena actual porque el telefono recibe los codigos de
    recuperacion: sin este control, una sesion robada bastaria para tomar
    la cuenta.
    """

    new_phone: str
    current_password: str

    @field_validator("new_phone")
    @classmethod
    def validate_new_phone(cls, value: str) -> str:
        return _validate_phone(value)


class PhoneChangeResult(BaseModel):
    pending_phone: str
    channel: Literal["whatsapp", "email"]


class VerifyPhoneRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        value = value.strip()
        if not (value.isdigit() and len(value) == 6):
            raise ValueError("El codigo debe tener 6 digitos")
        return value
