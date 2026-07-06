from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_SECURE: bool = False
    CORS_ORIGINS: str = "http://localhost:3000"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3100"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_ENCRYPTION: str = "ssl"
    SMTP_FROM_EMAIL: str = ""
    # WhatsApp Business Cloud API (Meta) — canal principal de notificaciones
    WHATSAPP_ENABLED: bool = False
    WHATSAPP_DRY_RUN: bool = False
    WHATSAPP_API_VERSION: str = "v21.0"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_DEFAULT_COUNTRY_CODE: str = "591"
    WHATSAPP_TEMPLATE_LANG: str = "es"
    # Nombres de plantillas aprobadas en Meta Business Manager (configurables)
    WHATSAPP_TEMPLATE_OTP: str = "codigo_verificacion"
    WHATSAPP_TEMPLATE_ADMIN_NEW_RESERVATION: str = "admin_nueva_reserva"
    WHATSAPP_TEMPLATE_ADMIN_VOUCHER_UPLOADED: str = "admin_comprobante_subido"
    WHATSAPP_TEMPLATE_RESERVATION_APPROVED: str = "reserva_aprobada"
    WHATSAPP_TEMPLATE_RESERVATION_REJECTED: str = "reserva_rechazada"
    WHATSAPP_TEMPLATE_PAYMENT_RECEIVED: str = "pago_recibido"
    WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED: str = "pago_confirmado"
    # OTP (verificación de cuenta y reset por código)
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_SENDS_PER_HOUR: int = 5
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str = ""
    TRUSTED_HOSTS: str = "*"
    SECURITY_HEADERS_ENABLED: bool = True
    HSTS_ENABLED: bool = False
    HSTS_MAX_AGE: int = 31536000

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def trusted_hosts_list(self) -> List[str]:
        hosts = [h.strip() for h in self.TRUSTED_HOSTS.split(",") if h.strip()]
        return hosts or ["*"]

    @property
    def cookie_samesite_value(self) -> str:
        value = self.COOKIE_SAMESITE.lower().strip()
        if value in {"lax", "strict", "none"}:
            return value
        return "lax"

    @property
    def cookie_domain_value(self) -> str | None:
        return self.COOKIE_DOMAIN.strip() or None

    class Config:
        env_file = ".env"


settings = Settings()
