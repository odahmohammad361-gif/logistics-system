"""add_bookings

Revision ID: b3c4d5e6f7a8
Revises: e9977904ebea
Create Date: 2026-03-27 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'e9977904ebea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bookings',
        sa.Column('id',             sa.Integer,      primary_key=True),
        sa.Column('booking_number', sa.String(60),   nullable=False, unique=True),
        sa.Column('mode',           sa.String(10),   nullable=False),
        sa.Column('status',         sa.String(20),   nullable=False, server_default='draft'),
        sa.Column('shipping_agent_id', sa.Integer,   sa.ForeignKey('shipping_agents.id'), nullable=True),
        sa.Column('branch_id',      sa.Integer,      sa.ForeignKey('branches.id'), nullable=True),
        sa.Column('container_size', sa.String(10),   nullable=True),
        sa.Column('container_no',   sa.String(50),   nullable=True),
        sa.Column('seal_no',        sa.String(50),   nullable=True),
        sa.Column('bl_number',      sa.String(60),   nullable=True),
        sa.Column('awb_number',     sa.String(60),   nullable=True),
        sa.Column('vessel_name',    sa.String(100),  nullable=True),
        sa.Column('voyage_number',  sa.String(50),   nullable=True),
        sa.Column('flight_number',  sa.String(50),   nullable=True),
        sa.Column('port_of_loading',   sa.String(150), nullable=True),
        sa.Column('port_of_discharge', sa.String(150), nullable=True),
        sa.Column('etd',            sa.Date,         nullable=True),
        sa.Column('eta',            sa.Date,         nullable=True),
        sa.Column('incoterm',       sa.String(20),   nullable=True),
        sa.Column('freight_cost',   sa.Numeric(14, 2), nullable=True),
        sa.Column('currency',       sa.String(10),   server_default='USD'),
        sa.Column('notes',          sa.Text,         nullable=True),
        sa.Column('created_at',     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at',     sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_bookings_booking_number', 'bookings', ['booking_number'], unique=True)
    op.create_index('ix_bookings_mode',           'bookings', ['mode'])
    op.create_index('ix_bookings_status',         'bookings', ['status'])

    op.create_table(
        'booking_cargo_lines',
        sa.Column('id',         sa.Integer, primary_key=True),
        sa.Column('booking_id', sa.Integer, sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id',  sa.Integer, sa.ForeignKey('clients.id'),  nullable=False),
        sa.Column('sort_order', sa.Integer, server_default='0'),
        sa.Column('description',    sa.Text, nullable=True),
        sa.Column('description_ar', sa.Text, nullable=True),
        sa.Column('hs_code',        sa.String(30), nullable=True),
        sa.Column('shipping_marks', sa.Text, nullable=True),
        sa.Column('cartons',          sa.Integer,        nullable=True),
        sa.Column('gross_weight_kg',  sa.Numeric(10, 3), nullable=True),
        sa.Column('net_weight_kg',    sa.Numeric(10, 3), nullable=True),
        sa.Column('cbm',              sa.Numeric(10, 4), nullable=True),
        sa.Column('carton_length_cm', sa.Numeric(8, 2),  nullable=True),
        sa.Column('carton_width_cm',  sa.Numeric(8, 2),  nullable=True),
        sa.Column('carton_height_cm', sa.Numeric(8, 2),  nullable=True),
        sa.Column('volumetric_weight_kg',  sa.Numeric(10, 3), nullable=True),
        sa.Column('chargeable_weight_kg',  sa.Numeric(10, 3), nullable=True),
        sa.Column('freight_share', sa.Numeric(14, 2), nullable=True),
        sa.Column('notes',       sa.Text, nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_booking_cargo_lines_booking_id', 'booking_cargo_lines', ['booking_id'])
    op.create_index('ix_booking_cargo_lines_client_id',  'booking_cargo_lines', ['client_id'])

    op.create_table(
        'booking_cargo_images',
        sa.Column('id',           sa.Integer, primary_key=True),
        sa.Column('cargo_line_id', sa.Integer, sa.ForeignKey('booking_cargo_lines.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path',         sa.String(500), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_booking_cargo_images_cargo_line_id', 'booking_cargo_images', ['cargo_line_id'])


def downgrade() -> None:
    op.drop_table('booking_cargo_images')
    op.drop_table('booking_cargo_lines')
    op.drop_table('bookings')
