"""agent_lcl_cbm_prices

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-04-25 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '2b3c4d5e6f7a'
down_revision: Union[str, None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # LCL per-CBM prices on agent current prices
    op.add_column('shipping_agents', sa.Column('buy_lcl_cbm',  sa.Numeric(10, 2), nullable=True))
    op.add_column('shipping_agents', sa.Column('sell_lcl_cbm', sa.Numeric(10, 2), nullable=True))

    # LCL per-CBM prices + expiry date on price history
    op.add_column('agent_price_history', sa.Column('expiry_date',  sa.Date(),        nullable=True))
    op.add_column('agent_price_history', sa.Column('buy_lcl_cbm',  sa.Numeric(10, 2), nullable=True))
    op.add_column('agent_price_history', sa.Column('sell_lcl_cbm', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_price_history', 'sell_lcl_cbm')
    op.drop_column('agent_price_history', 'buy_lcl_cbm')
    op.drop_column('agent_price_history', 'expiry_date')
    op.drop_column('shipping_agents',     'sell_lcl_cbm')
    op.drop_column('shipping_agents',     'buy_lcl_cbm')
