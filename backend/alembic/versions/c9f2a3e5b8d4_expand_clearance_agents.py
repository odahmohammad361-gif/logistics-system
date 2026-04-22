"""expand_clearance_agents

Revision ID: c9f2a3e5b8d4
Revises: b7e4d1f92a30
Create Date: 2026-03-24 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c9f2a3e5b8d4'
down_revision = 'b7e4d1f92a30'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clearance_agents', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('clearance_agents', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('clearance_agents', sa.Column('license_number', sa.String(100), nullable=True))
    op.add_column('clearance_agents', sa.Column('bank_name', sa.String(200), nullable=True))
    op.add_column('clearance_agents', sa.Column('bank_account', sa.String(100), nullable=True))
    op.add_column('clearance_agents', sa.Column('bank_swift', sa.String(20), nullable=True))
    op.add_column('clearance_agents', sa.Column('service_fee', sa.Numeric(10, 2), nullable=True))
    op.add_column('clearance_agents', sa.Column('transport_fee', sa.Numeric(10, 2), nullable=True))
    op.add_column('clearance_agents', sa.Column('handling_fee', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('clearance_agents', 'handling_fee')
    op.drop_column('clearance_agents', 'transport_fee')
    op.drop_column('clearance_agents', 'service_fee')
    op.drop_column('clearance_agents', 'bank_swift')
    op.drop_column('clearance_agents', 'bank_account')
    op.drop_column('clearance_agents', 'bank_name')
    op.drop_column('clearance_agents', 'license_number')
    op.drop_column('clearance_agents', 'address')
    op.drop_column('clearance_agents', 'city')
