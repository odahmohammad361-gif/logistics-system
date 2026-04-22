"""add_dummy_invoice_support

Revision ID: f3a1b2c9d0e7
Revises: 44082aafc3ba
Create Date: 2026-03-27 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f3a1b2c9d0e7'
down_revision: Union[str, None] = '44082aafc3ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add buyer_name column for manual (dummy) invoices
    op.add_column('invoices', sa.Column('buyer_name', sa.Text(), nullable=True))

    # Make client_id nullable to support dummy invoices without a real client
    op.alter_column('invoices', 'client_id', nullable=True)

    # Add 'dummy' value to the invoicestatus enum
    # For PostgreSQL use ALTER TYPE; for SQLite this is a no-op (enum stored as VARCHAR)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'dummy'"))


def downgrade() -> None:
    op.alter_column('invoices', 'client_id', nullable=False)
    op.drop_column('invoices', 'buyer_name')
    # Note: PostgreSQL does not support removing enum values easily
