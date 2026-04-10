"""add_income_status

Revision ID: 32e38f31a3bd
Revises: c4d8e6f1a2b3
Create Date: 2026-04-10 21:17:03.007742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32e38f31a3bd'
down_revision: Union[str, Sequence[str], None] = 'c4d8e6f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status and revision_comment columns to periodincome
    with op.batch_alter_table('periodincome') as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(), nullable=True, server_default='Current'))
        batch_op.add_column(sa.Column('revision_comment', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('periodincome') as batch_op:
        batch_op.drop_column('revision_comment')
        batch_op.drop_column('status')
