"""add max_forward_balance_cycles to budgets

Revision ID: b10a29f14a8f
Revises: f1a2b3c4d5e6
Create Date: 2026-04-13 09:27:46.073900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b10a29f14a8f'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('budgets', sa.Column('max_forward_balance_cycles', sa.Integer(), nullable=False, server_default='10'))


def downgrade() -> None:
    op.drop_column('budgets', 'max_forward_balance_cycles')
