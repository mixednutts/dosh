"""add_utc_timezone_to_existing_datetimes

Revision ID: d3091a75b8ff
Revises: c2090c6518ff
Create Date: 2026-04-11 08:15:00.000000

"""
import logging
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision: str = 'd3091a75b8ff'
down_revision: Union[str, Sequence[str], None] = 'c2090c6518ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table_name):
    """Check if a table exists in the database."""
    result = conn.execute(text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
    ), {"name": table_name})
    return result.fetchone() is not None


def upgrade() -> None:
    """
    Add explicit UTC timezone (+00:00) to all naive datetime values.
    
    This migration converts existing naive datetime strings to timezone-aware
    format by appending '+00:00', indicating they are UTC times.
    """
    conn = op.get_bind()
    
    # Update financialperiods datetime columns
    if _table_exists(conn, 'financialperiods'):
        for column in ['startdate', 'enddate', 'closed_at']:
            conn.execute(text(f"""
                UPDATE financialperiods
                SET {column} = {column} || '+00:00'
                WHERE {column} IS NOT NULL
                  AND {column} NOT LIKE '%Z'
                  AND {column} NOT LIKE '%+00:00'
                  AND {column} NOT LIKE '%-__:__'
                  AND {column} NOT LIKE '%+__:__'
            """))
        logger.info("Updated financialperiods datetime columns")
    
    # Update periodtransactions entrydate
    if _table_exists(conn, 'periodtransactions'):
        conn.execute(text("""
            UPDATE periodtransactions
            SET entrydate = entrydate || '+00:00'
            WHERE entrydate IS NOT NULL
              AND entrydate NOT LIKE '%Z'
              AND entrydate NOT LIKE '%+00:00'
              AND entrydate NOT LIKE '%-__:__'
              AND entrydate NOT LIKE '%+__:__'
        """))
        logger.info("Updated periodtransactions entrydate column")
    
    # Note: periodcloseouts already has +00:00 from earlier migration attempt
    # setuprevisionevents table doesn't exist in older backups


def downgrade() -> None:
    """
    Remove UTC timezone suffixes from datetime values.
    This is a lossy operation that converts back to naive datetimes.
    """
    conn = op.get_bind()
    
    if _table_exists(conn, 'financialperiods'):
        for column in ['startdate', 'enddate', 'closed_at']:
            conn.execute(text(f"""
                UPDATE financialperiods
                SET {column} = REPLACE({column}, '+00:00', '')
                WHERE {column} LIKE '%+00:00'
            """))
    
    if _table_exists(conn, 'periodtransactions'):
        conn.execute(text("""
            UPDATE periodtransactions
            SET entrydate = REPLACE(entrydate, '+00:00', '')
            WHERE entrydate LIKE '%+00:00'
        """))
