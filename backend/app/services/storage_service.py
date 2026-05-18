import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.core.config import settings

BUCKET_PROPERTY_IMAGES = "property-images"
BUCKET_PROPERTY_VIDEOS = "property-videos"
BUCKET_PROPERTY_VIDEOS_RAW = "property-videos-raw"
BUCKET_PAYMENT_METHODS = "payment-methods"
BUCKET_PAYMENT_VOUCHERS = "payment-vouchers"

PUBLIC_BUCKETS = {BUCKET_PROPERTY_IMAGES, BUCKET_PROPERTY_VIDEOS, BUCKET_PAYMENT_METHODS}
PRIVATE_BUCKETS = {BUCKET_PROPERTY_VIDEOS_RAW, BUCKET_PAYMENT_VOUCHERS}


def _get_client():
    protocol = "https" if settings.MINIO_SECURE else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{protocol}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_buckets():
    """Creates required buckets on startup if they don't exist."""
    client = _get_client()

    all_buckets = [
        BUCKET_PROPERTY_IMAGES,
        BUCKET_PROPERTY_VIDEOS,
        BUCKET_PROPERTY_VIDEOS_RAW,
        BUCKET_PAYMENT_METHODS,
        BUCKET_PAYMENT_VOUCHERS,
    ]
    for bucket in all_buckets:
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as e:
            error_code = int(e.response["Error"]["Code"])
            if error_code == 404:
                client.create_bucket(Bucket=bucket)
            else:
                raise

    # Set public-read policy on public buckets
    import json

    for bucket in PUBLIC_BUCKETS:
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        try:
            client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
        except ClientError:
            pass  # MinIO may handle this differently; non-fatal


def upload_file(bucket: str, key: str, file_bytes: bytes, content_type: str) -> str:
    """Uploads file to MinIO bucket. Returns the key."""
    client = _get_client()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key


def delete_file(bucket: str, key: str):
    """Deletes a file from MinIO bucket."""
    client = _get_client()
    try:
        client.delete_object(Bucket=bucket, Key=key)
    except ClientError as e:
        error_code = int(e.response["Error"]["Code"])
        if error_code != 404:
            raise


def get_presigned_url(bucket: str, key: str, expires: int = 3600) -> str:
    """Generates a presigned URL for private file access."""
    client = _get_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
    return url


def get_public_url(bucket: str, key: str) -> str:
    """Returns the public URL for a file in a public bucket."""
    protocol = "https" if settings.MINIO_SECURE else "http"
    return f"{protocol}://{settings.MINIO_ENDPOINT}/{bucket}/{key}"
