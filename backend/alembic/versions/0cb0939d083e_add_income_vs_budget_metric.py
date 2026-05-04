"""add_income_vs_budget_metric

Revision ID: 0cb0939d083e
Revises: b9d394cc1471
Create Date: 2026-05-04 07:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import json

from decimal import Decimal

# revision identifiers, used by Alembic.
revision: str = '0cb0939d083e'
down_revision: Union[str, Sequence[str], None] = 'b9d394cc1471'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_income_vs_budget(db: Session) -> None:
    """Add income_vs_budget metric to all existing active health matrices."""
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    metric_key = "income_vs_budget"
    definition = {
        "name": "Income Achievement",
        "description": "Whether actual income received is meeting or exceeding the budgeted income target.",
        "default_parameters": {"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        "default_weight": Decimal("0.30"),
        "default_display_order": 2,
    }

    matrices = db.query(BudgetHealthMatrix).filter_by(is_active=True).all()
    for matrix in matrices:
        existing = db.query(BudgetHealthMatrixItem).filter_by(
            matrix_id=matrix.matrix_id, metric_key=metric_key
        ).first()
        if existing:
            continue

        db.add(BudgetHealthMatrixItem(
            matrix_id=matrix.matrix_id,
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
    _backfill_income_vs_budget(db)
    db.commit()


def downgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)

    from app.models import BudgetHealthMatrixItem
    (
        db.query(BudgetHealthMatrixItem)
        .filter_by(metric_key="income_vs_budget")
        .delete(synchronize_session=False)
    )
    db.commit()
