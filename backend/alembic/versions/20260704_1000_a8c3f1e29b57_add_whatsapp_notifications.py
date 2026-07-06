"""add whatsapp notifications (phone_verified, notification_phone, otp_codes)

Revision ID: a8c3f1e29b57
Revises: 9d7b2e51a4c3
Create Date: 2026-07-04 10:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision: str = "a8c3f1e29b57"
down_revision: Union[str, None] = "9d7b2e51a4c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "phone_verified" not in user_columns:
        op.add_column(
            "users",
            sa.Column(
                "phone_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    pref_columns = {
        col["name"] for col in inspector.get_columns("admin_notification_preferences")
    }
    if "notification_phone" not in pref_columns:
        op.add_column(
            "admin_notification_preferences",
            sa.Column("notification_phone", sa.String(), nullable=True),
        )

    if "otp_codes" not in inspector.get_table_names():
        otp_purpose = postgresql.ENUM(
            "VERIFY_ACCOUNT", "PASSWORD_RESET", name="otppurpose", create_type=True
        )
        op.create_table(
            "otp_codes",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("purpose", otp_purpose, nullable=False),
            sa.Column("code_hash", sa.String(), nullable=False),
            sa.Column("channel", sa.String(), nullable=False),
            sa.Column(
                "attempts", sa.Integer(), nullable=False, server_default=sa.text("0")
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_otp_codes_user_id", "otp_codes", ["user_id"])
        op.create_index("ix_otp_codes_purpose", "otp_codes", ["purpose"])
        op.create_index("ix_otp_codes_expires_at", "otp_codes", ["expires_at"])
        op.create_index("ix_otp_codes_created_at", "otp_codes", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "otp_codes" in inspector.get_table_names():
        op.drop_index("ix_otp_codes_created_at", table_name="otp_codes")
        op.drop_index("ix_otp_codes_expires_at", table_name="otp_codes")
        op.drop_index("ix_otp_codes_purpose", table_name="otp_codes")
        op.drop_index("ix_otp_codes_user_id", table_name="otp_codes")
        op.drop_table("otp_codes")
        postgresql.ENUM(name="otppurpose").drop(bind, checkfirst=True)

    pref_columns = {
        col["name"] for col in inspector.get_columns("admin_notification_preferences")
    }
    if "notification_phone" in pref_columns:
        op.drop_column("admin_notification_preferences", "notification_phone")

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "phone_verified" in user_columns:
        op.drop_column("users", "phone_verified")
