"""add source_account_desc to investment items

Revision ID: 4bf1bf54b0bb
Revises: 559cbaa1dce7
Create Date: 2026-04-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4bf1bf54b0bb'
down_revision: Union[str, Sequence[str], None] = '559cbaa1dce7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('investmentitems', sa.Column('source_account_desc', sa.String(), nullable=True))

    # Backfill existing investment items with the primary transaction account as the source
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE investmentitems
        SET source_account_desc = (
            SELECT bt.balancedesc
            FROM balancetypes bt
            WHERE bt.budgetid = investmentitems.budgetid
              AND bt.balance_type = 'Transaction'
              AND bt.is_primary = 1
              AND bt.active = 1
            LIMIT 1
        )
        WHERE source_account_desc IS NULL
    """))


def downgrade() -> None:
    op.drop_column('investmentitems', 'source_account_desc')
