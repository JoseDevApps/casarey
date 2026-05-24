"""add discount_amount to reservations

Revision ID: add_discount_amount_v1
Revises: 7ad2df25a544
Create Date: 2026-05-15 17:50:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'add_discount_amount_v1'
down_revision: Union[str, None] = '7ad2df25a544'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "reservations" not in inspector.get_table_names():
        return
    existing_columns = {c["name"] for c in inspector.get_columns("reservations")}
    if "discount_amount" not in existing_columns:
        op.add_column(
            'reservations',
            sa.Column('discount_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "reservations" in inspector.get_table_names():
        existing_columns = {c["name"] for c in inspector.get_columns("reservations")}
        if "discount_amount" in existing_columns:
            op.drop_column('reservations', 'discount_amount')
