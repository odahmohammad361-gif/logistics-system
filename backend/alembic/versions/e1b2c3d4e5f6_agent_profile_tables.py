"""agent_profile_tables

Revision ID: e1b2c3d4e5f6
Revises: d5e6f7a8b9c0
Create Date: 2026-04-25 08:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e1b2c3d4e5f6'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add selling prices to shipping_agents
    op.add_column('shipping_agents', sa.Column('sell_price_20gp',  sa.Numeric(10, 2), nullable=True))
    op.add_column('shipping_agents', sa.Column('sell_price_40ft',  sa.Numeric(10, 2), nullable=True))
    op.add_column('shipping_agents', sa.Column('sell_price_40hq',  sa.Numeric(10, 2), nullable=True))
    op.add_column('shipping_agents', sa.Column('sell_price_air_kg',sa.Numeric(10, 2), nullable=True))

    # Weekly price snapshots
    op.create_table(
        'agent_price_history',
        sa.Column('id',               sa.Integer(),     primary_key=True, index=True),
        sa.Column('agent_id',         sa.Integer(),     sa.ForeignKey('shipping_agents.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('effective_date',   sa.Date(),        nullable=False),
        sa.Column('buy_20gp',         sa.Numeric(10,2), nullable=True),
        sa.Column('sell_20gp',        sa.Numeric(10,2), nullable=True),
        sa.Column('buy_40ft',         sa.Numeric(10,2), nullable=True),
        sa.Column('sell_40ft',        sa.Numeric(10,2), nullable=True),
        sa.Column('buy_40hq',         sa.Numeric(10,2), nullable=True),
        sa.Column('sell_40hq',        sa.Numeric(10,2), nullable=True),
        sa.Column('buy_air_kg',       sa.Numeric(10,2), nullable=True),
        sa.Column('sell_air_kg',      sa.Numeric(10,2), nullable=True),
        sa.Column('transit_sea_days', sa.Integer(),     nullable=True),
        sa.Column('transit_air_days', sa.Integer(),     nullable=True),
        sa.Column('notes',            sa.Text(),        nullable=True),
        sa.Column('created_by_id',    sa.Integer(),     sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # PDF contracts
    op.create_table(
        'agent_contracts',
        sa.Column('id',                sa.Integer(),     primary_key=True, index=True),
        sa.Column('agent_id',          sa.Integer(),     sa.ForeignKey('shipping_agents.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title',             sa.String(300),   nullable=False),
        sa.Column('file_path',         sa.String(500),   nullable=False),
        sa.Column('original_filename', sa.String(255),   nullable=True),
        sa.Column('valid_from',        sa.Date(),        nullable=True),
        sa.Column('valid_to',          sa.Date(),        nullable=True),
        sa.Column('notes',             sa.Text(),        nullable=True),
        sa.Column('uploaded_by_id',    sa.Integer(),     sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at',        sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Edit / activity log
    op.create_table(
        'agent_edit_log',
        sa.Column('id',            sa.Integer(),    primary_key=True, index=True),
        sa.Column('agent_id',      sa.Integer(),    sa.ForeignKey('shipping_agents.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('action',        sa.String(60),   nullable=False),   # update | price_update | contract_upload | contract_delete
        sa.Column('summary',       sa.Text(),       nullable=True),
        sa.Column('changed_by_id', sa.Integer(),    sa.ForeignKey('users.id'), nullable=True),
        sa.Column('changed_at',    sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('agent_edit_log')
    op.drop_table('agent_contracts')
    op.drop_table('agent_price_history')
    op.drop_column('shipping_agents', 'sell_price_air_kg')
    op.drop_column('shipping_agents', 'sell_price_40hq')
    op.drop_column('shipping_agents', 'sell_price_40ft')
    op.drop_column('shipping_agents', 'sell_price_20gp')
