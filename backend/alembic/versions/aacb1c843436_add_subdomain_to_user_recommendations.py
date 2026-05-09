"""add subdomain to user_recommendations

Revision ID: aacb1c843436
Revises: c793a628d691
Create Date: 2026-04-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'aacb1c843436'
down_revision: Union[str, Sequence[str], None] = 'c793a628d691'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_recommendations', sa.Column('subdomain', sa.String(length=8), nullable=True))


def downgrade() -> None:
    op.drop_column('user_recommendations', 'subdomain')
