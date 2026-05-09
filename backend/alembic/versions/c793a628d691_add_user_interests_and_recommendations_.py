"""add user interests and recommendations table

Revision ID: c793a628d691
Revises:
Create Date: 2026-04-25 12:20:09.045479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c793a628d691'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add interests JSON column to users table
    op.add_column('users', sa.Column('interests', sa.JSON(), nullable=True))

    # Add self-contained article fields to user_recommendations
    op.add_column('user_recommendations', sa.Column('title', sa.String(length=512), nullable=True))
    op.add_column('user_recommendations', sa.Column('summary', sa.Text(), nullable=True))
    op.add_column('user_recommendations', sa.Column('source_url', sa.String(length=1024), nullable=True))
    op.add_column('user_recommendations', sa.Column('source_type', sa.String(length=16), nullable=True))
    op.add_column('user_recommendations', sa.Column('image_url', sa.String(length=1024), nullable=True))
    op.add_column('user_recommendations', sa.Column('score', sa.Integer(), nullable=True))

    # Make card_id nullable (recommendations can be self-contained without a feed card)
    op.alter_column('user_recommendations', 'card_id',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.drop_constraint('user_recommendations_card_id_fkey', 'user_recommendations', type_='foreignkey')
    op.create_foreign_key('user_recommendations_card_id_fkey', 'user_recommendations', 'feed_cards', ['card_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_column('users', 'interests')
    op.drop_constraint('user_recommendations_card_id_fkey', 'user_recommendations', type_='foreignkey')
    op.create_foreign_key('user_recommendations_card_id_fkey', 'user_recommendations', 'feed_cards', ['card_id'], ['id'], ondelete='CASCADE')
    op.alter_column('user_recommendations', 'card_id',
               existing_type=sa.VARCHAR(),
               nullable=False)
    op.drop_column('user_recommendations', 'score')
    op.drop_column('user_recommendations', 'image_url')
    op.drop_column('user_recommendations', 'source_type')
    op.drop_column('user_recommendations', 'source_url')
    op.drop_column('user_recommendations', 'summary')
    op.drop_column('user_recommendations', 'title')
