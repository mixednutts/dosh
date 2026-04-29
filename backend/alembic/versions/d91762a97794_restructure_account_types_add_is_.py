"""restructure_account_types_add_is_savings_remove_account_naming

Revision ID: d91762a97794
Revises: 5a87833110e0
Create Date: 2026-04-29 18:25:10.586374

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd91762a97794'
down_revision: Union[str, Sequence[str], None] = '5a87833110e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_savings to balancetypes
    op.add_column('balancetypes', sa.Column('is_savings', sa.Boolean(), nullable=False, server_default='0'))

    # Backfill balance_type remap
    op.execute("UPDATE balancetypes SET balance_type = 'Banking', is_savings = 1 WHERE balance_type = 'Savings'")
    op.execute("UPDATE balancetypes SET balance_type = 'Banking', is_savings = 0 WHERE balance_type = 'Transaction'")
    # Cash stays Cash with is_savings = false (default)

    # Add allow_overdraft_transactions to budgets
    op.add_column('budgets', sa.Column('allow_overdraft_transactions', sa.Boolean(), nullable=False, server_default='0'))

    # Drop account_naming_preference from budgets
    op.drop_column('budgets', 'account_naming_preference')


def downgrade() -> None:
    # Restore account_naming_preference
    op.add_column('budgets', sa.Column('account_naming_preference', sa.String(), nullable=False, server_default='Transaction'))

    # Drop allow_overdraft_transactions
    op.drop_column('budgets', 'allow_overdraft_transactions')

    # Drop is_savings from balancetypes
    op.drop_column('balancetypes', 'is_savings')

    # Note: We cannot perfectly restore Transaction vs Savings distinction
    # since both map to Banking. Downgrade leaves all as Banking.
