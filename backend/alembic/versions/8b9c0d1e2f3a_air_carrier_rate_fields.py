"""air_carrier_rate_fields

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-04-26 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8b9c0d1e2f3a'
down_revision: Union[str, None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agent_price_history', sa.Column('rate_type', sa.String(10), nullable=False, server_default='sea'))
    op.add_column('agent_price_history', sa.Column('min_load_kg', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('max_load_kg', sa.Numeric(10, 2), nullable=True))

    op.add_column('agent_carrier_rates', sa.Column('rate_type', sa.String(10), nullable=False, server_default='sea'))
    op.add_column('agent_carrier_rates', sa.Column('buy_air_kg', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('sell_air_kg', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('min_load_kg', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('max_load_kg', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('transit_air_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_carrier_rates', 'transit_air_days')
    op.drop_column('agent_carrier_rates', 'max_load_kg')
    op.drop_column('agent_carrier_rates', 'min_load_kg')
    op.drop_column('agent_carrier_rates', 'sell_air_kg')
    op.drop_column('agent_carrier_rates', 'buy_air_kg')
    op.drop_column('agent_carrier_rates', 'rate_type')

    op.drop_column('agent_price_history', 'max_load_kg')
    op.drop_column('agent_price_history', 'min_load_kg')
    op.drop_column('agent_price_history', 'rate_type')
