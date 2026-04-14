"""rename personalisation to threshold

Revision ID: 009297f69b52
Revises: 7a8b9c0d1e2f
Create Date: 2026-04-15 07:14:57.809849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009297f69b52'
down_revision: Union[str, Sequence[str], None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exec(sql: str) -> None:
    op.execute(sa.text(sql))


def upgrade() -> None:
    # Rename tables
    _exec("ALTER TABLE healthpersonalisationdefinitions RENAME TO healththresholddefinitions")
    _exec("ALTER TABLE budgetmetricpersonalisations RENAME TO budgetmetricthresholds")

    # Rename columns in healththresholddefinitions
    _exec("ALTER TABLE healththresholddefinitions RENAME COLUMN personalisation_key TO threshold_key")

    # Rename columns in budgetmetricthresholds
    _exec("ALTER TABLE budgetmetricthresholds RENAME COLUMN personalisation_key TO threshold_key")

    # Rename columns in healthmetrictemplates
    _exec("ALTER TABLE healthmetrictemplates RENAME COLUMN default_personalisation_key TO default_threshold_key")

    # Rename columns in healthmetrics
    _exec("ALTER TABLE healthmetrics RENAME COLUMN personalisation_key TO threshold_key")


def downgrade() -> None:
    # Reverse column renames
    _exec("ALTER TABLE healthmetrics RENAME COLUMN threshold_key TO personalisation_key")
    _exec("ALTER TABLE healthmetrictemplates RENAME COLUMN default_threshold_key TO default_personalisation_key")
    _exec("ALTER TABLE budgetmetricthresholds RENAME COLUMN threshold_key TO personalisation_key")
    _exec("ALTER TABLE healththresholddefinitions RENAME COLUMN threshold_key TO personalisation_key")

    # Reverse table renames
    _exec("ALTER TABLE budgetmetricthresholds RENAME TO budgetmetricpersonalisations")
    _exec("ALTER TABLE healththresholddefinitions RENAME TO healthpersonalisationdefinitions")
