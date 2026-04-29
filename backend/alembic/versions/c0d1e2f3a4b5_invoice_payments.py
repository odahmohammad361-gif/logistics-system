"""invoice payments

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-04-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invoice_payment_schedule",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("trigger", sa.String(length=120), nullable=True),
        sa.Column("percent", sa.Numeric(7, 3), nullable=False, server_default="100"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_payment_schedule_id"), "invoice_payment_schedule", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_payment_schedule_invoice_id"), "invoice_payment_schedule", ["invoice_id"], unique=False)

    op.create_table(
        "invoice_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("receipt_number", sa.String(length=80), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("payment_method", sa.String(length=40), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reference_no", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("accounting_entry_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["accounting_entry_id"], ["accounting_entries.id"]),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("receipt_number"),
    )
    op.create_index(op.f("ix_invoice_payments_accounting_entry_id"), "invoice_payments", ["accounting_entry_id"], unique=False)
    op.create_index(op.f("ix_invoice_payments_branch_id"), "invoice_payments", ["branch_id"], unique=False)
    op.create_index(op.f("ix_invoice_payments_id"), "invoice_payments", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_payments_invoice_id"), "invoice_payments", ["invoice_id"], unique=False)
    op.create_index(op.f("ix_invoice_payments_receipt_number"), "invoice_payments", ["receipt_number"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_invoice_payments_receipt_number"), table_name="invoice_payments")
    op.drop_index(op.f("ix_invoice_payments_invoice_id"), table_name="invoice_payments")
    op.drop_index(op.f("ix_invoice_payments_id"), table_name="invoice_payments")
    op.drop_index(op.f("ix_invoice_payments_branch_id"), table_name="invoice_payments")
    op.drop_index(op.f("ix_invoice_payments_accounting_entry_id"), table_name="invoice_payments")
    op.drop_table("invoice_payments")

    op.drop_index(op.f("ix_invoice_payment_schedule_invoice_id"), table_name="invoice_payment_schedule")
    op.drop_index(op.f("ix_invoice_payment_schedule_id"), table_name="invoice_payment_schedule")
    op.drop_table("invoice_payment_schedule")
