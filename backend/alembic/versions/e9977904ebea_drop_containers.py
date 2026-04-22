"""drop_containers

Revision ID: e9977904ebea
Revises: 86abc6624b29
Create Date: 2026-03-27 10:50:29.205943

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e9977904ebea'
down_revision: Union[str, None] = '86abc6624b29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop FK from invoices → containers, then remove container_id column
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text(
            "ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoices_container_id"
        ))
    op.drop_column('invoices', 'container_id')

    # 2. Drop container_clients (child) then containers (parent)
    op.drop_table('container_clients')
    op.drop_table('containers')

    # 3. Drop the container-type and container-status enums if they exist
    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text("DROP TYPE IF EXISTS containertype CASCADE"))
        bind.execute(sa.text("DROP TYPE IF EXISTS containerstatus CASCADE"))
        bind.execute(sa.text("DROP TYPE IF EXISTS cargomode CASCADE"))


def downgrade() -> None:
    pass  # No rollback — rebuild from scratch when needed
