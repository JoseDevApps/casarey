"""add password reset tokens table

Revision ID: f4a9d2c7e5ab
Revises: c91a2d7d4b11
Create Date: 2026-05-23 20:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect


revision: str = "f4a9d2c7e5ab"
down_revision: Union[str, None] = "c91a2d7d4b11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "password_reset_tokens" not in inspector.get_table_names():
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )

    existing_indexes = {ix["name"] for ix in inspector.get_indexes("password_reset_tokens")}
    if "ix_password_reset_tokens_user_id" not in existing_indexes:
        op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"], unique=False)
    if "ix_password_reset_tokens_token_hash" not in existing_indexes:
        op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=False)
    if "ix_password_reset_tokens_expires_at" not in existing_indexes:
        op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"], unique=False)
    if "ix_password_reset_tokens_used_at" not in existing_indexes:
        op.create_index("ix_password_reset_tokens_used_at", "password_reset_tokens", ["used_at"], unique=False)
    if "ix_password_reset_tokens_created_at" not in existing_indexes:
        op.create_index("ix_password_reset_tokens_created_at", "password_reset_tokens", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "password_reset_tokens" not in inspector.get_table_names():
        return

    existing_indexes = {ix["name"] for ix in inspector.get_indexes("password_reset_tokens")}
    if "ix_password_reset_tokens_created_at" in existing_indexes:
        op.drop_index("ix_password_reset_tokens_created_at", table_name="password_reset_tokens")
    if "ix_password_reset_tokens_used_at" in existing_indexes:
        op.drop_index("ix_password_reset_tokens_used_at", table_name="password_reset_tokens")
    if "ix_password_reset_tokens_expires_at" in existing_indexes:
        op.drop_index("ix_password_reset_tokens_expires_at", table_name="password_reset_tokens")
    if "ix_password_reset_tokens_token_hash" in existing_indexes:
        op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    if "ix_password_reset_tokens_user_id" in existing_indexes:
        op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")

    op.drop_table("password_reset_tokens")
