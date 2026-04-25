"""clearance_agent_rates

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-04-26 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '9c0d1e2f3a4b'
down_revision: Union[str, None] = '8b9c0d1e2f3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clearance_agent_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('service_mode', sa.String(length=10), nullable=False, server_default='sea'),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('port', sa.String(length=150), nullable=True),
        sa.Column('route', sa.String(length=200), nullable=True),
        sa.Column('buy_clearance_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('sell_clearance_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_transportation', sa.Numeric(10, 2), nullable=True),
        sa.Column('sell_transportation', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_delivery_authorization', sa.Numeric(10, 2), nullable=True),
        sa.Column('sell_delivery_authorization', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_inspection_ramp', sa.Numeric(10, 2), nullable=True),
        sa.Column('sell_inspection_ramp', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_port_inspection', sa.Numeric(10, 2), nullable=True),
        sa.Column('sell_port_inspection', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_import_export_card_pct', sa.Numeric(7, 3), nullable=True),
        sa.Column('sell_import_export_card_pct', sa.Numeric(7, 3), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['clearance_agents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_clearance_agent_rates_id'), 'clearance_agent_rates', ['id'], unique=False)
    op.create_index(op.f('ix_clearance_agent_rates_agent_id'), 'clearance_agent_rates', ['agent_id'], unique=False)

    op.create_table(
        'clearance_agent_edit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('changed_by_id', sa.Integer(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['agent_id'], ['clearance_agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_clearance_agent_edit_log_id'), 'clearance_agent_edit_log', ['id'], unique=False)
    op.create_index(op.f('ix_clearance_agent_edit_log_agent_id'), 'clearance_agent_edit_log', ['agent_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_clearance_agent_edit_log_agent_id'), table_name='clearance_agent_edit_log')
    op.drop_index(op.f('ix_clearance_agent_edit_log_id'), table_name='clearance_agent_edit_log')
    op.drop_table('clearance_agent_edit_log')
    op.drop_index(op.f('ix_clearance_agent_rates_agent_id'), table_name='clearance_agent_rates')
    op.drop_index(op.f('ix_clearance_agent_rates_id'), table_name='clearance_agent_rates')
    op.drop_table('clearance_agent_rates')
