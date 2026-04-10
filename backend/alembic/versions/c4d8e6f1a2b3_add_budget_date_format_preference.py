"""add_budget_date_format_preference

Revision ID: c4d8e6f1a2b3
Revises: 9b7f3c2d1a4e
Create Date: 2026-04-10 12:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d8e6f1a2b3"
down_revision: Union[str, Sequence[str], None] = "9b7f3c2d1a4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("budgets", sa.Column("date_format", sa.String(), nullable=False, server_default="medium"))


def downgrade() -> None:
    op.drop_column("budgets", "date_format")
