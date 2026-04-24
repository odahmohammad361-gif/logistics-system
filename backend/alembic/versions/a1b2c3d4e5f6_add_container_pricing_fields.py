"""add_container_pricing_fields

Revision ID: a1b2c3d4e5f6
Revises: 94e8770ff1e2
Create Date: 2026-04-24 06:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '94e8770ff1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('max_cbm',    sa.Numeric(10, 2), nullable=True))
    op.add_column('bookings', sa.Column('markup_pct', sa.Numeric(6, 2),  nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'markup_pct')
    op.drop_column('bookings', 'max_cbm')
