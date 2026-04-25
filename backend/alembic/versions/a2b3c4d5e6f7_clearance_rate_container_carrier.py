"""clearance_rate_container_carrier

Revision ID: a2b3c4d5e6f7
Revises: 9c0d1e2f3a4b
Create Date: 2026-04-26 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '9c0d1e2f3a4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clearance_agent_rates', sa.Column('container_size', sa.String(length=20), nullable=True))
    op.add_column('clearance_agent_rates', sa.Column('carrier_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('clearance_agent_rates', 'carrier_name')
    op.drop_column('clearance_agent_rates', 'container_size')
