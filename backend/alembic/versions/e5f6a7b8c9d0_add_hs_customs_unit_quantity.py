"""add hs customs unit quantity

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hs_code_references",
        sa.Column("customs_unit_quantity", sa.Numeric(14, 4), nullable=True),
    )
    op.execute(
        "UPDATE hs_code_references "
        "SET customs_unit_quantity = 12 "
        "WHERE customs_unit_quantity IS NULL AND lower(coalesce(customs_unit_basis, '')) = 'dozen'"
    )
    op.execute(
        "UPDATE hs_code_references "
        "SET customs_unit_quantity = 1 "
        "WHERE customs_unit_quantity IS NULL AND lower(coalesce(customs_unit_basis, '')) = 'piece'"
    )


def downgrade() -> None:
    op.drop_column("hs_code_references", "customs_unit_quantity")
