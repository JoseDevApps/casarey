"""add email verification flag to users

Revision ID: c91a2d7d4b11
Revises: b3a1f9d2c4e6
Create Date: 2026-05-23 18:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c91a2d7d4b11"
down_revision: Union[str, None] = "b3a1f9d2c4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    user_columns = {c["name"] for c in inspector.get_columns("users")}
    if "email_verified" not in user_columns:
        op.add_column(
            "users",
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )
        op.alter_column("users", "email_verified", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    user_columns = {c["name"] for c in inspector.get_columns("users")}
    if "email_verified" in user_columns:
        op.drop_column("users", "email_verified")
