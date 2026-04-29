"""service quotes

Revision ID: d9e0f1a2b3c4
Revises: d1e2f3a4b5c6
Create Date: 2026-04-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_quotes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("quote_number", sa.String(length=60), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("booking_cargo_line_id", sa.Integer(), nullable=True),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("service_scope", sa.String(length=40), nullable=False, server_default="warehouse_to_port"),
        sa.Column("cargo_source", sa.String(length=40), nullable=False, server_default="outside_supplier"),
        sa.Column("origin_country", sa.String(length=80), nullable=True),
        sa.Column("origin_city", sa.String(length=120), nullable=True),
        sa.Column("pickup_address", sa.Text(), nullable=True),
        sa.Column("loading_warehouse_id", sa.Integer(), nullable=True),
        sa.Column("port_of_loading", sa.String(length=150), nullable=True),
        sa.Column("port_of_discharge", sa.String(length=150), nullable=True),
        sa.Column("destination_country", sa.String(length=80), nullable=True),
        sa.Column("destination_city", sa.String(length=120), nullable=True),
        sa.Column("final_address", sa.Text(), nullable=True),
        sa.Column("container_size", sa.String(length=10), nullable=True),
        sa.Column("cbm", sa.Numeric(10, 4), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(12, 3), nullable=True),
        sa.Column("chargeable_weight_kg", sa.Numeric(12, 3), nullable=True),
        sa.Column("cartons", sa.Integer(), nullable=True),
        sa.Column("goods_description", sa.Text(), nullable=True),
        sa.Column("clearance_through_us", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("delivery_through_us", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("shipping_agent_id", sa.Integer(), nullable=True),
        sa.Column("agent_carrier_rate_id", sa.Integer(), nullable=True),
        sa.Column("agent_quote_id", sa.Integer(), nullable=True),
        sa.Column("carrier_name", sa.String(length=120), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("rate_basis", sa.String(length=30), nullable=True),
        sa.Column("buy_rate", sa.Numeric(14, 4), nullable=True),
        sa.Column("sell_rate", sa.Numeric(14, 4), nullable=True),
        sa.Column("chargeable_quantity", sa.Numeric(14, 4), nullable=True),
        sa.Column("freight_buy", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("freight_sell", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("origin_fees_buy", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("origin_fees_sell", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("destination_fees_buy", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("destination_fees_sell", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_fees_buy", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_fees_sell", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_buy", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_sell", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("profit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("margin_pct", sa.Numeric(8, 2), nullable=True),
        sa.Column("rate_snapshot", sa.JSON(), nullable=True),
        sa.Column("calculation_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["agent_carrier_rate_id"], ["agent_carrier_rates.id"]),
        sa.ForeignKeyConstraint(["agent_quote_id"], ["shipping_quotes.id"]),
        sa.ForeignKeyConstraint(["booking_cargo_line_id"], ["booking_cargo_lines.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["loading_warehouse_id"], ["company_warehouses.id"]),
        sa.ForeignKeyConstraint(["shipping_agent_id"], ["shipping_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quote_number"),
    )
    op.create_index(op.f("ix_service_quotes_id"), "service_quotes", ["id"], unique=False)
    op.create_index(op.f("ix_service_quotes_quote_number"), "service_quotes", ["quote_number"], unique=False)
    op.create_index(op.f("ix_service_quotes_client_id"), "service_quotes", ["client_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_invoice_id"), "service_quotes", ["invoice_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_booking_id"), "service_quotes", ["booking_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_booking_cargo_line_id"), "service_quotes", ["booking_cargo_line_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_mode"), "service_quotes", ["mode"], unique=False)
    op.create_index(op.f("ix_service_quotes_status"), "service_quotes", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_service_quotes_status"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_mode"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_booking_cargo_line_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_booking_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_invoice_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_client_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_quote_number"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_id"), table_name="service_quotes")
    op.drop_table("service_quotes")
