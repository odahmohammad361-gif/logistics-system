"""carrier_origin_fees_and_logistics

Revision ID: 5e6f7a8b9c0d
Revises: fa60a99aee3d
Create Date: 2026-04-26 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '5e6f7a8b9c0d'
down_revision: Union[str, None] = 'fa60a99aee3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tbl in ('agent_carrier_rates', 'agent_price_history'):
        op.add_column(tbl, sa.Column('sealing_day',          sa.Integer(),       nullable=True))
        op.add_column(tbl, sa.Column('vessel_day',           sa.Integer(),       nullable=True))
        op.add_column(tbl, sa.Column('loading_warehouse_id', sa.Integer(),       nullable=True))
        op.add_column(tbl, sa.Column('fee_loading',          sa.Numeric(10, 2),  nullable=True))
        op.add_column(tbl, sa.Column('fee_bl',               sa.Numeric(10, 2),  nullable=True))
        op.add_column(tbl, sa.Column('fee_trucking',         sa.Numeric(10, 2),  nullable=True))
        op.add_column(tbl, sa.Column('fee_other',            sa.Numeric(10, 2),  nullable=True))


def downgrade() -> None:
    for tbl in ('agent_price_history', 'agent_carrier_rates'):
        for col in ('fee_other', 'fee_trucking', 'fee_bl', 'fee_loading',
                    'loading_warehouse_id', 'vessel_day', 'sealing_day'):
            op.drop_column(tbl, col)
