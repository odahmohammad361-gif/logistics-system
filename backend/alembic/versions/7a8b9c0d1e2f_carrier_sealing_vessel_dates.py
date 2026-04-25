"""carrier_sealing_vessel_dates

Revision ID: 7a8b9c0d1e2f
Revises: 6f7a8b9c0d1e
Create Date: 2026-04-26 11:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '6f7a8b9c0d1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _day_to_date_expression(column: str) -> str:
    return f"""
        CASE
            WHEN {column} IS NULL THEN NULL
            WHEN effective_date IS NULL THEN NULL
            WHEN {column} BETWEEN 1 AND 31 THEN make_date(
                EXTRACT(YEAR FROM effective_date)::int,
                EXTRACT(MONTH FROM effective_date)::int,
                LEAST(
                    {column},
                    EXTRACT(DAY FROM (date_trunc('month', effective_date) + interval '1 month - 1 day'))::int
                )
            )
            ELSE NULL
        END
    """


def upgrade() -> None:
    for tbl in ('agent_carrier_rates', 'agent_price_history'):
        op.alter_column(
            tbl,
            'sealing_day',
            existing_type=sa.Integer(),
            type_=sa.Date(),
            existing_nullable=True,
            postgresql_using=_day_to_date_expression('sealing_day'),
        )
        op.alter_column(
            tbl,
            'vessel_day',
            existing_type=sa.Integer(),
            type_=sa.Date(),
            existing_nullable=True,
            postgresql_using=_day_to_date_expression('vessel_day'),
        )


def downgrade() -> None:
    for tbl in ('agent_price_history', 'agent_carrier_rates'):
        op.alter_column(
            tbl,
            'vessel_day',
            existing_type=sa.Date(),
            type_=sa.Integer(),
            existing_nullable=True,
            postgresql_using='EXTRACT(DAY FROM vessel_day)::int',
        )
        op.alter_column(
            tbl,
            'sealing_day',
            existing_type=sa.Date(),
            type_=sa.Integer(),
            existing_nullable=True,
            postgresql_using='EXTRACT(DAY FROM sealing_day)::int',
        )
