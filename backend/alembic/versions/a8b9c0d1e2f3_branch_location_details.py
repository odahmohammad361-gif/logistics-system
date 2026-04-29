"""branch location details

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-04-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("branches", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("branches", sa.Column("address", sa.Text(), nullable=True))

    op.execute("UPDATE branches SET city = 'Amman' WHERE code = 'JO' AND city IS NULL")
    op.execute("UPDATE branches SET city = 'Guangzhou' WHERE code = 'CN' AND city IS NULL")
    op.execute("UPDATE branches SET city = 'Baghdad' WHERE code = 'IQ' AND city IS NULL")


def downgrade() -> None:
    op.drop_column("branches", "address")
    op.drop_column("branches", "city")
