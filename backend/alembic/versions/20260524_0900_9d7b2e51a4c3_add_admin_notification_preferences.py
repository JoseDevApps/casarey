"""add admin notification preferences

Revision ID: 9d7b2e51a4c3
Revises: f4a9d2c7e5ab
Create Date: 2026-05-24 09:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision: str = "9d7b2e51a4c3"
down_revision: Union[str, None] = "f4a9d2c7e5ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "admin_notification_preferences" not in inspector.get_table_names():
        op.create_table(
            "admin_notification_preferences",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("notification_email", sa.String(), nullable=True),
            sa.Column("client_approved_subject", sa.String(), nullable=False),
            sa.Column("client_approved_body", sa.Text(), nullable=False),
            sa.Column("client_rejected_subject", sa.String(), nullable=False),
            sa.Column("client_rejected_body", sa.Text(), nullable=False),
            sa.Column("client_payment_received_subject", sa.String(), nullable=False),
            sa.Column("client_payment_received_body", sa.Text(), nullable=False),
            sa.Column("client_payment_confirmed_subject", sa.String(), nullable=False),
            sa.Column("client_payment_confirmed_body", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("owner_id"),
        )

    existing_indexes = {
        ix["name"] for ix in inspector.get_indexes("admin_notification_preferences")
    }
    if "ix_admin_notification_preferences_owner_id" not in existing_indexes:
        op.create_index(
            "ix_admin_notification_preferences_owner_id",
            "admin_notification_preferences",
            ["owner_id"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "admin_notification_preferences" not in inspector.get_table_names():
        return

    existing_indexes = {
        ix["name"] for ix in inspector.get_indexes("admin_notification_preferences")
    }
    if "ix_admin_notification_preferences_owner_id" in existing_indexes:
        op.drop_index(
            "ix_admin_notification_preferences_owner_id",
            table_name="admin_notification_preferences",
        )
    op.drop_table("admin_notification_preferences")
