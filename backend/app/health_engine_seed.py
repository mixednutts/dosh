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
    BudgetMetricThreshold,
    HealthDataSource,
    HealthDataSourceParameter,
    HealthMetric,
    HealthMetricTemplate,
    HealthMatrixTemplate,
    HealthMatrixTemplateItem,
    HealthThresholdDefinition,
    HealthScale,
    HealthScaleOption,
)


def seed_catalogs(db: Session) -> None:
    """Seed HealthDataSource, HealthScale, and HealthThresholdDefinition catalogs."""

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

    # --- HealthThresholdDefinition ---
    thresholds = [
        HealthThresholdDefinition(
            threshold_key="acceptable_expense_overrun_pct",
            name="Acceptable Expense Overrun",
            description="Percentage of expense overrun considered acceptable before health impact.",
            scale_key="percentage_0_100",
            default_value_json=json.dumps(10),
        ),
        HealthThresholdDefinition(
            threshold_key="comfortable_surplus_buffer_pct",
            name="Comfortable Surplus Buffer",
            description="Minimum surplus percentage that feels comfortable.",
            scale_key="percentage_0_100",
            default_value_json=json.dumps(5),
        ),
        HealthThresholdDefinition(
            threshold_key="maximum_deficit_amount",
            name="Maximum Deficit Amount",
            description="Largest deficit amount tolerated before major health impact.",
            scale_key="dollar_amount",
            default_value_json=json.dumps(None),
        ),
        HealthThresholdDefinition(
            threshold_key="revision_sensitivity",
            name="Revision Sensitivity",
            description="How strongly budget revisions should affect stability scoring.",
            scale_key="ten_scale_1_10",
            default_value_json=json.dumps(5),
        ),
        HealthThresholdDefinition(
            threshold_key="savings_priority",
            name="Savings Priority",
            description="Importance placed on savings contributions in overall health.",
            scale_key="ten_scale_1_10",
            default_value_json=json.dumps(5),
        ),
        HealthThresholdDefinition(
            threshold_key="period_criticality_bias",
            name="Period Criticality Bias",
            description="How much timing within the period amplifies health concerns.",
            scale_key="ten_scale_1_10",
            default_value_json=json.dumps(5),
        ),
    ]

    for threshold in thresholds:
        existing = db.query(HealthThresholdDefinition).filter_by(
            threshold_key=threshold.threshold_key
        ).first()
        if not existing:
            db.add(threshold)

    db.flush()


def create_standard_templates(db: Session) -> HealthMatrixTemplate:
    """Create the 'Standard Budget Health' metric and matrix templates."""

    # Metric templates for the 4 existing health components
    metric_templates = [
        HealthMetricTemplate(
            template_key="setup_health",
            name="Setup Health",
            description="Evaluates income sources, active expenses, and future period coverage.",
            scope="OVERALL",
            formula_expression="income_source_count + active_expense_count + future_period_count",
            formula_data_sources_json=json.dumps(["income_source_count", "active_expense_count", "future_period_count"]),
            default_threshold_key=None,
            scoring_logic_json=json.dumps({"type": "setup_health_v1"}),
            evidence_template_json=json.dumps({
                "supportive": "Your budget setup looks solid with the current income, expenses, and period coverage.",
                "factual": "Income sources, active expenses, and future period counts are within expected ranges.",
                "friendly": "Looks like your budget is set up nicely — income, expenses, and periods are all in order!",
            }),
            drill_down_enabled=False,
            is_system=True,
        ),
        HealthMetricTemplate(
            template_key="budget_discipline",
            name="Budget Discipline",
            description="Measures historical outflow overrun across closed periods.",
            scope="OVERALL",
            formula_expression="historical_overrun_ratio",
            formula_data_sources_json=json.dumps(["historical_overrun_ratio"]),
            default_threshold_key="acceptable_expense_overrun_pct",
            scoring_logic_json=json.dumps({"type": "budget_discipline_v1"}),
            evidence_template_json=json.dumps({
                "supportive": "Your historical spending discipline is tracking well.",
                "factual": "Historical expense overrun is within acceptable thresholds.",
                "friendly": "You're keeping your spending in check — nice work!",
            }),
            drill_down_enabled=True,
            is_system=True,
        ),
        HealthMetricTemplate(
            template_key="planning_stability",
            name="Planning Stability",
            description="Tracks off-plan activity in current periods.",
            scope="BOTH",
            formula_expression="revised_line_count",
            formula_data_sources_json=json.dumps(["revised_line_count"]),
            default_threshold_key="revision_sensitivity",
            scoring_logic_json=json.dumps({"type": "planning_stability_v1"}),
            evidence_template_json=json.dumps({
                "supportive": "Your plan has remained stable with minimal revisions.",
                "factual": "Number of revised lines is within tolerance.",
                "friendly": "Not many changes this cycle — your plan is holding steady!",
            }),
            drill_down_enabled=True,
            is_system=True,
        ),
        HealthMetricTemplate(
            template_key="current_period_check",
            name="Current Period Check",
            description="Live-period deficit, tolerance, revision pressure, and timing factor.",
            scope="CURRENT_PERIOD",
            formula_expression="live_period_surplus + total_budgeted_income * 0",
            formula_data_sources_json=json.dumps(["live_period_surplus", "total_budgeted_income"]),
            default_threshold_key="maximum_deficit_amount",
            scoring_logic_json=json.dumps({"type": "current_period_check_v1"}),
            evidence_template_json=json.dumps({
                "supportive": "This period is tracking along well with the current plan.",
                "factual": "Current period surplus and timing factors are within tolerance.",
                "friendly": "Things are looking good this cycle — no red flags!",
            }),
            drill_down_enabled=True,
            is_system=True,
        ),
    ]

    for mt in metric_templates:
        existing = db.query(HealthMetricTemplate).filter_by(template_key=mt.template_key).first()
        if not existing:
            db.add(mt)

    db.flush()

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

    # Matrix template items with current fixed weights from budget_health.py logic
    # setup_health and budget_discipline = 25% each, planning_stability = 20%, current_period = 30%
    items = [
        ("setup_health", Decimal("0.2500")),
        ("budget_discipline", Decimal("0.2500")),
        ("planning_stability", Decimal("0.2000")),
        ("current_period_check", Decimal("0.3000")),
    ]

    for idx, (mt_key, weight) in enumerate(items):
        existing = db.query(HealthMatrixTemplateItem).filter_by(
            template_key=matrix_template.template_key, metric_template_key=mt_key
        ).first()
        if not existing:
            db.add(HealthMatrixTemplateItem(
                template_key=matrix_template.template_key,
                metric_template_key=mt_key,
                weight=weight,
                display_order=idx,
            ))

    db.flush()
    return matrix_template


