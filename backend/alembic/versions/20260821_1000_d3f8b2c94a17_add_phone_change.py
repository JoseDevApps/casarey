"""add pending_phone and VERIFY_PHONE otp purpose

Revision ID: d3f8b2c94a17
Revises: c7e4a91f2db8
Create Date: 2026-08-21 10:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "d3f8b2c94a17"
down_revision: Union[str, None] = "c7e4a91f2db8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    cols = {c["name"] for c in inspector.get_columns("users")}
    if "pending_phone" not in cols:
        op.add_column("users", sa.Column("pending_phone", sa.String(), nullable=True))

    # Nuevo proposito de OTP para confirmar un cambio de telefono
    op.execute("ALTER TYPE otppurpose ADD VALUE IF NOT EXISTS 'VERIFY_PHONE'")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("users")}
    if "pending_phone" in cols:
        op.drop_column("users", "pending_phone")
    # PostgreSQL no permite eliminar valores de un enum; se deja VERIFY_PHONE.
