"""add_booking_loading_fields

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-24 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Loading info on booking
    op.add_column('bookings', sa.Column('loading_warehouse_id', sa.Integer(), sa.ForeignKey('company_warehouses.id'), nullable=True))
    op.add_column('bookings', sa.Column('loading_date',         sa.DateTime(timezone=True), nullable=True))
    op.add_column('bookings', sa.Column('loading_notes',        sa.Text(), nullable=True))

    # Loading photos table (booking-level, not cargo-line-level)
    op.create_table(
        'booking_loading_photos',
        sa.Column('id',                sa.Integer(),      primary_key=True, index=True),
        sa.Column('booking_id',        sa.Integer(),      sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('file_path',         sa.String(500),    nullable=False),
        sa.Column('original_filename', sa.String(255),    nullable=True),
        sa.Column('caption',           sa.String(300),    nullable=True),
        sa.Column('uploaded_at',       sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('booking_loading_photos')
    op.drop_column('bookings', 'loading_notes')
    op.drop_column('bookings', 'loading_date')
    op.drop_column('bookings', 'loading_warehouse_id')
