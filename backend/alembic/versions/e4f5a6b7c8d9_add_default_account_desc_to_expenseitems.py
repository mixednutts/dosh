"""add default_account_desc to expenseitems

Revision ID: e4f5a6b7c8d9
Revises: d3091a75b8ff
Create Date: 2026-04-12 10:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e4f5a6b7c8d9'
down_revision = 'd3091a75b8ff'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('expenseitems', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_account_desc', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('expenseitems', schema=None) as batch_op:
        batch_op.drop_column('default_account_desc')
