"""link_invoice_items_to_products

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoice_items", sa.Column("product_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_invoice_items_product_id"), "invoice_items", ["product_id"], unique=False)
    op.create_foreign_key(
        "fk_invoice_items_product_id_products",
        "invoice_items",
        "products",
        ["product_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_invoice_items_product_id_products", "invoice_items", type_="foreignkey")
    op.drop_index(op.f("ix_invoice_items_product_id"), table_name="invoice_items")
    op.drop_column("invoice_items", "product_id")
