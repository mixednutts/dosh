"""add_surplus_health_metric

Revision ID: b9d394cc1471
Revises: 8d512b6cf2c3
Create Date: 2026-05-04 07:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import json

from decimal import Decimal

# revision identifiers, used by Alembic.
revision: str = 'b9d394cc1471'
down_revision: Union[str, Sequence[str], None] = '8d512b6cf2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_surplus_health(db: Session) -> None:
    """Add surplus_health metric to all existing active health matrices."""
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    metric_key = "surplus_health"
    definition = {
        "name": "Surplus Outlook",
        "description": "Whether the current period is projected to finish with a positive surplus (income > outflows).",
        "default_parameters": {"upper_tolerance_amount": 100},
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
    _backfill_surplus_health(db)
    db.commit()


def downgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)

    from app.models import BudgetHealthMatrixItem
    (
        db.query(BudgetHealthMatrixItem)
        .filter_by(metric_key="surplus_health")
        .delete(synchronize_session=False)
    )
    db.commit()
