"""add_missing_users_interests

Revision ID: f1a2b3c4d5e6
Revises: 788508752e93
Create Date: 2026-05-09 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '788508752e93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='interests'"
    ))
    if result.fetchone() is None:
        op.add_column('users', sa.Column('interests', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'interests')
