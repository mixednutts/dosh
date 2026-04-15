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
    """Delete all legacy matrix items and metrics, then recreate the two simplified system metrics."""
    from app.models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem, HealthMetric

    budgets = db.query(Budget).all()
    for budget in budgets:
        matrices = db.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).all()
        active_matrix = None
        for m in matrices:
            if m.is_active and active_matrix is None:
                active_matrix = m
            else:
                db.delete(m)
        if active_matrix is None:
            active_matrix = BudgetHealthMatrix(
                budgetid=budget.budgetid,
                name="Budget Health",
                is_active=True,
            )
            db.add(active_matrix)
            db.flush()
        else:
            items = db.query(BudgetHealthMatrixItem).filter_by(matrix_id=active_matrix.matrix_id).all()
            for item in items:
                metric = item.metric
                db.delete(item)
                if metric:
                    db.delete(metric)
            db.flush()

        setup_metric = HealthMetric(
            budgetid=budget.budgetid,
            metric_key="setup_health",
            name="Setup Health",
            description="Checks whether the budget has the minimum required setup lines.",
            scope="CURRENT_PERIOD",
        )
        discipline_metric = HealthMetric(
            budgetid=budget.budgetid,
            metric_key="budget_discipline",
            name="Budget Discipline",
            description="Measures historical expense overrun against your tolerance.",
            scope="OVERALL",
        )
        db.add(setup_metric)
        db.add(discipline_metric)
        db.flush()

        db.add(BudgetHealthMatrixItem(
            matrix_id=active_matrix.matrix_id,
            metric_id=setup_metric.metric_id,
            weight=sa.cast(0.30, sa.Numeric(5, 4)),
            scoring_sensitivity=50,
            display_order=0,
            is_enabled=True,
            parameters_json=json.dumps({"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1}),
        ))
        db.add(BudgetHealthMatrixItem(
            matrix_id=active_matrix.matrix_id,
            metric_id=discipline_metric.metric_id,
            weight=sa.cast(0.70, sa.Numeric(5, 4)),
            scoring_sensitivity=50,
            display_order=1,
            is_enabled=True,
            parameters_json=json.dumps({"max_overrun_dollar": 0, "max_overrun_pct_of_expenses": 10}),
        ))
        db.flush()


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
