"""merge_heads

Revision ID: 86abc6624b29
Revises: e1a2b3c4d5e6, f3a1b2c9d0e7
Create Date: 2026-03-27 09:14:25.974394

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86abc6624b29'
down_revision: Union[str, None] = ('e1a2b3c4d5e6', 'f3a1b2c9d0e7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
