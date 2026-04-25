"""agent_carrier_rates

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
Create Date: 2026-04-25 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '3c4d5e6f7a8b'
down_revision: Union[str, None] = '2b3c4d5e6f7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add carrier_name, pol, pod to price history
    op.add_column('agent_price_history', sa.Column('carrier_name', sa.String(100), nullable=True))
    op.add_column('agent_price_history', sa.Column('pol', sa.String(150), nullable=True))
    op.add_column('agent_price_history', sa.Column('pod', sa.String(150), nullable=True))

    # New table: current rate per carrier per agent
    op.create_table(
        'agent_carrier_rates',
        sa.Column('id',           sa.Integer(),     primary_key=True, index=True),
        sa.Column('agent_id',     sa.Integer(),     sa.ForeignKey('shipping_agents.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('carrier_name', sa.String(100),   nullable=False, index=True),
        sa.Column('pol',          sa.String(150),   nullable=True),
        sa.Column('pod',          sa.String(150),   nullable=True),
        sa.Column('effective_date', sa.Date(),      nullable=True),
        sa.Column('expiry_date',    sa.Date(),      nullable=True),
        sa.Column('buy_20gp',     sa.Numeric(10,2), nullable=True),
        sa.Column('sell_20gp',    sa.Numeric(10,2), nullable=True),
        sa.Column('buy_40ft',     sa.Numeric(10,2), nullable=True),
        sa.Column('sell_40ft',    sa.Numeric(10,2), nullable=True),
        sa.Column('buy_40hq',     sa.Numeric(10,2), nullable=True),
        sa.Column('sell_40hq',    sa.Numeric(10,2), nullable=True),
        sa.Column('buy_lcl_cbm',  sa.Numeric(10,2), nullable=True),
        sa.Column('sell_lcl_cbm', sa.Numeric(10,2), nullable=True),
        sa.Column('transit_sea_days', sa.Integer(), nullable=True),
        sa.Column('notes',        sa.Text(),        nullable=True),
        sa.Column('is_active',    sa.Boolean(),     nullable=False, server_default='true'),
        sa.Column('updated_at',   sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('agent_carrier_rates')
    op.drop_column('agent_price_history', 'pod')
    op.drop_column('agent_price_history', 'pol')
    op.drop_column('agent_price_history', 'carrier_name')
