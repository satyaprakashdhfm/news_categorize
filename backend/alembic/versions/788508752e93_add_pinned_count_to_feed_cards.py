"""add_pinned_count_to_feed_cards

Revision ID: 788508752e93
Revises: aacb1c843436
Create Date: 2026-05-09 11:24:12.379940

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '788508752e93'
down_revision: Union[str, Sequence[str], None] = 'aacb1c843436'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('feed_cards', sa.Column('pinned_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('feed_cards', 'pinned_count')
