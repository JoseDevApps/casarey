"""add discount_amount to reservations

Revision ID: add_discount_amount_v1
Revises: 7ad2df25a544
Create Date: 2026-05-15 17:50:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_discount_amount_v1'
down_revision: Union[str, None] = '7ad2df25a544'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'reservations',
        sa.Column('discount_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('reservations', 'discount_amount')
