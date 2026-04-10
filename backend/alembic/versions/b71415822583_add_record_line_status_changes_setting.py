"""Add record_line_status_changes setting

Revision ID: b71415822583
Revises: 32e38f31a3bd
Create Date: 2026-04-11 06:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b71415822583'
down_revision: Union[str, Sequence[str], None] = '32e38f31a3bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add record_line_status_changes column to budgets table
    op.add_column(
        'budgets',
        sa.Column(
            'record_line_status_changes',
            sa.Boolean(),
            nullable=False,
            server_default='0'
        )
    )


def downgrade() -> None:
    # Drop record_line_status_changes column from budgets table
    op.drop_column('budgets', 'record_line_status_changes')
