import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.exceptions import AppError
from app.routers import (
    auth,
    users,
    properties,
    calendar,
    reservations,
    payments,
    finances,
    cms,
    uploads,
    notification_preferences,
)
from app.services import storage_service

logger = logging.getLogger("app.errors")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure MinIO buckets exist
    try:
        storage_service.ensure_buckets()
    except Exception as e:
        # Non-fatal: log but don't block startup if MinIO is temporarily unavailable
        import logging
        logging.getLogger("uvicorn.error").warning(f"MinIO bucket init failed: {e}")
    yield
    # Shutdown: nothing to clean up


app = FastAPI(title="Casas de Campo API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.trusted_hosts_list != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if settings.SECURITY_HEADERS_ENABLED:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if settings.HSTS_ENABLED:
            response.headers.setdefault(
                "Strict-Transport-Security",
                f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains",
            )
    return response


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(properties.router, prefix="/properties", tags=["properties"])
app.include_router(calendar.router, prefix="/properties", tags=["calendar"])
app.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
app.include_router(payments.router, prefix="/payment-methods", tags=["payments"])
app.include_router(finances.router, prefix="/finances", tags=["finances"])
app.include_router(cms.router, prefix="/cms", tags=["cms"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
app.include_router(
    notification_preferences.router,
    prefix="/notification-preferences",
    tags=["notification-preferences"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    body: dict = {"detail": exc.message, "code": exc.code}
    if exc.details:
        body["fields"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Flatten the legacy {detail: {detail, code}} shape so frontend reads code/detail at top level
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail.get("detail", "Error"),
                "code": exc.detail.get("code", "ERROR"),
            },
            headers=getattr(exc, "headers", None),
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail), "code": "HTTP_ERROR"},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Datos inválidos",
            "code": "VALIDATION_ERROR",
            "fields": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception at %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor", "code": "INTERNAL_ERROR"},
    )


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
