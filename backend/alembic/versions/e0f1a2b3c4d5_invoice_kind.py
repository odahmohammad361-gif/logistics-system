"""invoice kind

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
Create Date: 2026-04-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e0f1a2b3c4d5"
down_revision: Union[str, None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("invoice_kind", sa.String(length=30), nullable=False, server_default="goods"),
    )


def downgrade() -> None:
    op.drop_column("invoices", "invoice_kind")
