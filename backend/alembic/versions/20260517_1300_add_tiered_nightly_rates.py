"""add tiered nightly rates and reservation snapshots

Revision ID: 9f2a4c1b7e10
Revises: add_discount_amount_v1
Create Date: 2026-05-17 13:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f2a4c1b7e10"
down_revision: Union[str, None] = "add_discount_amount_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("rate_night_1", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "properties",
        sa.Column("rate_night_2", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "properties",
        sa.Column("rate_night_3", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )

    op.execute(
        """
        UPDATE properties
        SET rate_night_1 = rate_adult,
            rate_night_2 = rate_adult,
            rate_night_3 = rate_adult
        """
    )

    op.alter_column("properties", "rate_night_1", server_default=None)
    op.alter_column("properties", "rate_night_2", server_default=None)
    op.alter_column("properties", "rate_night_3", server_default=None)

    op.add_column(
        "reservations",
        sa.Column("snapshot_nightly_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "reservations",
        sa.Column("snapshot_pricing_tier", sa.Integer(), nullable=False, server_default="1"),
    )

    op.execute(
        """
        UPDATE reservations
        SET snapshot_nightly_rate = snapshot_rate_adult,
            snapshot_pricing_tier = CASE
                WHEN (check_out_date::date - check_in_date::date) <= 1 THEN 1
                WHEN (check_out_date::date - check_in_date::date) = 2 THEN 2
                ELSE 3
            END
        """
    )

    op.alter_column("reservations", "snapshot_nightly_rate", server_default=None)
    op.alter_column("reservations", "snapshot_pricing_tier", server_default=None)


def downgrade() -> None:
    op.drop_column("reservations", "snapshot_pricing_tier")
    op.drop_column("reservations", "snapshot_nightly_rate")
    op.drop_column("properties", "rate_night_3")
    op.drop_column("properties", "rate_night_2")
    op.drop_column("properties", "rate_night_1")
