"""link_cargo_lines_to_invoices_and_customs

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("booking_cargo_lines", sa.Column("invoice_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_booking_cargo_lines_invoice_id_invoices",
        "booking_cargo_lines",
        "invoices",
        ["invoice_id"],
        ["id"],
    )
    op.create_index(op.f("ix_booking_cargo_lines_invoice_id"), "booking_cargo_lines", ["invoice_id"], unique=False)

    op.add_column("customs_estimates", sa.Column("booking_cargo_line_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_customs_estimates_booking_cargo_line_id",
        "customs_estimates",
        "booking_cargo_lines",
        ["booking_cargo_line_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_customs_estimates_booking_cargo_line_id"),
        "customs_estimates",
        ["booking_cargo_line_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_customs_estimates_booking_cargo_line_id"), table_name="customs_estimates")
    op.drop_constraint("fk_customs_estimates_booking_cargo_line_id", "customs_estimates", type_="foreignkey")
    op.drop_column("customs_estimates", "booking_cargo_line_id")

    op.drop_index(op.f("ix_booking_cargo_lines_invoice_id"), table_name="booking_cargo_lines")
    op.drop_constraint("fk_booking_cargo_lines_invoice_id_invoices", "booking_cargo_lines", type_="foreignkey")
    op.drop_column("booking_cargo_lines", "invoice_id")
