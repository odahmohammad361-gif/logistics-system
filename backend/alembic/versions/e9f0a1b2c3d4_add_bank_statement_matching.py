"""add_bank_statement_matching

Revision ID: e9f0a1b2c3d4
Revises: e8f9a0b1c2d3
Create Date: 2026-04-27 11:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e9f0a1b2c3d4"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bank_statement_imports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bank_name", sa.String(length=200), nullable=True),
        sa.Column("account_name", sa.String(length=200), nullable=True),
        sa.Column("account_no", sa.String(length=100), nullable=True),
        sa.Column("statement_from", sa.Date(), nullable=True),
        sa.Column("statement_to", sa.Date(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("line_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="parsed"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bank_statement_imports_id"), "bank_statement_imports", ["id"], unique=False)

    op.create_table(
        "bank_statement_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("statement_id", sa.Integer(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reference_no", sa.String(length=120), nullable=True),
        sa.Column("balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("raw_data", sa.Text(), nullable=True),
        sa.Column("match_status", sa.String(length=20), nullable=False, server_default="unmatched"),
        sa.Column("matched_entry_id", sa.Integer(), nullable=True),
        sa.Column("match_confidence", sa.Integer(), nullable=True),
        sa.Column("match_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["matched_entry_id"], ["accounting_entries.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["statement_id"], ["bank_statement_imports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for col in (
        "id",
        "statement_id",
        "transaction_date",
        "direction",
        "reference_no",
        "match_status",
        "matched_entry_id",
    ):
        op.create_index(op.f(f"ix_bank_statement_lines_{col}"), "bank_statement_lines", [col], unique=False)


def downgrade() -> None:
    for col in (
        "matched_entry_id",
        "match_status",
        "reference_no",
        "direction",
        "transaction_date",
        "statement_id",
        "id",
    ):
        op.drop_index(op.f(f"ix_bank_statement_lines_{col}"), table_name="bank_statement_lines")
    op.drop_table("bank_statement_lines")
    op.drop_index(op.f("ix_bank_statement_imports_id"), table_name="bank_statement_imports")
    op.drop_table("bank_statement_imports")
