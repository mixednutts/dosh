"""drop_budgethealthmatrices_budgetid_unique

Revision ID: a1b2c3d4e5f6
Revises: 009297f69b52
Create Date: 2026-04-15 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '009297f69b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_has_unique_on_budgetid(conn) -> bool:
    inspector = sa.inspect(conn)
    for idx in inspector.get_indexes('budgethealthmatrices'):
        if idx.get('unique') and 'budgetid' in idx.get('column_names', []):
            return True
    for cons in inspector.get_unique_constraints('budgethealthmatrices'):
        if 'budgetid' in cons.get('column_names', []):
            return True
    # Also check table creation SQL for UNIQUE on budgetid
    row = conn.execute(
        sa.text("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgethealthmatrices'")
    ).fetchone()
    if row and row[0]:
        sql = row[0].lower()
        return 'budgetid' in sql and 'unique' in sql
    return False


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_has_unique_on_budgetid(conn):
        return

    # SQLite: recreate table without the unique constraint on budgetid
    op.execute(sa.text("""
        CREATE TABLE budgethealthmatrices_new (
            matrix_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            budgetid INTEGER NOT NULL,
            name VARCHAR NOT NULL,
            based_on_template_key VARCHAR,
            cloned_from_matrix_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME,
            FOREIGN KEY(budgetid) REFERENCES budgets (budgetid),
            FOREIGN KEY(based_on_template_key) REFERENCES healthmatrixtemplates (template_key),
            FOREIGN KEY(cloned_from_matrix_id) REFERENCES budgethealthmatrices (matrix_id)
        )
    """))
    op.execute(sa.text("""
        INSERT INTO budgethealthmatrices_new
        SELECT matrix_id, budgetid, name, based_on_template_key, cloned_from_matrix_id, is_active, created_at
        FROM budgethealthmatrices
    """))
    op.execute(sa.text("DROP TABLE budgethealthmatrices"))
    op.execute(sa.text("ALTER TABLE budgethealthmatrices_new RENAME TO budgethealthmatrices"))

    # Recreate standard indexes
    op.execute(sa.text("CREATE INDEX ix_budgethealthmatrices_budgetid ON budgethealthmatrices (budgetid)"))


def downgrade() -> None:
    conn = op.get_bind()
    if _table_has_unique_on_budgetid(conn):
        return

    op.execute(sa.text("""
        CREATE TABLE budgethealthmatrices_new (
            matrix_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            budgetid INTEGER NOT NULL UNIQUE,
            name VARCHAR NOT NULL,
            based_on_template_key VARCHAR,
            cloned_from_matrix_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME,
            FOREIGN KEY(budgetid) REFERENCES budgets (budgetid),
            FOREIGN KEY(based_on_template_key) REFERENCES healthmatrixtemplates (template_key),
            FOREIGN KEY(cloned_from_matrix_id) REFERENCES budgethealthmatrices (matrix_id)
        )
    """))
    op.execute(sa.text("""
        INSERT INTO budgethealthmatrices_new
        SELECT matrix_id, budgetid, name, based_on_template_key, cloned_from_matrix_id, is_active, created_at
        FROM budgethealthmatrices
    """))
    op.execute(sa.text("DROP TABLE budgethealthmatrices"))
    op.execute(sa.text("ALTER TABLE budgethealthmatrices_new RENAME TO budgethealthmatrices"))

    # Recreate standard indexes
    op.execute(sa.text("CREATE INDEX ix_budgethealthmatrices_budgetid ON budgethealthmatrices (budgetid)"))
