"""add_shipping_quotes_and_agent_fields

Revision ID: b7e4d1f92a30
Revises: 164c20afe85b
Create Date: 2026-03-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b7e4d1f92a30'
down_revision = '164c20afe85b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend shipping_agents ──────────────────────────────────────────────
    op.add_column('shipping_agents', sa.Column('wechat_id', sa.String(100), nullable=True))
    op.add_column('shipping_agents', sa.Column('warehouse_address', sa.Text(), nullable=True))
    op.add_column('shipping_agents', sa.Column('warehouse_city', sa.String(100), nullable=True))
    op.add_column('shipping_agents', sa.Column('bank_name', sa.String(200), nullable=True))
    op.add_column('shipping_agents', sa.Column('bank_account', sa.String(100), nullable=True))
    op.add_column('shipping_agents', sa.Column('bank_swift', sa.String(20), nullable=True))

    # ── Create shipping_quotes ──────────────────────────────────────────────
    op.create_table(
        'shipping_quotes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('quote_number', sa.String(60), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),

        sa.Column('service_mode', sa.Enum('SEA_FCL', 'AIR', 'LCL', name='quoteservicemode'), nullable=False),
        sa.Column('container_type', sa.String(10), nullable=True),
        sa.Column('incoterm', sa.Enum('FOB', 'CIF', 'CFR', 'EXW', 'DAP', 'DDP', 'CIP', 'CPT', 'FCA', 'FAS', name='incoterm'), nullable=True),
        sa.Column('incoterm_point', sa.String(100), nullable=True),

        sa.Column('port_of_loading', sa.String(100), nullable=True),
        sa.Column('port_of_discharge', sa.String(100), nullable=True),

        sa.Column('validity_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('validity_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('draft', 'active', 'expired', 'rejected', name='quotestatus'), nullable=False, server_default='draft'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='USD'),

        # Freight
        sa.Column('ocean_freight', sa.Numeric(12, 2), nullable=True),
        sa.Column('air_freight_per_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('min_chargeable_weight_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('min_chargeable_cbm', sa.Numeric(10, 4), nullable=True),

        # Surcharges
        sa.Column('baf', sa.Numeric(10, 2), nullable=True),
        sa.Column('eca_surcharge', sa.Numeric(10, 2), nullable=True),
        sa.Column('war_risk_surcharge', sa.Numeric(10, 2), nullable=True),
        sa.Column('other_surcharges', sa.Numeric(10, 2), nullable=True),

        # Origin charges
        sa.Column('thc_origin', sa.Numeric(10, 2), nullable=True),
        sa.Column('bl_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('doc_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('sealing_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('inspection_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('trucking_origin', sa.Numeric(10, 2), nullable=True),
        sa.Column('stuffing_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('warehouse_handling', sa.Numeric(10, 2), nullable=True),

        # Destination charges
        sa.Column('thc_destination', sa.Numeric(10, 2), nullable=True),
        sa.Column('customs_destination', sa.Numeric(10, 2), nullable=True),
        sa.Column('brokerage_destination', sa.Numeric(10, 2), nullable=True),
        sa.Column('trucking_destination', sa.Numeric(10, 2), nullable=True),

        # Timing
        sa.Column('transit_days', sa.Integer(), nullable=True),
        sa.Column('free_days_origin', sa.Integer(), nullable=True),
        sa.Column('free_days_destination', sa.Integer(), nullable=True),
        sa.Column('cut_off_days', sa.Integer(), nullable=True),
        sa.Column('stuffing_days', sa.Integer(), nullable=True),

        # Totals
        sa.Column('total_origin', sa.Numeric(14, 2), nullable=True),
        sa.Column('total_destination', sa.Numeric(14, 2), nullable=True),
        sa.Column('total_surcharges', sa.Numeric(14, 2), nullable=True),
        sa.Column('total_all', sa.Numeric(14, 2), nullable=True),

        # Meta
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('document_path', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.ForeignKeyConstraint(['agent_id'], ['shipping_agents.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shipping_quotes_id'), 'shipping_quotes', ['id'], unique=False)
    op.create_index(op.f('ix_shipping_quotes_quote_number'), 'shipping_quotes', ['quote_number'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_shipping_quotes_quote_number'), table_name='shipping_quotes')
    op.drop_index(op.f('ix_shipping_quotes_id'), table_name='shipping_quotes')
    op.drop_table('shipping_quotes')

    op.drop_column('shipping_agents', 'bank_swift')
    op.drop_column('shipping_agents', 'bank_account')
    op.drop_column('shipping_agents', 'bank_name')
    op.drop_column('shipping_agents', 'warehouse_city')
    op.drop_column('shipping_agents', 'warehouse_address')
    op.drop_column('shipping_agents', 'wechat_id')

    op.execute("DROP TYPE IF EXISTS quoteservicemode")
    op.execute("DROP TYPE IF EXISTS quotestatus")
    op.execute("DROP TYPE IF EXISTS incoterm")
