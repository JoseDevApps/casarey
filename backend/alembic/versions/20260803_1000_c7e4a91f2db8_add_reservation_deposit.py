"""add reservation deposit (anticipo 40%)

Revision ID: c7e4a91f2db8
Revises: b5d1c7f38a92
Create Date: 2026-08-03 10:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c7e4a91f2db8"
down_revision: Union[str, None] = "b5d1c7f38a92"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    prop_cols = {c["name"] for c in inspector.get_columns("properties")}
    if "deposit_percentage" not in prop_cols:
        op.add_column(
            "properties",
            sa.Column(
                "deposit_percentage",
                sa.Numeric(5, 2),
                nullable=False,
                server_default="40",
            ),
        )

    res_cols = {c["name"] for c in inspector.get_columns("reservations")}
    if "deposit_percentage" not in res_cols:
        op.add_column(
            "reservations",
            sa.Column(
                "deposit_percentage",
                sa.Numeric(5, 2),
                nullable=False,
                server_default="40",
            ),
        )
    if "deposit_amount" not in res_cols:
        op.add_column(
            "reservations",
            sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=True),
        )

        # Backfill: las reservas anteriores al anticipo se pagaron completas.
        # Se marcan al 100% (saldo 0) para no distorsionar los reportes.
        # Incluye las que estuvieran aprobadas sin pagar al momento del deploy:
        # conservan el comportamiento actual (se cobra el total).
        op.execute(
            """
            UPDATE reservations
               SET deposit_percentage = 100,
                   deposit_amount = total_amount - COALESCE(discount_amount, 0)
             WHERE deposit_amount IS NULL
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    res_cols = {c["name"] for c in inspector.get_columns("reservations")}
    if "deposit_amount" in res_cols:
        op.drop_column("reservations", "deposit_amount")
    if "deposit_percentage" in res_cols:
        op.drop_column("reservations", "deposit_percentage")

    prop_cols = {c["name"] for c in inspector.get_columns("properties")}
    if "deposit_percentage" in prop_cols:
        op.drop_column("properties", "deposit_percentage")
