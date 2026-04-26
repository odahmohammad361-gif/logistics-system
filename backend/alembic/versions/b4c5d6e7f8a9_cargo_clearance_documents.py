"""cargo_clearance_documents

Revision ID: b4c5d6e7f8a9
Revises: a2b3c4d5e6f7
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa


revision = "b4c5d6e7f8a9"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_cargo_lines", sa.Column("clearance_through_us", sa.Boolean(), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("clearance_agent_id", sa.Integer(), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("clearance_agent_rate_id", sa.Integer(), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("manual_clearance_agent_name", sa.String(length=200), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("manual_clearance_agent_phone", sa.String(length=60), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("manual_clearance_agent_notes", sa.Text(), nullable=True))
    op.create_foreign_key("fk_booking_cargo_lines_clearance_agent_id", "booking_cargo_lines", "clearance_agents", ["clearance_agent_id"], ["id"])
    op.create_foreign_key("fk_booking_cargo_lines_clearance_agent_rate_id", "booking_cargo_lines", "clearance_agent_rates", ["clearance_agent_rate_id"], ["id"])

    op.create_table(
        "booking_cargo_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cargo_line_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=40), nullable=False),
        sa.Column("custom_file_type", sa.String(length=120), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["cargo_line_id"], ["booking_cargo_lines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_booking_cargo_documents_id"), "booking_cargo_documents", ["id"], unique=False)
    op.create_index(op.f("ix_booking_cargo_documents_cargo_line_id"), "booking_cargo_documents", ["cargo_line_id"], unique=False)
    op.create_index(op.f("ix_booking_cargo_documents_document_type"), "booking_cargo_documents", ["document_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_booking_cargo_documents_document_type"), table_name="booking_cargo_documents")
    op.drop_index(op.f("ix_booking_cargo_documents_cargo_line_id"), table_name="booking_cargo_documents")
    op.drop_index(op.f("ix_booking_cargo_documents_id"), table_name="booking_cargo_documents")
    op.drop_table("booking_cargo_documents")
    op.drop_constraint("fk_booking_cargo_lines_clearance_agent_rate_id", "booking_cargo_lines", type_="foreignkey")
    op.drop_constraint("fk_booking_cargo_lines_clearance_agent_id", "booking_cargo_lines", type_="foreignkey")
    op.drop_column("booking_cargo_lines", "manual_clearance_agent_notes")
    op.drop_column("booking_cargo_lines", "manual_clearance_agent_phone")
    op.drop_column("booking_cargo_lines", "manual_clearance_agent_name")
    op.drop_column("booking_cargo_lines", "clearance_agent_rate_id")
    op.drop_column("booking_cargo_lines", "clearance_agent_id")
    op.drop_column("booking_cargo_lines", "clearance_through_us")
