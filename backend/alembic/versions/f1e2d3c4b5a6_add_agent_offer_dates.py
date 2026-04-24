"""add_agent_offer_dates

Revision ID: f1e2d3c4b5a6
Revises: e1b2c3d4e5f6
Create Date: 2026-04-25 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = 'e1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shipping_agents', sa.Column('offer_valid_from', sa.Date(), nullable=True))
    op.add_column('shipping_agents', sa.Column('offer_valid_to',   sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('shipping_agents', 'offer_valid_to')
    op.drop_column('shipping_agents', 'offer_valid_from')
