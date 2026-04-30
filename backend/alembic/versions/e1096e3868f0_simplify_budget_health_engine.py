"""simplify_budget_health_engine

Revision ID: e1096e3868f0
Revises: 9c0f8d72a04c
Create Date: 2026-04-15 20:18:52.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import json

# revision identifiers, used by Alembic.
revision: str = 'e1096e3868f0'
down_revision: Union[str, Sequence[str], None] = '9c0f8d72a04c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_simplified_health(db: Session) -> None:
    """Delete all legacy matrix items and metrics, then recreate the two simplified system metrics.

    This function uses inline table definitions instead of importing models,
    because the model classes may change in later revisions.
    """
    from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey
    from sqlalchemy.orm import declarative_base, relationship

    Base = declarative_base()

    class _HealthMetric(Base):
        __tablename__ = "healthmetrics"
        metric_id = Column(Integer, primary_key=True, autoincrement=True)
        budgetid = Column(Integer, ForeignKey("budgets.budgetid"), nullable=False)
        metric_key = Column(String, nullable=False)
        name = Column(String, nullable=False)
        description = Column(Text)
        scope = Column(String, nullable=False)
        created_at = Column(DateTime, default=sa.func.now())

    class _BudgetHealthMatrix(Base):
        __tablename__ = "budgethealthmatrices"
        matrix_id = Column(Integer, primary_key=True, autoincrement=True)
        budgetid = Column(Integer, ForeignKey("budgets.budgetid"), nullable=False)
        name = Column(String, nullable=False)
        is_active = Column(Boolean, default=True)
        created_at = Column(DateTime, default=sa.func.now())

    class _BudgetHealthMatrixItem(Base):
        __tablename__ = "budgethealthmatrixitems"
        matrix_id = Column(Integer, ForeignKey("budgethealthmatrices.matrix_id"), primary_key=True)
        metric_id = Column(Integer, ForeignKey("healthmetrics.metric_id"), primary_key=True)
        weight = Column(Numeric(5, 4), nullable=False)
        scoring_sensitivity = Column(Integer, nullable=False, default=50)
        display_order = Column(Integer, default=0)
        is_enabled = Column(Boolean, default=True)
        parameters_json = Column(Text, nullable=False, default="{}")

    budgets = db.execute(sa.text("SELECT budgetid FROM budgets")).fetchall()
    for (budgetid,) in budgets:
        matrices = db.execute(sa.text("SELECT matrix_id, is_active FROM budgethealthmatrices WHERE budgetid = :bid"), {"bid": budgetid}).fetchall()
        active_matrix_id = None
        for matrix_id, is_active in matrices:
            if is_active and active_matrix_id is None:
                active_matrix_id = matrix_id
            else:
                db.execute(sa.text("DELETE FROM budgethealthmatrixitems WHERE matrix_id = :mid"), {"mid": matrix_id})
                db.execute(sa.text("DELETE FROM budgethealthmatrices WHERE matrix_id = :mid"), {"mid": matrix_id})

        if active_matrix_id is None:
            result = db.execute(sa.text("INSERT INTO budgethealthmatrices (budgetid, name, is_active) VALUES (:bid, 'Budget Health', 1)"), {"bid": budgetid})
            active_matrix_id = result.lastrowid
        else:
            db.execute(sa.text("DELETE FROM budgethealthmatrixitems WHERE matrix_id = :mid"), {"mid": active_matrix_id})
            db.execute(sa.text("DELETE FROM healthmetrics WHERE budgetid = :bid"), {"bid": budgetid})

        setup_result = db.execute(
            sa.text("INSERT INTO healthmetrics (budgetid, metric_key, name, description, scope) VALUES (:bid, 'setup_health', 'Setup Health', 'Checks whether the budget has the minimum required setup lines.', 'CURRENT_PERIOD')"),
            {"bid": budgetid}
        )
        setup_metric_id = setup_result.lastrowid

        discipline_result = db.execute(
            sa.text("INSERT INTO healthmetrics (budgetid, metric_key, name, description, scope) VALUES (:bid, 'budget_discipline', 'Budget Discipline', 'Measures historical expense overrun against your tolerance.', 'OVERALL')"),
            {"bid": budgetid}
        )
        discipline_metric_id = discipline_result.lastrowid

        db.execute(
            sa.text("INSERT INTO budgethealthmatrixitems (matrix_id, metric_id, weight, scoring_sensitivity, display_order, is_enabled, parameters_json) VALUES (:mid, :moid, 0.30, 50, 0, 1, :params)"),
            {"mid": active_matrix_id, "moid": setup_metric_id, "params": json.dumps({"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1})}
        )
        db.execute(
            sa.text("INSERT INTO budgethealthmatrixitems (matrix_id, metric_id, weight, scoring_sensitivity, display_order, is_enabled, parameters_json) VALUES (:mid, :moid, 0.70, 50, 1, 1, :params)"),
            {"mid": active_matrix_id, "moid": discipline_metric_id, "params": json.dumps({"max_overrun_dollar": 0, "max_overrun_pct_of_expenses": 10})}
        )


def upgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)

    # Drop all legacy and current health engine tables (destructive)
    op.execute("DROP TABLE IF EXISTS budgethealthsummaries")
    op.execute("DROP TABLE IF EXISTS periodhealthresults")
    op.execute("DROP TABLE IF EXISTS budgethealthmatrixitems")
    op.execute("DROP TABLE IF EXISTS budgethealthmatrices")
    op.execute("DROP TABLE IF EXISTS healthmetrics")

    op.execute("DROP TABLE IF EXISTS budgetmetricthresholds")
    op.execute("DROP TABLE IF EXISTS healthmatrixtemplateitems")
    op.execute("DROP TABLE IF EXISTS healthdatasourceparameters")
    op.execute("DROP TABLE IF EXISTS healthscaleoptions")
    op.execute("DROP TABLE IF EXISTS healththresholddefinitions")
    op.execute("DROP TABLE IF EXISTS healthmetrictemplates")
    op.execute("DROP TABLE IF EXISTS healthmatrixtemplates")
    op.execute("DROP TABLE IF EXISTS healthdatasources")
    op.execute("DROP TABLE IF EXISTS healthscales")

    # Recreate simplified healthmetrics table
    op.create_table(
        'healthmetrics',
        sa.Column('metric_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('metric_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], name='healthmetrics_budgetid_fkey'),
        sa.PrimaryKeyConstraint('metric_id', name='pk_healthmetrics')
    )

    # Recreate simplified budgethealthmatrices table
    op.create_table(
        'budgethealthmatrices',
        sa.Column('matrix_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], name='budgethealthmatrices_budgetid_fkey'),
        sa.PrimaryKeyConstraint('matrix_id', name='pk_budgethealthmatrices')
    )

    # Recreate simplified budgethealthmatrixitems table
    op.create_table(
        'budgethealthmatrixitems',
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('weight', sa.Numeric(5, 4), nullable=False),
        sa.Column('scoring_sensitivity', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_enabled', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('parameters_json', sa.Text(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], name='budgethealthmatrixitems_matrix_id_fkey'),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id'], name='budgethealthmatrixitems_metric_id_fkey'),
        sa.PrimaryKeyConstraint('matrix_id', 'metric_id', name='pk_budgethealthmatrixitems')
    )

    # Recreate simplified periodhealthresults table
    op.create_table(
        'periodhealthresults',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('finperiodid', sa.Integer(), nullable=False),
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('evidence_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('is_snapshot', sa.Boolean(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['finperiodid'], ['financialperiods.finperiodid'], name='periodhealthresults_finperiodid_fkey'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], name='periodhealthresults_matrix_id_fkey'),
        sa.ForeignKeyConstraint(['metric_id'], ['healthmetrics.metric_id'], name='periodhealthresults_metric_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='pk_periodhealthresults')
    )

    # Recreate simplified budgethealthsummaries table
    op.create_table(
        'budgethealthsummaries',
        sa.Column('budgetid', sa.Integer(), nullable=False),
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('overall_score', sa.Integer(), nullable=False),
        sa.Column('overall_status', sa.String(), nullable=False),
        sa.Column('momentum_status', sa.String(), nullable=False),
        sa.Column('momentum_delta', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('metric_results_json', sa.Text(), nullable=False, server_default='[]'),
        sa.ForeignKeyConstraint(['budgetid'], ['budgets.budgetid'], name='budgethealthsummaries_budgetid_fkey'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], name='budgethealthsummaries_matrix_id_fkey'),
        sa.PrimaryKeyConstraint('budgetid', name='pk_budgethealthsummaries')
    )

    # Backfill simplified health data
    _backfill_simplified_health(db)
    db.commit()


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for this migration.")
