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


def _table_exists(name: str) -> bool:
    """Check whether a table exists in the SQLite database."""
    result = op.get_bind().execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": name},
    ).scalar()
    return result is not None


def _column_exists(table: str, column: str) -> bool:
    """Check whether a column exists in a table."""
    result = op.get_bind().execute(
        sa.text(f"PRAGMA table_info({table})")
    ).fetchall()
    return any(row[1] == column for row in result)


def upgrade() -> None:
    # Rename tables only if old names still exist (idempotent for fresh installs)
    if _table_exists("healthpersonalisationdefinitions"):
        _exec("ALTER TABLE healthpersonalisationdefinitions RENAME TO healththresholddefinitions")
    if _table_exists("budgetmetricpersonalisations"):
        _exec("ALTER TABLE budgetmetricpersonalisations RENAME TO budgetmetricthresholds")

    # Rename columns in healththresholddefinitions
    if _column_exists("healththresholddefinitions", "personalisation_key"):
        _exec("ALTER TABLE healththresholddefinitions RENAME COLUMN personalisation_key TO threshold_key")

    # Rename columns in budgetmetricthresholds
    if _column_exists("budgetmetricthresholds", "personalisation_key"):
        _exec("ALTER TABLE budgetmetricthresholds RENAME COLUMN personalisation_key TO threshold_key")

    # Rename columns in healthmetrictemplates
    if _column_exists("healthmetrictemplates", "default_personalisation_key"):
        _exec("ALTER TABLE healthmetrictemplates RENAME COLUMN default_personalisation_key TO default_threshold_key")

    # Rename columns in healthmetrics
    if _column_exists("healthmetrics", "personalisation_key"):
        _exec("ALTER TABLE healthmetrics RENAME COLUMN personalisation_key TO threshold_key")


def downgrade() -> None:
    # Reverse column renames
    if _column_exists("healthmetrics", "threshold_key"):
        _exec("ALTER TABLE healthmetrics RENAME COLUMN threshold_key TO personalisation_key")
    if _column_exists("healthmetrictemplates", "default_threshold_key"):
        _exec("ALTER TABLE healthmetrictemplates RENAME COLUMN default_threshold_key TO default_personalisation_key")
    if _column_exists("budgetmetricthresholds", "threshold_key"):
        _exec("ALTER TABLE budgetmetricthresholds RENAME COLUMN threshold_key TO personalisation_key")
    if _column_exists("healththresholddefinitions", "threshold_key"):
        _exec("ALTER TABLE healththresholddefinitions RENAME COLUMN threshold_key TO personalisation_key")

    # Reverse table renames
    if _table_exists("budgetmetricthresholds"):
        _exec("ALTER TABLE budgetmetricthresholds RENAME TO budgetmetricpersonalisations")
    if _table_exists("healththresholddefinitions"):
        _exec("ALTER TABLE healththresholddefinitions RENAME TO healthpersonalisationdefinitions")
