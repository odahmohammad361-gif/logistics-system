"""add_lcl_per_size_fields

Revision ID: b5c6d7e8f9a0
Revises: a0b1c2d3e4f5
Create Date: 2026-04-25 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = '4d5e6f7a8b9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add per-size LCL per-CBM columns to agent_price_history
    op.add_column('agent_price_history', sa.Column('buy_lcl_20gp', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('sell_lcl_20gp', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('buy_lcl_40ft', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('sell_lcl_40ft', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('buy_lcl_40hq', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('sell_lcl_40hq', sa.Numeric(10, 2), nullable=True))

    # Add per-size LCL per-CBM columns to agent_carrier_rates
    op.add_column('agent_carrier_rates', sa.Column('buy_lcl_20gp', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('sell_lcl_20gp', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('buy_lcl_40ft', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('sell_lcl_40ft', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('buy_lcl_40hq', sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_carrier_rates', sa.Column('sell_lcl_40hq', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_carrier_rates', 'sell_lcl_40hq')
    op.drop_column('agent_carrier_rates', 'buy_lcl_40hq')
    op.drop_column('agent_carrier_rates', 'sell_lcl_40ft')
    op.drop_column('agent_carrier_rates', 'buy_lcl_40ft')
    op.drop_column('agent_carrier_rates', 'sell_lcl_20gp')
    op.drop_column('agent_carrier_rates', 'buy_lcl_20gp')

    op.drop_column('agent_price_history', 'sell_lcl_40hq')
    op.drop_column('agent_price_history', 'buy_lcl_40hq')
    op.drop_column('agent_price_history', 'sell_lcl_40ft')
    op.drop_column('agent_price_history', 'buy_lcl_40ft')
    op.drop_column('agent_price_history', 'sell_lcl_20gp')
    op.drop_column('agent_price_history', 'buy_lcl_20gp')