def migrate_existing_budgets(db: Session) -> None:
    """Create BudgetHealthMatrix, HealthMetric instances, and thresholds for every existing budget."""

    matrix_template = db.query(HealthMatrixTemplate).filter_by(template_key="standard_budget_health").first()
    if not matrix_template:
        raise RuntimeError("Standard Budget Health matrix template must be seeded before migrating budgets.")

    metric_templates = {mt.template_key: mt for mt in db.query(HealthMetricTemplate).all()}
    threshold_definitions = {td.threshold_key: td for td in db.query(HealthThresholdDefinition).all()}

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
                threshold_key=mt.default_threshold_key,
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
            ))

            # Migrate budget-level threshold columns into BudgetMetricThreshold rows
            _migrate_budget_thresholds(db, budget, metric, threshold_definitions)

    db.flush()


def _migrate_budget_thresholds(
    db: Session,
    budget: Budget,
    metric: HealthMetric,
    threshold_definitions: dict,
) -> None:
    """Map legacy Budget slider columns to per-metric threshold rows.

    Note: Each metric can only have ONE threshold value (composite PK on budgetid+metric_id).
    For current_period_check, we only migrate maximum_deficit_amount as the primary threshold.
    """

    mapping: dict[str, dict[str, Any]] = {
        "setup_health": {},
        "budget_discipline": {
            "acceptable_expense_overrun_pct": budget.acceptable_expense_overrun_pct,
        },
        "planning_stability": {
            "revision_sensitivity": budget.revision_sensitivity,
        },
        "current_period_check": {
            "maximum_deficit_amount": budget.maximum_deficit_amount,
            # Note: period_criticality_bias is intentionally excluded - each metric can only have
            # one threshold value due to composite PK on (budgetid, metric_id)
        },
    }

    template_key = metric.template_key or ""
    # Only take the first threshold for this metric (schema only allows one per metric)
    metric_mapping = mapping.get(template_key, {})
    for threshold_key, value in metric_mapping.items():
        if value is None:
            continue
        threshold_def = threshold_definitions.get(threshold_key)
        if not threshold_def:
            continue
        existing = db.query(BudgetMetricThreshold).filter_by(
            budgetid=budget.budgetid, metric_id=metric.metric_id
        ).first()
        if not existing:
            db.add(BudgetMetricThreshold(
                budgetid=budget.budgetid,
                metric_id=metric.metric_id,
                threshold_key=threshold_key,
                value_json=json.dumps(str(value) if isinstance(value, Decimal) else value),
            ))
        # Only insert the first threshold for this metric
        break


def create_default_matrix_for_budget(db: Session, budget: Budget) -> BudgetHealthMatrix:
    """Create a default BudgetHealthMatrix for a newly created budget."""
    matrix_template = db.query(HealthMatrixTemplate).filter_by(template_key="standard_budget_health").first()
    if not matrix_template:
        raise RuntimeError("Standard Budget Health matrix template must be seeded before creating budgets.")

    metric_templates = {mt.template_key: mt for mt in db.query(HealthMetricTemplate).all()}
    threshold_definitions = {td.threshold_key: td for td in db.query(HealthThresholdDefinition).all()}

    matrix = BudgetHealthMatrix(
        budgetid=budget.budgetid,
        name="Standard Budget Health",
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
            threshold_key=mt.default_threshold_key,
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
        ))

        _migrate_budget_thresholds(db, budget, metric, threshold_definitions)

    db.flush()
    return matrix


def _update_existing_metric_templates(db: Session) -> None:
    """Keep existing metric templates in sync with seed changes."""
    mt = db.query(HealthMetricTemplate).filter_by(template_key="current_period_check").first()
    if mt:
        mt.formula_expression = "live_period_surplus + total_budgeted_income * 0"
        mt.formula_data_sources_json = json.dumps(["live_period_surplus", "total_budgeted_income"])

    db.flush()


def _update_existing_metrics(db: Session) -> None:
    """Push template-level formula changes to existing budget metric instances."""
    for metric in db.query(HealthMetric).filter_by(template_key="current_period_check").all():
        metric.formula_expression = "live_period_surplus + total_budgeted_income * 0"
        metric.formula_data_sources_json = json.dumps(["live_period_surplus", "total_budgeted_income"])

    db.flush()


def seed_and_migrate(db: Session) -> None:
    """Run the full Phase A seed and migration in one transaction."""
    seed_catalogs(db)
    create_standard_templates(db)
    _update_existing_metric_templates(db)
    migrate_existing_budgets(db)
    _update_existing_metrics(db)
