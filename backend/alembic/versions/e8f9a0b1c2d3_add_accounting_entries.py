"""add_accounting_entries

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-04-27 10:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS accountingdirection")
    op.execute("DROP TYPE IF EXISTS accountingstatus")

    op.create_table(
        "accounting_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entry_number", sa.String(length=60), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("payment_method", sa.String(length=40), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("counterparty_type", sa.String(length=40), nullable=True),
        sa.Column("counterparty_name", sa.String(length=250), nullable=True),
        sa.Column("reference_no", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("shipping_agent_id", sa.Integer(), nullable=True),
        sa.Column("clearance_agent_id", sa.Integer(), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("tax_rate_pct", sa.Numeric(7, 3), nullable=True),
        sa.Column("tax_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("has_official_tax_invoice", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["clearance_agent_id"], ["clearance_agents.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["shipping_agent_id"], ["shipping_agents.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entry_number"),
    )
    for col in (
        "id",
        "entry_number",
        "direction",
        "status",
        "entry_date",
        "payment_method",
        "category",
        "counterparty_type",
        "reference_no",
        "client_id",
        "invoice_id",
        "booking_id",
        "shipping_agent_id",
        "clearance_agent_id",
        "supplier_id",
        "branch_id",
    ):
        op.create_index(op.f(f"ix_accounting_entries_{col}"), "accounting_entries", [col], unique=False)

    op.create_table(
        "accounting_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entry_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=40), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["entry_id"], ["accounting_entries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for col in ("id", "entry_id", "document_type"):
        op.create_index(op.f(f"ix_accounting_attachments_{col}"), "accounting_attachments", [col], unique=False)


def downgrade() -> None:
    for col in ("document_type", "entry_id", "id"):
        op.drop_index(op.f(f"ix_accounting_attachments_{col}"), table_name="accounting_attachments")
    op.drop_table("accounting_attachments")

    for col in (
        "branch_id",
        "supplier_id",
        "clearance_agent_id",
        "shipping_agent_id",
        "booking_id",
        "invoice_id",
        "client_id",
        "reference_no",
        "counterparty_type",
        "category",
        "payment_method",
        "entry_date",
        "status",
        "direction",
        "entry_number",
        "id",
    ):
        op.drop_index(op.f(f"ix_accounting_entries_{col}"), table_name="accounting_entries")
    op.drop_table("accounting_entries")
