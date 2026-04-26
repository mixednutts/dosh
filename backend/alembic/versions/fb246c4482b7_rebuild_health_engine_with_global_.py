"""rebuild health engine with global metric keys

Revision ID: fb246c4482b7
Revises: e1096e3868f0
Create Date: 2026-04-16 09:35:44.857326

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import json

from decimal import Decimal

# revision identifiers, used by Alembic.
revision: str = 'fb246c4482b7'
down_revision: Union[str, Sequence[str], None] = 'e1096e3868f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_global_health(db: Session) -> None:
    """Delete all legacy matrix data, then recreate with global metric_key references."""
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem
    from app.health_engine.system_metrics import SYSTEM_METRICS

    # Use raw SQL to avoid ORM column mismatch with future model changes
    budget_rows = db.execute(sa.text("SELECT budgetid FROM budgets")).fetchall()
    for row in budget_rows:
        budgetid = row[0]
        matrices = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid).all()
        active_matrix = None
        for m in matrices:
            if m.is_active and active_matrix is None:
                active_matrix = m
            else:
                db.delete(m)
        if active_matrix is None:
            active_matrix = BudgetHealthMatrix(
                budgetid=budgetid,
                name="Budget Health",
                is_active=True,
            )
            db.add(active_matrix)
            db.flush()
        else:
            items = db.query(BudgetHealthMatrixItem).filter_by(matrix_id=active_matrix.matrix_id).all()
            for item in items:
                db.delete(item)
            db.flush()

        for metric_key, definition in SYSTEM_METRICS.items():
            db.add(BudgetHealthMatrixItem(
                matrix_id=active_matrix.matrix_id,
                metric_key=metric_key,
                weight=sa.cast(float(definition["default_weight"]), sa.Numeric(5, 4)),
                scoring_sensitivity=50,
                display_order=definition["default_display_order"],
                is_enabled=True,
                health_metric_parameters=json.dumps(definition["default_parameters"]),
            ))
        db.flush()


def upgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)

    # Drop all current health engine tables (destructive)
    op.execute("DROP TABLE IF EXISTS budgethealthsummaries")
    op.execute("DROP TABLE IF EXISTS periodhealthresults")
    op.execute("DROP TABLE IF EXISTS budgethealthmatrixitems")
    op.execute("DROP TABLE IF EXISTS budgethealthmatrices")
    op.execute("DROP TABLE IF EXISTS healthmetrics")

    # Recreate budgethealthmatrices table
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

    # Recreate budgethealthmatrixitems table with metric_key and health_metric_parameters
    op.create_table(
        'budgethealthmatrixitems',
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_key', sa.String(), nullable=False),
        sa.Column('weight', sa.Numeric(5, 4), nullable=False),
        sa.Column('scoring_sensitivity', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_enabled', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('health_metric_parameters', sa.Text(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], name='budgethealthmatrixitems_matrix_id_fkey'),
        sa.PrimaryKeyConstraint('matrix_id', 'metric_key', name='pk_budgethealthmatrixitems')
    )

    # Recreate periodhealthresults table with metric_key
    op.create_table(
        'periodhealthresults',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('finperiodid', sa.Integer(), nullable=False),
        sa.Column('matrix_id', sa.Integer(), nullable=False),
        sa.Column('metric_key', sa.String(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('evidence_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('is_snapshot', sa.Boolean(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['finperiodid'], ['financialperiods.finperiodid'], name='periodhealthresults_finperiodid_fkey'),
        sa.ForeignKeyConstraint(['matrix_id'], ['budgethealthmatrices.matrix_id'], name='periodhealthresults_matrix_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='pk_periodhealthresults')
    )

    # Recreate budgethealthsummaries table
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

    # Backfill global health data
    _backfill_global_health(db)
    db.commit()


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for this migration.")
