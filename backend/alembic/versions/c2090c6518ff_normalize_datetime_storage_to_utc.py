"""normalize_datetime_storage_to_utc

Revision ID: c2090c6518ff
Revises: b71415822583
Create Date: 2026-04-11 07:39:42.770435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'c2090c6518ff'
down_revision: Union[str, Sequence[str], None] = 'b71415822583'
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
    Normalize all datetime storage to explicit UTC format.
    
    SQLite stores datetimes as text. Existing records may be in naive format
    (e.g., '2026-04-10T20:52:00') which should be interpreted as UTC.
    This migration ensures all datetime values have explicit UTC timezone info.
    """
    conn = op.get_bind()
    
    # Tables and columns that store datetime values
    datetime_columns = [
        ('periodtransactions', 'entrydate'),
        ('periodcloseouts', 'created_at'),
        ('setuprevisionevents', 'created_at'),
        ('financialperiods', 'startdate'),
        ('financialperiods', 'enddate'),
        ('financialperiods', 'closed_at'),
    ]
    
    for table, column in datetime_columns:
        # Skip tables that don't exist (for backwards compatibility with older backups)
        if not _table_exists(conn, table):
            continue
            
        # Update records where the datetime doesn't have timezone info
        # Pattern: value doesn't end with Z or +/-HH:MM
        conn.execute(text(f"""
            UPDATE {table}
            SET {column} = {column} || '+00:00'
            WHERE {column} IS NOT NULL
              AND {column} NOT LIKE '%Z'
              AND {column} NOT LIKE '%+00:00'
              AND {column} NOT LIKE '%-__:__'
              AND {column} NOT LIKE '%+__:__'
        """))


def downgrade() -> None:
    """
    Remove UTC timezone suffixes to restore naive datetime format.
    This is a lossy operation - we can't perfectly restore the original state,
    but we can remove the +00:00 suffixes.
    """
    conn = op.get_bind()
    
    datetime_columns = [
        ('periodtransactions', 'entrydate'),
        ('periodcloseouts', 'created_at'),
        ('setuprevisionevents', 'created_at'),
        ('financialperiods', 'startdate'),
        ('financialperiods', 'enddate'),
        ('financialperiods', 'closed_at'),
    ]
    
    for table, column in datetime_columns:
        # Skip tables that don't exist
        if not _table_exists(conn, table):
            continue
            
        # Remove +00:00 suffix (but not Z, as that's also valid UTC)
        conn.execute(text(f"""
            UPDATE {table}
            SET {column} = REPLACE({column}, '+00:00', '')
            WHERE {column} LIKE '%+00:00'
        """))
