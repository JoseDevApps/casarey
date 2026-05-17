"""add property video columns

Revision ID: 7ad2df25a544
Revises: db8ff50f85d1
Create Date: 2026-05-09 16:04:04.498917+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ad2df25a544'
down_revision: Union[str, None] = 'db8ff50f85d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    video_status_enum = sa.Enum('PROCESSING', 'READY', 'FAILED', name='videostatus')
    video_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('properties', sa.Column('video_minio_key', sa.String(), nullable=True))
    op.add_column('properties', sa.Column('video_poster_key', sa.String(), nullable=True))
    op.add_column(
        'properties',
        sa.Column('video_status', video_status_enum, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('properties', 'video_status')
    op.drop_column('properties', 'video_poster_key')
    op.drop_column('properties', 'video_minio_key')
    sa.Enum(name='videostatus').drop(op.get_bind(), checkfirst=True)
