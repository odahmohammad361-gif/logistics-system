"""add_booking_destination

Revision ID: 1a2b3c4d5e6f
Revises: f1e2d3c4b5a6
Create Date: 2026-04-25 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = 'f1e2d3c4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('destination', sa.String(10), nullable=True))
    # Backfill from existing port_of_discharge data
    op.execute("""
        UPDATE bookings SET destination = 'jordan'
        WHERE LOWER(port_of_discharge) ~ '(jordan|aqaba|amman)'
          AND destination IS NULL
    """)
    op.execute("""
        UPDATE bookings SET destination = 'iraq'
        WHERE LOWER(port_of_discharge) ~ '(iraq|basra|umm qasr|baghdad|erbil|mosul|basrah)'
          AND destination IS NULL
    """)


def downgrade() -> None:
    op.drop_column('bookings', 'destination')
