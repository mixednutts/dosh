"""add_period_trend_health_metric

Revision ID: 8d512b6cf2c3
Revises: d91762a97794
Create Date: 2026-05-02 14:24:13.021152

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import json

from decimal import Decimal

# revision identifiers, used by Alembic.
revision: str = '8d512b6cf2c3'
down_revision: Union[str, Sequence[str], None] = 'd91762a97794'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_period_trend(db: Session) -> None:
    """Add period_trend metric to all existing active health matrices."""
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    metric_key = "period_trend"
    definition = {
        "name": "Period Trend",
        "description": "Compares the current period's health score against recent historical periods to identify improvement or decline.",
        "default_parameters": {"lookback_periods": 3, "tolerance_points": 5},
        "default_weight": Decimal("0.30"),
        "default_display_order": 6,
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
    _backfill_period_trend(db)
    db.commit()


def downgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)

    from app.models import BudgetHealthMatrixItem
    (
        db.query(BudgetHealthMatrixItem)
        .filter_by(metric_key="period_trend")
        .delete(synchronize_session=False)
    )
    db.commit()
