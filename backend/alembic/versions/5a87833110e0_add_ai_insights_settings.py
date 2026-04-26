"""add_ai_insights_settings

Revision ID: 5a87833110e0
Revises: z1_drop_legacy_transaction_tables
Create Date: 2026-04-26 08:56:03.236170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a87833110e0'
down_revision: Union[str, Sequence[str], None] = '8e182dad69ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add AI settings columns to budgets table
    op.add_column('budgets', sa.Column('ai_insights_enabled', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('budgets', sa.Column('ai_provider', sa.String(), nullable=True))
    op.add_column('budgets', sa.Column('ai_model', sa.String(), nullable=True))
    op.add_column('budgets', sa.Column('ai_api_key_encrypted', sa.String(), nullable=True))
    op.add_column('budgets', sa.Column('ai_base_url', sa.String(), nullable=True))
    op.add_column('budgets', sa.Column('ai_custom_model', sa.String(), nullable=True))
    op.add_column('budgets', sa.Column('ai_system_prompt', sa.Text(), nullable=True))
    op.add_column('budgets', sa.Column('ai_insights_on_closeout', sa.Boolean(), nullable=False, server_default=sa.text('0')))

    # Add AI insight text to close-out snapshot table
    op.add_column('periodcloseouts', sa.Column('ai_insight_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('periodcloseouts', 'ai_insight_text')

    op.drop_column('budgets', 'ai_insights_on_closeout')
    op.drop_column('budgets', 'ai_system_prompt')
    op.drop_column('budgets', 'ai_custom_model')
    op.drop_column('budgets', 'ai_base_url')
    op.drop_column('budgets', 'ai_api_key_encrypted')
    op.drop_column('budgets', 'ai_model')
    op.drop_column('budgets', 'ai_provider')
    op.drop_column('budgets', 'ai_insights_enabled')
