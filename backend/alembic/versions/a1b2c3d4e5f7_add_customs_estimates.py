"""add_customs_estimates

Revision ID: a1b2c3d4e5f7
Revises: f0a1b2c3d4e5
Create Date: 2026-04-27 17:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customs_estimates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("estimate_number", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=250), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("product_value_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("shipping_cost_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("customs_base_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("customs_duty_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("sales_tax_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("other_tax_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_taxes_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("landed_estimate_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("estimate_number"),
    )
    op.create_index(op.f("ix_customs_estimates_booking_id"), "customs_estimates", ["booking_id"], unique=False)
    op.create_index(op.f("ix_customs_estimates_client_id"), "customs_estimates", ["client_id"], unique=False)
    op.create_index(op.f("ix_customs_estimates_country"), "customs_estimates", ["country"], unique=False)
    op.create_index(op.f("ix_customs_estimates_estimate_number"), "customs_estimates", ["estimate_number"], unique=True)
    op.create_index(op.f("ix_customs_estimates_id"), "customs_estimates", ["id"], unique=False)
    op.create_index(op.f("ix_customs_estimates_invoice_id"), "customs_estimates", ["invoice_id"], unique=False)
    op.create_index(op.f("ix_customs_estimates_is_archived"), "customs_estimates", ["is_archived"], unique=False)
    op.create_index(op.f("ix_customs_estimates_status"), "customs_estimates", ["status"], unique=False)

    op.create_table(
        "customs_estimate_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("estimate_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("description_ar", sa.String(length=500), nullable=True),
        sa.Column("hs_code", sa.String(length=30), nullable=True),
        sa.Column("customs_category", sa.String(length=120), nullable=True),
        sa.Column("unit_basis", sa.String(length=30), nullable=False),
        sa.Column("cartons", sa.Numeric(14, 3), nullable=False),
        sa.Column("pieces_per_carton", sa.Numeric(14, 3), nullable=False),
        sa.Column("total_pieces", sa.Numeric(14, 3), nullable=False),
        sa.Column("gross_weight_kg", sa.Numeric(14, 3), nullable=False),
        sa.Column("customs_units", sa.Numeric(14, 3), nullable=False),
        sa.Column("estimated_value_per_unit_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("shipping_cost_per_unit_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("shipping_cost_total_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("product_value_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("customs_base_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("customs_duty_pct", sa.Numeric(6, 2), nullable=False),
        sa.Column("sales_tax_pct", sa.Numeric(6, 2), nullable=False),
        sa.Column("other_tax_pct", sa.Numeric(6, 2), nullable=False),
        sa.Column("total_tax_pct", sa.Numeric(6, 2), nullable=False),
        sa.Column("customs_duty_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("sales_tax_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("other_tax_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_taxes_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("landed_estimate_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["estimate_id"], ["customs_estimates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_customs_estimate_lines_customs_category"), "customs_estimate_lines", ["customs_category"], unique=False)
    op.create_index(op.f("ix_customs_estimate_lines_estimate_id"), "customs_estimate_lines", ["estimate_id"], unique=False)
    op.create_index(op.f("ix_customs_estimate_lines_hs_code"), "customs_estimate_lines", ["hs_code"], unique=False)
    op.create_index(op.f("ix_customs_estimate_lines_id"), "customs_estimate_lines", ["id"], unique=False)
    op.create_index(op.f("ix_customs_estimate_lines_product_id"), "customs_estimate_lines", ["product_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_customs_estimate_lines_product_id"), table_name="customs_estimate_lines")
    op.drop_index(op.f("ix_customs_estimate_lines_id"), table_name="customs_estimate_lines")
    op.drop_index(op.f("ix_customs_estimate_lines_hs_code"), table_name="customs_estimate_lines")
    op.drop_index(op.f("ix_customs_estimate_lines_estimate_id"), table_name="customs_estimate_lines")
    op.drop_index(op.f("ix_customs_estimate_lines_customs_category"), table_name="customs_estimate_lines")
    op.drop_table("customs_estimate_lines")
    op.drop_index(op.f("ix_customs_estimates_status"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_is_archived"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_invoice_id"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_id"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_estimate_number"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_country"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_client_id"), table_name="customs_estimates")
    op.drop_index(op.f("ix_customs_estimates_booking_id"), table_name="customs_estimates")
    op.drop_table("customs_estimates")
