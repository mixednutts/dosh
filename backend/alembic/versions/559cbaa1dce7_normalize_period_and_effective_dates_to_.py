"""normalize_period_and_effective_dates_to_budget_timezone

Revision ID: 559cbaa1dce7
Revises: b10a29f14a8f
Create Date: 2026-04-13 11:20:20.198078

"""
from typing import Sequence, Union
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '559cbaa1dce7'
down_revision: Union[str, Sequence[str], None] = 'b10a29f14a8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _parse_datetime(value) -> datetime:
    """Parse a datetime value from the database."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        # SQLite stores datetimes as text; strip known UTC suffixes and parse
        clean = value.replace('+00:00', '').replace('Z', '')
        return datetime.fromisoformat(clean).replace(tzinfo=timezone.utc)
    raise ValueError(f"Unexpected datetime type: {type(value)}")


def _relocalize_to_budget_midnight(value, tz_name: str) -> datetime:
    """Reinterpret a stored UTC midnight as local midnight in the budget timezone."""
    dt_val = _parse_datetime(value)
    local = dt_val.replace(tzinfo=ZoneInfo(tz_name))
    return local.astimezone(timezone.utc)


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
    ), {"name": table_name})
    return result.fetchone() is not None


def upgrade() -> None:
    """
    Normalize period dates and effective dates to represent local midnight
    in each budget's configured timezone, stored as UTC.
    
    Existing values were stored as UTC midnight (e.g. 2026-04-13T00:00:00+00:00).
    For a budget in Australia/Sydney, this should become 2026-04-12T14:00:00+00:00
    to represent Sydney midnight on April 13.
    """
    conn = op.get_bind()
    
    # financialperiods
    if _table_exists(conn, 'financialperiods') and _table_exists(conn, 'budgets'):
        rows = conn.execute(text("""
            SELECT fp.finperiodid, fp.startdate, fp.enddate, b.timezone
            FROM financialperiods fp
            JOIN budgets b ON fp.budgetid = b.budgetid
        """)).fetchall()
        
        for finperiodid, startdate, enddate, tz_name in rows:
            new_start = _relocalize_to_budget_midnight(startdate, tz_name).isoformat()
            new_end = _relocalize_to_budget_midnight(enddate, tz_name).isoformat()
            conn.execute(text("""
                UPDATE financialperiods
                SET startdate = :startdate, enddate = :enddate
                WHERE finperiodid = :finperiodid
            """), {"startdate": new_start, "enddate": new_end, "finperiodid": finperiodid})
    
    # expenseitems effectivedate
    if _table_exists(conn, 'expenseitems') and _table_exists(conn, 'budgets'):
        rows = conn.execute(text("""
            SELECT ei.budgetid, ei.expensedesc, ei.effectivedate, b.timezone
            FROM expenseitems ei
            JOIN budgets b ON ei.budgetid = b.budgetid
            WHERE ei.effectivedate IS NOT NULL
        """)).fetchall()
        
        for budgetid, expensedesc, effectivedate, tz_name in rows:
            new_ed = _relocalize_to_budget_midnight(effectivedate, tz_name).isoformat()
            conn.execute(text("""
                UPDATE expenseitems
                SET effectivedate = :effectivedate
                WHERE budgetid = :budgetid AND expensedesc = :expensedesc
            """), {"effectivedate": new_ed, "budgetid": budgetid, "expensedesc": expensedesc})
    
    # investmentitems effectivedate
    if _table_exists(conn, 'investmentitems') and _table_exists(conn, 'budgets'):
        rows = conn.execute(text("""
            SELECT ii.budgetid, ii.investmentdesc, ii.effectivedate, b.timezone
            FROM investmentitems ii
            JOIN budgets b ON ii.budgetid = b.budgetid
            WHERE ii.effectivedate IS NOT NULL
        """)).fetchall()
        
        for budgetid, investmentdesc, effectivedate, tz_name in rows:
            new_ed = _relocalize_to_budget_midnight(effectivedate, tz_name).isoformat()
            conn.execute(text("""
                UPDATE investmentitems
                SET effectivedate = :effectivedate
                WHERE budgetid = :budgetid AND investmentdesc = :investmentdesc
            """), {"effectivedate": new_ed, "budgetid": budgetid, "investmentdesc": investmentdesc})


def downgrade() -> None:
    """
    Revert dates back to UTC midnight by stripping the timezone offset.
    This is lossy but restores the previous naive-UTC representation.
    """
    conn = op.get_bind()
    
    for table, columns, where in [
        ('financialperiods', ['startdate', 'enddate'], None),
        ('expenseitems', ['effectivedate'], 'effectivedate IS NOT NULL'),
        ('investmentitems', ['effectivedate'], 'effectivedate IS NOT NULL'),
    ]:
        if not _table_exists(conn, table):
            continue
        for column in columns:
            sql = f"""
                UPDATE {table}
                SET {column} = substr({column}, 1, instr({column}, '+') - 1)
                WHERE {column} LIKE '%+00:00'
            """
            if where:
                sql = f"""
                    UPDATE {table}
                    SET {column} = substr({column}, 1, instr({column}, '+') - 1)
                    WHERE {column} LIKE '%+00:00' AND {where}
                """
            conn.execute(text(sql))
