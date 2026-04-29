"""service quote integrations

Revision ID: e2f3a4b5c6d7
Revises: e0f1a2b3c4d5
Create Date: 2026-04-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "e0f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_quote_city_fees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("origin_country", sa.String(length=80), nullable=True, server_default="China"),
        sa.Column("origin_city", sa.String(length=120), nullable=False),
        sa.Column("port_of_loading", sa.String(length=150), nullable=True),
        sa.Column("service_scope", sa.String(length=40), nullable=True),
        sa.Column("buy_trucking", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sell_trucking", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("buy_handling", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("sell_handling", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_service_quote_city_fees_id"), "service_quote_city_fees", ["id"], unique=False)
    op.create_index(op.f("ix_service_quote_city_fees_origin_city"), "service_quote_city_fees", ["origin_city"], unique=False)
    op.create_index(op.f("ix_service_quote_city_fees_port_of_loading"), "service_quote_city_fees", ["port_of_loading"], unique=False)

    op.add_column("service_quotes", sa.Column("clearance_agent_id", sa.Integer(), nullable=True))
    op.add_column("service_quotes", sa.Column("clearance_agent_rate_id", sa.Integer(), nullable=True))
    op.add_column("service_quotes", sa.Column("customs_value_usd", sa.Numeric(14, 2), nullable=True))
    op.add_column("service_quotes", sa.Column("city_fee_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_service_quotes_clearance_agent_id", "service_quotes", "clearance_agents", ["clearance_agent_id"], ["id"])
    op.create_foreign_key("fk_service_quotes_clearance_agent_rate_id", "service_quotes", "clearance_agent_rates", ["clearance_agent_rate_id"], ["id"])
    op.create_foreign_key("fk_service_quotes_city_fee_id", "service_quotes", "service_quote_city_fees", ["city_fee_id"], ["id"])
    op.create_index(op.f("ix_service_quotes_clearance_agent_id"), "service_quotes", ["clearance_agent_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_clearance_agent_rate_id"), "service_quotes", ["clearance_agent_rate_id"], unique=False)
    op.create_index(op.f("ix_service_quotes_city_fee_id"), "service_quotes", ["city_fee_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_service_quotes_city_fee_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_clearance_agent_rate_id"), table_name="service_quotes")
    op.drop_index(op.f("ix_service_quotes_clearance_agent_id"), table_name="service_quotes")
    op.drop_constraint("fk_service_quotes_city_fee_id", "service_quotes", type_="foreignkey")
    op.drop_constraint("fk_service_quotes_clearance_agent_rate_id", "service_quotes", type_="foreignkey")
    op.drop_constraint("fk_service_quotes_clearance_agent_id", "service_quotes", type_="foreignkey")
    op.drop_column("service_quotes", "city_fee_id")
    op.drop_column("service_quotes", "customs_value_usd")
    op.drop_column("service_quotes", "clearance_agent_rate_id")
    op.drop_column("service_quotes", "clearance_agent_id")

    op.drop_index(op.f("ix_service_quote_city_fees_port_of_loading"), table_name="service_quote_city_fees")
    op.drop_index(op.f("ix_service_quote_city_fees_origin_city"), table_name="service_quote_city_fees")
    op.drop_index(op.f("ix_service_quote_city_fees_id"), table_name="service_quote_city_fees")
    op.drop_table("service_quote_city_fees")
