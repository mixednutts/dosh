"""Drop legacy transaction tables if they still exist.

Revision ID: z1_drop_legacy_transaction_tables
Revises: 8e182dad69ad
Create Date: 2026-04-21 08:40:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'z1_drop_legacy_transaction_tables'
down_revision: Union[str, None] = 'fb246c4482b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop legacy transaction tables that can cause FK constraint errors on budget deletion."""
    # These tables were replaced by the unified periodtransactions table
    # but may still exist in databases that weren't fully migrated.
    # They have FK constraints to periodexpenses and periodinvestments that
    # prevent cascade deletion of budgets.
    op.execute("DROP TABLE IF EXISTS periodexpense_transactions")
    op.execute("DROP TABLE IF EXISTS periodinvestment_transactions")


def downgrade() -> None:
    """Cannot recreate legacy tables - they are deprecated."""
    # No downgrade possible - these tables are intentionally deprecated
    pass
