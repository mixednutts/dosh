"""backfill transaction accounts and expense defaults

Revision ID: f1a2b3c4d5e6
Revises: e4f5a6b7c8d9
Create Date: 2026-04-12 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # 1. Backfill ExpenseItem.default_account_desc with primary transaction account per budget
    conn.execute(sa.text("""
        UPDATE expenseitems
        SET default_account_desc = (
            SELECT bt.balancedesc
            FROM balancetypes bt
            WHERE bt.budgetid = expenseitems.budgetid
              AND bt.balance_type = 'Transaction'
              AND bt.is_primary = 1
              AND bt.active = 1
            LIMIT 1
        )
        WHERE default_account_desc IS NULL
    """))

    # 2. Backfill PeriodTransaction (expense) from ExpenseItem.default_account_desc
    conn.execute(sa.text("""
        UPDATE periodtransactions
        SET affected_account_desc = (
            SELECT ei.default_account_desc
            FROM expenseitems ei
            WHERE ei.budgetid = periodtransactions.budgetid
              AND ei.expensedesc = periodtransactions.source_key
            LIMIT 1
        )
        WHERE source = 'expense'
          AND affected_account_desc IS NULL
    """))

    # 3. Backfill PeriodTransaction (transfer) with primary transaction account
    conn.execute(sa.text("""
        UPDATE periodtransactions
        SET affected_account_desc = (
            SELECT bt.balancedesc
            FROM balancetypes bt
            WHERE bt.budgetid = periodtransactions.budgetid
              AND bt.balance_type = 'Transaction'
              AND bt.is_primary = 1
              AND bt.active = 1
            LIMIT 1
        )
        WHERE source = 'transfer'
          AND affected_account_desc IS NULL
    """))

    # 4. Backfill PeriodTransaction (investment) from InvestmentItem.linked_account_desc or primary
    conn.execute(sa.text("""
        UPDATE periodtransactions
        SET affected_account_desc = COALESCE(
            (
                SELECT ii.linked_account_desc
                FROM investmentitems ii
                WHERE ii.budgetid = periodtransactions.budgetid
                  AND ii.investmentdesc = periodtransactions.source_key
                LIMIT 1
            ),
            (
                SELECT bt.balancedesc
                FROM balancetypes bt
                WHERE bt.budgetid = periodtransactions.budgetid
                  AND bt.balance_type = 'Transaction'
                  AND bt.is_primary = 1
                  AND bt.active = 1
                LIMIT 1
            )
        )
        WHERE source = 'investment'
          AND affected_account_desc IS NULL
    """))


def downgrade():
    # No schema change to reverse; data backfill is intentionally retained
    pass
