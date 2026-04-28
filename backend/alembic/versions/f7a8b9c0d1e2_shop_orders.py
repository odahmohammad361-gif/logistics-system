"""shop orders

Revision ID: f7a8b9c0d1e2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f7a8b9c0d1e2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shop_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_number", sa.String(length=60), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("invoice_package_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="submitted"),
        sa.Column("destination", sa.String(length=30), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("subtotal_usd", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_cartons", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("total_pieces", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("total_cbm", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("total_gross_weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["invoice_package_id"], ["invoice_packages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_number"),
    )
    op.create_index(op.f("ix_shop_orders_id"), "shop_orders", ["id"], unique=False)
    op.create_index(op.f("ix_shop_orders_order_number"), "shop_orders", ["order_number"], unique=False)
    op.create_index(op.f("ix_shop_orders_customer_id"), "shop_orders", ["customer_id"], unique=False)
    op.create_index(op.f("ix_shop_orders_client_id"), "shop_orders", ["client_id"], unique=False)
    op.create_index(op.f("ix_shop_orders_invoice_package_id"), "shop_orders", ["invoice_package_id"], unique=False)
    op.create_index(op.f("ix_shop_orders_status"), "shop_orders", ["status"], unique=False)
    op.create_index(op.f("ix_shop_orders_destination"), "shop_orders", ["destination"], unique=False)

    op.create_table(
        "shop_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("product_code", sa.String(length=80), nullable=True),
        sa.Column("product_name", sa.Text(), nullable=False),
        sa.Column("product_name_ar", sa.Text(), nullable=True),
        sa.Column("hs_code", sa.String(length=30), nullable=True),
        sa.Column("cartons", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("pcs_per_carton", sa.Numeric(14, 3), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit_price_usd", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("total_price_usd", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("cbm", sa.Numeric(14, 4), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("net_weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["shop_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shop_order_items_id"), "shop_order_items", ["id"], unique=False)
    op.create_index(op.f("ix_shop_order_items_order_id"), "shop_order_items", ["order_id"], unique=False)
    op.create_index(op.f("ix_shop_order_items_product_id"), "shop_order_items", ["product_id"], unique=False)
    op.create_index(op.f("ix_shop_order_items_hs_code"), "shop_order_items", ["hs_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_shop_order_items_hs_code"), table_name="shop_order_items")
    op.drop_index(op.f("ix_shop_order_items_product_id"), table_name="shop_order_items")
    op.drop_index(op.f("ix_shop_order_items_order_id"), table_name="shop_order_items")
    op.drop_index(op.f("ix_shop_order_items_id"), table_name="shop_order_items")
    op.drop_table("shop_order_items")

    op.drop_index(op.f("ix_shop_orders_destination"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_status"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_invoice_package_id"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_client_id"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_customer_id"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_order_number"), table_name="shop_orders")
    op.drop_index(op.f("ix_shop_orders_id"), table_name="shop_orders")
    op.drop_table("shop_orders")
