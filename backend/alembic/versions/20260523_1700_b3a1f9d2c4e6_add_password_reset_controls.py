"""add password reset controls for superadmin flow

Revision ID: b3a1f9d2c4e6
Revises: 9f2a4c1b7e10
Create Date: 2026-05-23 17:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect


revision: str = "b3a1f9d2c4e6"
down_revision: Union[str, None] = "9f2a4c1b7e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "users" in inspector.get_table_names():
        user_columns = {c["name"] for c in inspector.get_columns("users")}
        if "must_change_password" not in user_columns:
            op.add_column(
                "users",
                sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            )
            op.alter_column("users", "must_change_password", server_default=None)

    if "admin_password_resets" not in inspector.get_table_names():
        op.create_table(
            "admin_password_resets",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("reason", sa.String(), nullable=True),
            sa.Column("revoked_sessions", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {ix["name"] for ix in inspector.get_indexes("admin_password_resets")}
    if "ix_admin_password_resets_target_user_id" not in existing_indexes:
        op.create_index(
            "ix_admin_password_resets_target_user_id",
            "admin_password_resets",
            ["target_user_id"],
            unique=False,
        )
    if "ix_admin_password_resets_actor_user_id" not in existing_indexes:
        op.create_index(
            "ix_admin_password_resets_actor_user_id",
            "admin_password_resets",
            ["actor_user_id"],
            unique=False,
        )
    if "ix_admin_password_resets_created_at" not in existing_indexes:
        op.create_index(
            "ix_admin_password_resets_created_at",
            "admin_password_resets",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "admin_password_resets" in inspector.get_table_names():
        existing_indexes = {ix["name"] for ix in inspector.get_indexes("admin_password_resets")}
        if "ix_admin_password_resets_created_at" in existing_indexes:
            op.drop_index("ix_admin_password_resets_created_at", table_name="admin_password_resets")
        if "ix_admin_password_resets_actor_user_id" in existing_indexes:
            op.drop_index("ix_admin_password_resets_actor_user_id", table_name="admin_password_resets")
        if "ix_admin_password_resets_target_user_id" in existing_indexes:
            op.drop_index("ix_admin_password_resets_target_user_id", table_name="admin_password_resets")
        op.drop_table("admin_password_resets")

    if "users" in inspector.get_table_names():
        user_columns = {c["name"] for c in inspector.get_columns("users")}
        if "must_change_password" in user_columns:
            op.drop_column("users", "must_change_password")
