"""add TECH_ADMIN role to userrole enum

Revision ID: b5d1c7f38a92
Revises: a8c3f1e29b57
Create Date: 2026-07-17 12:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op


revision: str = "b5d1c7f38a92"
down_revision: Union[str, None] = "a8c3f1e29b57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PG16 permite ADD VALUE dentro de transacción (el valor se usa en
    # transacciones posteriores, que es nuestro caso).
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'TECH_ADMIN'")


def downgrade() -> None:
    # PostgreSQL no soporta eliminar valores de un enum; se deja el valor.
    # (Ningún usuario debería conservar el rol si se revierte la feature.)
    pass
