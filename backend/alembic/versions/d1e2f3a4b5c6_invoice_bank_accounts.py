"""invoice bank accounts

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-04-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invoice_bank_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_label", sa.String(length=200), nullable=True),
        sa.Column("bank_account_name", sa.String(length=200), nullable=True),
        sa.Column("bank_account_no", sa.String(length=100), nullable=True),
        sa.Column("bank_swift", sa.String(length=20), nullable=True),
        sa.Column("bank_name", sa.String(length=200), nullable=True),
        sa.Column("bank_address", sa.Text(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_bank_accounts_id"), "invoice_bank_accounts", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_bank_accounts_bank_account_no"), "invoice_bank_accounts", ["bank_account_no"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_invoice_bank_accounts_bank_account_no"), table_name="invoice_bank_accounts")
    op.drop_index(op.f("ix_invoice_bank_accounts_id"), table_name="invoice_bank_accounts")
    op.drop_table("invoice_bank_accounts")
