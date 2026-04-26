"""cargo_source_flags

Revision ID: b5c6d7e8f9a1
Revises: b4c5d6e7f8a9
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa


revision = "b5c6d7e8f9a1"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_cargo_lines", sa.Column("goods_source", sa.String(length=40), nullable=True))
    op.add_column("booking_cargo_lines", sa.Column("is_full_container_client", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    op.drop_column("booking_cargo_lines", "is_full_container_client")
    op.drop_column("booking_cargo_lines", "goods_source")
