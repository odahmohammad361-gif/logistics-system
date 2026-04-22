"""agent service modes, carrier on quotes, direct booking, company warehouses

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── shipping_agents: service mode flags ──────────────────────────────────
    op.add_column('shipping_agents',
        sa.Column('serves_sea', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('shipping_agents',
        sa.Column('serves_air', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # ── shipping_quotes: carrier / shipping line ──────────────────────────────
    op.add_column('shipping_quotes',
        sa.Column('carrier', sa.String(100), nullable=True))

    # ── bookings: direct booking + carrier name ───────────────────────────────
    op.add_column('bookings',
        sa.Column('is_direct_booking', sa.String(1), nullable=False, server_default='0'))
    op.add_column('bookings',
        sa.Column('carrier_name', sa.String(100), nullable=True))

    # ── company_warehouses: new table ─────────────────────────────────────────
    op.create_table(
        'company_warehouses',
        sa.Column('id',              sa.Integer(),     primary_key=True),
        sa.Column('name',            sa.String(200),   nullable=False),
        sa.Column('name_ar',         sa.String(200),   nullable=True),
        sa.Column('warehouse_type',  sa.String(20),    nullable=False),
        sa.Column('country',         sa.String(100),   nullable=True),
        sa.Column('city',            sa.String(100),   nullable=True),
        sa.Column('address',         sa.Text(),        nullable=True),
        sa.Column('contact_name',    sa.String(150),   nullable=True),
        sa.Column('phone',           sa.String(50),    nullable=True),
        sa.Column('notes',           sa.Text(),        nullable=True),
        sa.Column('is_active',       sa.Boolean(),     nullable=False, server_default=sa.text('true')),
        sa.Column('branch_id',       sa.Integer(),     sa.ForeignKey('branches.id'), nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_company_warehouses_warehouse_type', 'company_warehouses', ['warehouse_type'])


def downgrade() -> None:
    op.drop_index('ix_company_warehouses_warehouse_type', table_name='company_warehouses')
    op.drop_table('company_warehouses')
    op.drop_column('bookings', 'carrier_name')
    op.drop_column('bookings', 'is_direct_booking')
    op.drop_column('shipping_quotes', 'carrier')
    op.drop_column('shipping_agents', 'serves_air')
    op.drop_column('shipping_agents', 'serves_sea')
