"""Video transcoding service.

The admin uploads a raw clip from their phone (could be 100 MB MOV/MP4).
We can't serve that to the public — burns mobile data, kills LCP, and the
VPS bandwidth would melt under any reasonable concurrent load.

This service runs as a FastAPI BackgroundTask. Pipeline:

  1. Download raw video from `property-videos-raw` (private staging bucket).
  2. Run ffmpeg twice:
     - transcode → 720p MP4 H.264, ~3-5 MB for 30s, +faststart so the HTML5
       <video> element can start playing before the file fully downloads.
     - extract a JPEG poster from second 1 (frame 0 is often black on
       phone-recorded clips because of fade-in).
  3. Upload the two outputs to the public `property-videos` bucket.
  4. Update the Property row: minio keys + status=READY.
  5. Cleanup: delete the raw upload and the local temp directory.

Failure path: status=FAILED, raw is left in the private bucket so an
operator can investigate. The admin can retry by uploading a new file.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.property import Property, VideoStatus
from app.services import storage_service

logger = logging.getLogger(__name__)

# H.264 preset/quality. CRF 24 ≈ ~3-5 MB for a 30s 720p clip on phone-recorded
# input. Lower CRF = better quality but larger file. 23-26 is the visually
# lossless sweet spot.
TARGET_HEIGHT = 720
TARGET_CRF = 24
TARGET_PRESET = "medium"
TARGET_AUDIO_BITRATE = "96k"
POSTER_SECOND = 1


def _run_ffmpeg(args: list[str]) -> None:
    """Runs ffmpeg synchronously. Raises on non-zero exit."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *args]
    logger.info("ffmpeg: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()[:500]}")


def _transcode_to_mp4(input_path: str, output_path: str) -> None:
    """720p H.264 + AAC, faststart for progressive streaming.

    `scale='min(1280,iw)':'-2'` keeps original aspect, downscales when
    larger than 1280 wide, and rounds height to a multiple of 2 (H.264
    requirement). Vertical phone clips end up ~720px tall, which is fine.
    """
    _run_ffmpeg([
        "-i", input_path,
        "-c:v", "libx264",
        "-preset", TARGET_PRESET,
        "-crf", str(TARGET_CRF),
        "-vf", f"scale='min(1280,iw)':'min({TARGET_HEIGHT},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:a", "aac",
        "-b:a", TARGET_AUDIO_BITRATE,
        "-movflags", "+faststart",
        output_path,
    ])


def _extract_poster(input_path: str, output_path: str) -> None:
    _run_ffmpeg([
        "-ss", str(POSTER_SECOND),
        "-i", input_path,
        "-frames:v", "1",
        "-vf", "scale='min(1280,iw)':-2",
        "-q:v", "3",  # JPEG quality (2-5 is good range)
        output_path,
    ])


async def _set_status(
    property_id: UUID,
    status: VideoStatus,
    *,
    video_key: str | None = None,
    poster_key: str | None = None,
) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Property).where(Property.id == property_id))
        prop = result.scalar_one_or_none()
        if not prop:
            return
        prop.video_status = status
        if video_key is not None:
            prop.video_minio_key = video_key
        if poster_key is not None:
            prop.video_poster_key = poster_key
        await db.commit()


async def transcode_property_video(property_id: UUID, raw_key: str) -> None:
    """BackgroundTask entrypoint. Catches all errors and marks FAILED."""
    try:
        with tempfile.TemporaryDirectory(prefix="video_") as tmp:
            input_path = os.path.join(tmp, "input.bin")
            mp4_path = os.path.join(tmp, "out.mp4")
            poster_path = os.path.join(tmp, "poster.jpg")

            # Download raw — synchronous boto3 in a thread so we don't block
            # the asyncio loop.
            def _download() -> None:
                client = storage_service._get_client()
                client.download_file(
                    storage_service.BUCKET_PROPERTY_VIDEOS_RAW, raw_key, input_path
                )

            await asyncio.to_thread(_download)

            # Transcode + poster (CPU-bound, run in thread)
            await asyncio.to_thread(_transcode_to_mp4, input_path, mp4_path)
            await asyncio.to_thread(_extract_poster, input_path, poster_path)

            # Upload outputs to public bucket
            mp4_key = f"properties/{property_id}/video.mp4"
            poster_key = f"properties/{property_id}/poster.jpg"

            with open(mp4_path, "rb") as f:
                mp4_bytes = f.read()
            with open(poster_path, "rb") as f:
                poster_bytes = f.read()

            await asyncio.to_thread(
                storage_service.upload_file,
                storage_service.BUCKET_PROPERTY_VIDEOS,
                mp4_key,
                mp4_bytes,
                "video/mp4",
            )
            await asyncio.to_thread(
                storage_service.upload_file,
                storage_service.BUCKET_PROPERTY_VIDEOS,
                poster_key,
                poster_bytes,
                "image/jpeg",
            )

            await _set_status(
                property_id,
                VideoStatus.READY,
                video_key=mp4_key,
                poster_key=poster_key,
            )

            # Cleanup raw
            await asyncio.to_thread(
                storage_service.delete_file,
                storage_service.BUCKET_PROPERTY_VIDEOS_RAW,
                raw_key,
            )

            logger.info("Transcode complete for property %s", property_id)

    except Exception:
        logger.exception("Transcode failed for property %s", property_id)
        await _set_status(property_id, VideoStatus.FAILED)
