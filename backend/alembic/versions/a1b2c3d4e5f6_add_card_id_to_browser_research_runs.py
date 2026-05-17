"""add_card_id_to_browser_research_runs

Revision ID: a1b2c3d4e5f6
Revises: 788508752e93
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '788508752e93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'browser_research_runs',
        sa.Column('card_id', sa.String(), nullable=True),
    )
    op.create_foreign_key(
        'fk_browser_research_runs_card_id',
        'browser_research_runs', 'feed_cards',
        ['card_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_browser_research_runs_card_id',
        'browser_research_runs', ['card_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_browser_research_runs_card_id', table_name='browser_research_runs')
    op.drop_constraint('fk_browser_research_runs_card_id', 'browser_research_runs', type_='foreignkey')
    op.drop_column('browser_research_runs', 'card_id')
