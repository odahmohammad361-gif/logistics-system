"""logistics_enhancements

Revision ID: e1a2b3c4d5e6
Revises: 164c20afe85b
Create Date: 2026-03-25 00:00:00.000000

Adds:
- invoices: stamp_position, document_background_path, container_id FK
- invoice_items: air cargo dimension fields (L/W/H, volumetric, chargeable weight)
- containers: seal_no, bl_number, is_lcl, shipping_term, payment_terms, cargo_mode
- container_clients: new junction table for LCL multi-client support
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1a2b3c4d5e6'
down_revision: Union[str, None] = 'c9f2a3e5b8d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── invoices ──────────────────────────────────────────────────────────────
    op.add_column('invoices', sa.Column('stamp_position', sa.String(20), nullable=True))
    op.add_column('invoices', sa.Column('document_background_path', sa.String(500), nullable=True))
    op.add_column('invoices', sa.Column('container_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_invoices_container_id', 'invoices', 'containers',
        ['container_id'], ['id'], ondelete='SET NULL'
    )

    # ── invoice_items ─────────────────────────────────────────────────────────
    op.add_column('invoice_items', sa.Column('carton_length_cm', sa.Numeric(8, 2), nullable=True))
    op.add_column('invoice_items', sa.Column('carton_width_cm', sa.Numeric(8, 2), nullable=True))
    op.add_column('invoice_items', sa.Column('carton_height_cm', sa.Numeric(8, 2), nullable=True))
    op.add_column('invoice_items', sa.Column('volumetric_weight_kg', sa.Numeric(10, 3), nullable=True))
    op.add_column('invoice_items', sa.Column('chargeable_weight_kg', sa.Numeric(10, 3), nullable=True))

    # ── containers ────────────────────────────────────────────────────────────
    op.add_column('containers', sa.Column('seal_no', sa.String(50), nullable=True))
    op.add_column('containers', sa.Column('bl_number', sa.String(50), nullable=True))
    op.add_column('containers', sa.Column('is_lcl', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('containers', sa.Column('shipping_term', sa.String(30), nullable=True))
    op.add_column('containers', sa.Column('payment_terms', sa.String(100), nullable=True))
    op.add_column('containers', sa.Column('cargo_mode', sa.String(10), nullable=True))

    # ── container_clients ─────────────────────────────────────────────────────
    op.create_table(
        'container_clients',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('container_id', sa.Integer(), sa.ForeignKey('containers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('cbm', sa.Numeric(10, 4), nullable=True),
        sa.Column('cartons', sa.Integer(), nullable=True),
        sa.Column('net_weight', sa.Numeric(10, 3), nullable=True),
        sa.Column('gross_weight', sa.Numeric(10, 3), nullable=True),
        sa.Column('freight_share', sa.Numeric(14, 2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.UniqueConstraint('container_id', 'client_id', name='uq_container_client'),
    )
    op.create_index('ix_container_clients_container_id', 'container_clients', ['container_id'])
    op.create_index('ix_container_clients_client_id', 'container_clients', ['client_id'])


def downgrade() -> None:
    op.drop_index('ix_container_clients_client_id', 'container_clients')
    op.drop_index('ix_container_clients_container_id', 'container_clients')
    op.drop_table('container_clients')

    op.drop_column('containers', 'cargo_mode')
    op.drop_column('containers', 'payment_terms')
    op.drop_column('containers', 'shipping_term')
    op.drop_column('containers', 'is_lcl')
    op.drop_column('containers', 'bl_number')
    op.drop_column('containers', 'seal_no')

    op.drop_column('invoice_items', 'chargeable_weight_kg')
    op.drop_column('invoice_items', 'volumetric_weight_kg')
    op.drop_column('invoice_items', 'carton_height_cm')
    op.drop_column('invoice_items', 'carton_width_cm')
    op.drop_column('invoice_items', 'carton_length_cm')

    op.drop_constraint('fk_invoices_container_id', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'container_id')
    op.drop_column('invoices', 'document_background_path')
    op.drop_column('invoices', 'stamp_position')
