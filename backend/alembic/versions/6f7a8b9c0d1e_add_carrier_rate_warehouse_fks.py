"""add_carrier_rate_warehouse_fks

Revision ID: 6f7a8b9c0d1e
Revises: 5e6f7a8b9c0d
Create Date: 2026-04-26 10:15:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '6f7a8b9c0d1e'
down_revision: Union[str, None] = '5e6f7a8b9c0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tbl in ('agent_carrier_rates', 'agent_price_history'):
        op.create_foreign_key(
            f'fk_{tbl}_loading_warehouse_id',
            tbl,
            'company_warehouses',
            ['loading_warehouse_id'],
            ['id'],
        )


def downgrade() -> None:
    for tbl in ('agent_price_history', 'agent_carrier_rates'):
        op.drop_constraint(f'fk_{tbl}_loading_warehouse_id', tbl, type_='foreignkey')
