"""add_booking_agent_snapshot

Revision ID: a0b1c2d3e4f5
Revises: 3c4d5e6f7a8b
Create Date: 2026-04-25 16:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = '3c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add agent_carrier_rate_id FK and is_agent_snapshot flag to bookings
    op.add_column('bookings', sa.Column('agent_carrier_rate_id', sa.Integer(), nullable=True))
    op.add_column('bookings', sa.Column('is_agent_snapshot', sa.Boolean(), nullable=False, server_default='false'))
    op.create_foreign_key(
        'fk_bookings_agent_carrier_rate',
        'bookings', 'agent_carrier_rates',
        ['agent_carrier_rate_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_bookings_agent_carrier_rate', 'bookings', type_='foreignkey')
    op.drop_column('bookings', 'is_agent_snapshot')
    op.drop_column('bookings', 'agent_carrier_rate_id')
