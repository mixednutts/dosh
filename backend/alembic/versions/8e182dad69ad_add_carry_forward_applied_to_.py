"""add carry_forward_applied to periodcloseouts

Revision ID: 8e182dad69ad
Revises: fb246c4482b7
Create Date: 2026-04-19 20:20:28.700462

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '8e182dad69ad'
down_revision: Union[str, Sequence[str], None] = 'fb246c4482b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite requires adding a NOT NULL column with a default value.
    # The application default is False (new close-outs default to unchecked),
    # but existing close-out snapshots must be backfilled as True because
    # historically carry-forward was always applied.
    op.add_column(
        'periodcloseouts',
        sa.Column('carry_forward_applied', sa.Boolean(), nullable=False, server_default='1')
    )


def downgrade() -> None:
    op.drop_column('periodcloseouts', 'carry_forward_applied')
