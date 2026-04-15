"""Seed and migration utilities for the Budget Health Engine.

This module seeds system catalogs and migrates existing budgets into the new
health engine structure. It is designed to be called from an Alembic migration.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    Budget,
    BudgetHealthMatrix,
    BudgetHealthMatrixItem,
    HealthDataSource,
    HealthDataSourceParameter,
    HealthMetric,
    HealthMetricTemplate,
    HealthMatrixTemplate,
    HealthMatrixTemplateItem,
    HealthScale,
    HealthScaleOption,
)


def seed_catalogs(db: Session) -> None:
    """Seed HealthDataSource and HealthScale catalogs."""

    # --- HealthDataSource ---
    sources = [
        HealthDataSource(
            source_key="total_budgeted_income",
            name="Total Budgeted Income",
            description="Sum of budgetamount from periodincome for a given period.",
            version=1,
            executor_path="app.health_engine_data_sources.total_budgeted_income",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="total_budgeted_expenses",
            name="Total Budgeted Expenses",
            description="Sum of budgetamount from periodexpenses for a given period.",
            version=1,
            executor_path="app.health_engine_data_sources.total_budgeted_expenses",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="total_actual_expenses",
            name="Total Actual Expenses",
            description="Sum of actualamount from periodexpenses for a given period.",
            version=1,
            executor_path="app.health_engine_data_sources.total_actual_expenses",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="income_source_count",
            name="Income Source Count",
            description="Number of distinct income sources configured for the budget.",
            version=1,
            executor_path="app.health_engine_data_sources.income_source_count",
            return_type="count",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="active_expense_count",
            name="Active Expense Count",
            description="Number of active expense items configured for the budget.",
            version=1,
            executor_path="app.health_engine_data_sources.active_expense_count",
            return_type="count",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="future_period_count",
            name="Future Period Count",
            description="Number of future periods currently generated for the budget.",
            version=1,
            executor_path="app.health_engine_data_sources.future_period_count",
            return_type="count",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="historical_overrun_ratio",
            name="Historical Overrun Ratio",
            description="Average actual vs budgeted expense ratio across closed historical periods.",
            version=1,
            executor_path="app.health_engine_data_sources.historical_overrun_ratio",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="revised_line_count",
            name="Revised Line Count",
            description="Number of revised expense or income lines in the current period.",
            version=1,
            executor_path="app.health_engine_data_sources.revised_line_count",
            return_type="count",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="live_period_surplus",
            name="Live Period Surplus",
            description="Current period budgeted income minus budgeted expenses.",
            version=1,
            executor_path="app.health_engine_data_sources.live_period_surplus",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
        HealthDataSource(
            source_key="period_progress_ratio",
            name="Period Progress Ratio",
            description="How far through the current period we are (0.0 to 1.0).",
            version=1,
            executor_path="app.health_engine_data_sources.period_progress_ratio",
            return_type="decimal",
            cache_ttl_seconds=0,
        ),
    ]

    for source in sources:
        existing = db.query(HealthDataSource).filter_by(source_key=source.source_key).first()
        if not existing:
            db.add(source)

    # --- HealthDataSourceParameter ---
    params = [
        HealthDataSourceParameter(source_key="total_budgeted_income", param_name="finperiodid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="total_budgeted_expenses", param_name="finperiodid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="total_actual_expenses", param_name="finperiodid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="income_source_count", param_name="budgetid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="active_expense_count", param_name="budgetid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="future_period_count", param_name="budgetid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="historical_overrun_ratio", param_name="budgetid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="revised_line_count", param_name="finperiodid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="live_period_surplus", param_name="finperiodid", param_type="integer", is_required=True),
        HealthDataSourceParameter(source_key="period_progress_ratio", param_name="finperiodid", param_type="integer", is_required=True),
    ]

    for param in params:
        existing = db.query(HealthDataSourceParameter).filter_by(
            source_key=param.source_key, param_name=param.param_name
        ).first()
        if not existing:
            db.add(param)

    # --- HealthScale ---
    scales = [
        HealthScale(scale_key="percentage_0_100", name="Percentage (0-100)", scale_type="integer_range", min_value=0, max_value=100, step_value=1, unit_label="%"),
        HealthScale(scale_key="ten_scale_1_10", name="1 to 10 Scale", scale_type="integer_range", min_value=1, max_value=10, step_value=1, unit_label=""),
        HealthScale(scale_key="dollar_amount", name="Dollar Amount", scale_type="money", min_value=0, max_value=None, step_value=Decimal("0.01"), unit_label="$"),
        HealthScale(scale_key="severity_low_med_high", name="Severity (Low/Med/High)", scale_type="enum", min_value=None, max_value=None, step_value=None, unit_label=""),
    ]

    for scale in scales:
        existing = db.query(HealthScale).filter_by(scale_key=scale.scale_key).first()
        if not existing:
            db.add(scale)
    db.flush()

    # --- HealthScaleOption ---
    options = [
        HealthScaleOption(scale_key="severity_low_med_high", option_value="low", option_label="Low", option_order=1),
        HealthScaleOption(scale_key="severity_low_med_high", option_value="medium", option_label="Medium", option_order=2),
        HealthScaleOption(scale_key="severity_low_med_high", option_value="high", option_label="High", option_order=3),
    ]

    for option in options:
        existing = db.query(HealthScaleOption).filter_by(
            scale_key=option.scale_key, option_value=option.option_value
        ).first()
        if not existing:
            db.add(option)

    db.flush()


def create_standard_templates(db: Session) -> HealthMatrixTemplate:
    """Create the 'Standard Budget Health' matrix template (empty shell)."""

    # Matrix template
    matrix_template = db.query(HealthMatrixTemplate).filter_by(template_key="standard_budget_health").first()
    if not matrix_template:
        matrix_template = HealthMatrixTemplate(
            template_key="standard_budget_health",
            name="Standard Budget Health",
            description="Default health matrix covering setup, discipline, stability, and current period.",
            is_system=True,
        )
        db.add(matrix_template)
        db.flush()

    # No default metric templates are seeded; metrics will be created via the UI.
    return matrix_template


def migrate_existing_budgets(db: Session) -> None:
    """Create BudgetHealthMatrix and HealthMetric instances for every existing budget."""

    matrix_template = db.query(HealthMatrixTemplate).filter_by(template_key="standard_budget_health").first()
    if not matrix_template:
        raise RuntimeError("Standard Budget Health matrix template must be seeded before migrating budgets.")

    metric_templates = {mt.template_key: mt for mt in db.query(HealthMetricTemplate).all()}

    budgets = db.query(Budget).all()
    for budget in budgets:
        # Skip if already migrated
        existing_matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).first()
        if existing_matrix:
            continue

        matrix = BudgetHealthMatrix(
            budgetid=budget.budgetid,
            name="Standard Budget Health",
            based_on_template_key=matrix_template.template_key,
            cloned_from_matrix_id=None,
            is_active=True,
        )
        db.add(matrix)
        db.flush()

        # Create metric instances from templates and matrix items
        template_items = db.query(HealthMatrixTemplateItem).filter_by(
            template_key=matrix_template.template_key
        ).order_by(HealthMatrixTemplateItem.display_order).all()

        for ti in template_items:
            mt = metric_templates.get(ti.metric_template_key)
            if not mt:
                continue

            metric = HealthMetric(
                template_key=mt.template_key,
                budgetid=budget.budgetid,
                name=mt.name,
                description=mt.description,
                scope=mt.scope,
                formula_expression=mt.formula_expression,
                formula_data_sources_json=mt.formula_data_sources_json,
                scale_key=mt.scale_key,
                default_value_json=mt.default_value_json,
                scoring_logic_json=mt.scoring_logic_json,
                evidence_template_json=mt.evidence_template_json,
                drill_down_enabled=mt.drill_down_enabled,
            )
            db.add(metric)
            db.flush()

            threshold_value_json = mt.default_value_json
            # Override with legacy budget slider columns where applicable
            if mt.template_key == "budget_discipline":
                threshold_value_json = json.dumps(budget.acceptable_expense_overrun_pct)
            elif mt.template_key == "planning_stability":
                threshold_value_json = json.dumps(budget.revision_sensitivity)
            elif mt.template_key == "current_period_check" and budget.maximum_deficit_amount is not None:
                threshold_value_json = json.dumps(str(budget.maximum_deficit_amount))

            db.add(BudgetHealthMatrixItem(
                matrix_id=matrix.matrix_id,
                metric_id=metric.metric_id,
                weight=ti.weight,
                scoring_sensitivity=50,
                display_order=ti.display_order,
                is_enabled=True,
                threshold_value_json=threshold_value_json,
            ))

    db.flush()


def create_matrix_from_template(
    db: Session,
    budget: Budget,
    template_key: str,
    deactivate_existing: bool = True,
) -> BudgetHealthMatrix:
    """Create a new BudgetHealthMatrix from a HealthMatrixTemplate."""
    matrix_template = db.query(HealthMatrixTemplate).filter_by(template_key=template_key).first()
    if not matrix_template:
        raise ValueError(f"Matrix template not found: {template_key}")

    if deactivate_existing:
        existing = db.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).all()
        for m in existing:
            m.is_active = False

    metric_templates = {mt.template_key: mt for mt in db.query(HealthMetricTemplate).all()}

    matrix = BudgetHealthMatrix(
        budgetid=budget.budgetid,
        name=matrix_template.name,
        based_on_template_key=matrix_template.template_key,
        cloned_from_matrix_id=None,
        is_active=True,
    )
    db.add(matrix)
    db.flush()

    template_items = db.query(HealthMatrixTemplateItem).filter_by(
        template_key=matrix_template.template_key
    ).order_by(HealthMatrixTemplateItem.display_order).all()

    for ti in template_items:
        mt = metric_templates.get(ti.metric_template_key)
        if not mt:
            continue

        metric = HealthMetric(
            template_key=mt.template_key,
            budgetid=budget.budgetid,
            name=mt.name,
            description=mt.description,
            scope=mt.scope,
            formula_expression=mt.formula_expression,
            formula_data_sources_json=mt.formula_data_sources_json,
            scale_key=mt.scale_key,
            default_value_json=mt.default_value_json,
            scoring_logic_json=mt.scoring_logic_json,
            evidence_template_json=mt.evidence_template_json,
            drill_down_enabled=mt.drill_down_enabled,
        )
        db.add(metric)
        db.flush()

        db.add(BudgetHealthMatrixItem(
            matrix_id=matrix.matrix_id,
            metric_id=metric.metric_id,
            weight=ti.weight,
            scoring_sensitivity=50,
            display_order=ti.display_order,
            is_enabled=True,
            threshold_value_json=mt.default_value_json,
        ))

    db.flush()
    return matrix


def create_default_matrix_for_budget(db: Session, budget: Budget) -> BudgetHealthMatrix:
    """Create a default BudgetHealthMatrix for a newly created budget."""
    return create_matrix_from_template(db, budget, "standard_budget_health")


def seed_and_migrate(db: Session) -> None:
    """Run the full Phase A seed and migration in one transaction."""
    seed_catalogs(db)
    create_standard_templates(db)
    migrate_existing_budgets(db)
