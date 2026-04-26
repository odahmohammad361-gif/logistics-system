"""add_cargo_extracted_goods

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a1
Create Date: 2026-04-26 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "b5c6d7e8f9a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("booking_cargo_lines", sa.Column("extracted_goods", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("booking_cargo_lines", "extracted_goods")
