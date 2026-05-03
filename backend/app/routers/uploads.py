import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel

from app.models.user import User
from app.dependencies import get_current_user
from app.services import storage_service


router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB
ALLOWED_BUCKETS = storage_service.PUBLIC_BUCKETS | storage_service.PRIVATE_BUCKETS


class UploadResponse(BaseModel):
    key: str
    url: str


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    bucket: str = Query(default=storage_service.BUCKET_PROPERTY_IMAGES),
    current_user: User = Depends(get_current_user),
):
    if bucket not in ALLOWED_BUCKETS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Bucket no permitido", "code": "INVALID_BUCKET"},
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "Tipo de archivo no permitido", "code": "INVALID_FILE_TYPE"},
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": "El archivo excede 8 MB", "code": "FILE_TOO_LARGE"},
        )

    ext = (
        file.filename.rsplit(".", 1)[-1]
        if file.filename and "." in file.filename
        else "jpg"
    )
    key = f"staging/{uuid.uuid4()}.{ext}"

    storage_service.upload_file(bucket, key, file_bytes, file.content_type)

    if bucket in storage_service.PUBLIC_BUCKETS:
        url = storage_service.get_public_url(bucket, key)
    else:
        url = storage_service.get_presigned_url(bucket, key)

    return UploadResponse(key=key, url=url)
