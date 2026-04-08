"""add_auto_expense_settings

Revision ID: 2ef0f1a2f1ba
Revises: abfa823847b9
Create Date: 2026-04-08 16:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2ef0f1a2f1ba"
down_revision: Union[str, Sequence[str], None] = "abfa823847b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("budgets", sa.Column("auto_expense_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("budgets", sa.Column("auto_expense_offset_days", sa.Integer(), nullable=False, server_default="0"))

    op.execute(
        sa.text(
            """
            UPDATE expenseitems
            SET paytype = 'MANUAL'
            WHERE paytype = 'AUTO'
              AND (
                freqtype IS NULL
                OR freqtype = 'Always'
                OR (
                  freqtype IN ('Fixed Day of Month', 'Every N Days')
                  AND (frequency_value IS NULL OR effectivedate IS NULL)
                )
              )
            """
        )
    )

def downgrade() -> None:
    op.drop_column("budgets", "auto_expense_offset_days")
    op.drop_column("budgets", "auto_expense_enabled")
