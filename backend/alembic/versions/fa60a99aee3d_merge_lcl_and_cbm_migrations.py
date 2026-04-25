"""merge_lcl_and_cbm_migrations

Revision ID: fa60a99aee3d
Revises: a0b1c2d3e4f5, b5c6d7e8f9a0
Create Date: 2026-04-26 02:39:26.981766

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa60a99aee3d'
down_revision: Union[str, None] = ('a0b1c2d3e4f5', 'b5c6d7e8f9a0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
