"""add property video columns

Revision ID: 7ad2df25a544
Revises: db8ff50f85d1
Create Date: 2026-05-09 16:04:04.498917+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '7ad2df25a544'
down_revision: Union[str, None] = 'db8ff50f85d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "properties" not in inspector.get_table_names():
        return

    existing_columns = {c["name"] for c in inspector.get_columns("properties")}
    video_status_enum = sa.Enum('PROCESSING', 'READY', 'FAILED', name='videostatus')
    video_status_enum.create(bind, checkfirst=True)

    if "video_minio_key" not in existing_columns:
        op.add_column('properties', sa.Column('video_minio_key', sa.String(), nullable=True))
    if "video_poster_key" not in existing_columns:
        op.add_column('properties', sa.Column('video_poster_key', sa.String(), nullable=True))
    if "video_status" not in existing_columns:
        op.add_column(
            'properties',
            sa.Column('video_status', video_status_enum, nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "properties" in inspector.get_table_names():
        existing_columns = {c["name"] for c in inspector.get_columns("properties")}
        if "video_status" in existing_columns:
            op.drop_column('properties', 'video_status')
        if "video_poster_key" in existing_columns:
            op.drop_column('properties', 'video_poster_key')
        if "video_minio_key" in existing_columns:
            op.drop_column('properties', 'video_minio_key')
    sa.Enum(name='videostatus').drop(op.get_bind(), checkfirst=True)
