"""add user country/timezone and user_interactions table

Revision ID: b2c3d4e5f6a7
Revises: aacb1c843436
Create Date: 2026-05-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timezone to users
    op.add_column('users', sa.Column('timezone', sa.String(length=64), nullable=True, server_default='UTC'))

    # Add experiment group to recommendations for A/B testing
    op.add_column('user_recommendations', sa.Column('experiment', sa.String(length=32), nullable=True))

    # Create user_interactions table for click/dismiss tracking
    op.create_table(
        'user_interactions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rec_id', sa.String(), sa.ForeignKey('user_recommendations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_url', sa.String(length=1024), nullable=True),
        sa.Column('domain', sa.String(length=8), nullable=True),
        sa.Column('subdomain', sa.String(length=8), nullable=True),
        sa.Column('source_type', sa.String(length=16), nullable=True),
        sa.Column('action', sa.String(length=16), nullable=False),
        sa.Column('dwell_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_user_interactions_user_id', 'user_interactions', ['user_id'])
    op.create_index('ix_user_interactions_created_at', 'user_interactions', ['created_at'])


def downgrade() -> None:
    op.drop_column('user_recommendations', 'experiment')
    op.drop_index('ix_user_interactions_created_at', table_name='user_interactions')
    op.drop_index('ix_user_interactions_user_id', table_name='user_interactions')
    op.drop_table('user_interactions')
    op.drop_column('users', 'timezone')
