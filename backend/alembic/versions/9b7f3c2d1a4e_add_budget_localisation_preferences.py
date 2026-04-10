"""add_budget_localisation_preferences

Revision ID: 9b7f3c2d1a4e
Revises: 2ef0f1a2f1ba
Create Date: 2026-04-10 08:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b7f3c2d1a4e"
down_revision: Union[str, Sequence[str], None] = "2ef0f1a2f1ba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("budgets", sa.Column("locale", sa.String(), nullable=False, server_default="en-AU"))
    op.add_column("budgets", sa.Column("currency", sa.String(), nullable=False, server_default="AUD"))
    op.add_column("budgets", sa.Column("timezone", sa.String(), nullable=False, server_default="Australia/Sydney"))


def downgrade() -> None:
    op.drop_column("budgets", "timezone")
    op.drop_column("budgets", "currency")
    op.drop_column("budgets", "locale")
