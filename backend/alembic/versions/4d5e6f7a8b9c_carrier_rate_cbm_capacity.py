"""carrier_rate_cbm_capacity

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
Create Date: 2026-04-25 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '4d5e6f7a8b9c'
down_revision: Union[str, None] = '3c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agent_carrier_rates', sa.Column('cbm_20gp', sa.Numeric(8, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('cbm_40ft', sa.Numeric(8, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('cbm_40hq', sa.Numeric(8, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_carrier_rates', 'cbm_40hq')
    op.drop_column('agent_carrier_rates', 'cbm_40ft')
    op.drop_column('agent_carrier_rates', 'cbm_20gp')
