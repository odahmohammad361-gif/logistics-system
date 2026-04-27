"""add_product_customs_fields

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-04-27 14:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("price_usd", sa.Numeric(14, 4), nullable=True))
    op.add_column("products", sa.Column("hs_code", sa.String(length=30), nullable=True))
    op.add_column("products", sa.Column("origin_country", sa.String(length=100), nullable=True))
    op.add_column("products", sa.Column("customs_category", sa.String(length=120), nullable=True))
    op.add_column("products", sa.Column("customs_unit_basis", sa.String(length=30), nullable=True))
    op.add_column("products", sa.Column("customs_estimated_value_usd", sa.Numeric(14, 4), nullable=True))
    op.add_column("products", sa.Column("customs_duty_pct", sa.Numeric(6, 2), nullable=True))
    op.add_column("products", sa.Column("sales_tax_pct", sa.Numeric(6, 2), nullable=True))
    op.add_column("products", sa.Column("other_tax_pct", sa.Numeric(6, 2), nullable=True))
    op.add_column("products", sa.Column("gross_weight_kg_per_carton", sa.Numeric(10, 3), nullable=True))
    op.add_column("products", sa.Column("net_weight_kg_per_carton", sa.Numeric(10, 3), nullable=True))
    op.add_column("products", sa.Column("carton_length_cm", sa.Numeric(8, 2), nullable=True))
    op.add_column("products", sa.Column("carton_width_cm", sa.Numeric(8, 2), nullable=True))
    op.add_column("products", sa.Column("carton_height_cm", sa.Numeric(8, 2), nullable=True))
    op.add_column("products", sa.Column("customs_notes", sa.Text(), nullable=True))
    op.create_index(op.f("ix_products_hs_code"), "products", ["hs_code"], unique=False)
    op.create_index(op.f("ix_products_customs_category"), "products", ["customs_category"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_customs_category"), table_name="products")
    op.drop_index(op.f("ix_products_hs_code"), table_name="products")
    op.drop_column("products", "customs_notes")
    op.drop_column("products", "carton_height_cm")
    op.drop_column("products", "carton_width_cm")
    op.drop_column("products", "carton_length_cm")
    op.drop_column("products", "net_weight_kg_per_carton")
    op.drop_column("products", "gross_weight_kg_per_carton")
    op.drop_column("products", "other_tax_pct")
    op.drop_column("products", "sales_tax_pct")
    op.drop_column("products", "customs_duty_pct")
    op.drop_column("products", "customs_estimated_value_usd")
    op.drop_column("products", "customs_unit_basis")
    op.drop_column("products", "customs_category")
    op.drop_column("products", "origin_country")
    op.drop_column("products", "hs_code")
    op.drop_column("products", "price_usd")
