"""service quote hs reference

Revision ID: e3f4a5b6c7d8
Revises: e2f3a4b5c6d7
Create Date: 2026-04-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("service_quotes", sa.Column("hs_code_ref_id", sa.Integer(), nullable=True))
    op.add_column("service_quotes", sa.Column("hs_code", sa.String(length=30), nullable=True))
    op.create_foreign_key(
        "fk_service_quotes_hs_code_ref_id",
        "service_quotes",
        "hs_code_references",
        ["hs_code_ref_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_service_quotes_hs_code_ref_id"), "service_quotes", ["hs_code_ref_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_service_quotes_hs_code_ref_id"), table_name="service_quotes")
    op.drop_constraint("fk_service_quotes_hs_code_ref_id", "service_quotes", type_="foreignkey")
    op.drop_column("service_quotes", "hs_code")
    op.drop_column("service_quotes", "hs_code_ref_id")
