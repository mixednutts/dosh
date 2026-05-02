from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.health_engine.metric_executors import get_executor
from app.health_engine.runner import (
    evaluate_budget_health,
    evaluate_period_health,
    _compute_momentum,
    _health_status,
    _current_period_summary,
    _closed_period_summary,
    persist_period_health_snapshot,
)


def test_get_executor_returns_setup_health_executor(client, db_session) -> None:
    from tests.factories import create_budget
    budget = create_budget(db_session)
    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert "score" in result
    assert "status" in result
    assert "summary" in result
    assert "evidence" in result


def test_setup_health_executor_perfect_score(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import IncomeType, ExpenseItem, InvestmentItem

    budget = create_budget(db_session)
    db_session.add(IncomeType(budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("1000")))
    db_session.add(ExpenseItem(budgetid=budget.budgetid, expensedesc="Rent", active=True))
    db_session.add(InvestmentItem(budgetid=budget.budgetid, investmentdesc="Shares", active=True))
    db_session.commit()

    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_setup_health_executor_penalises_missing_items(client, db_session) -> None:
    from tests.factories import create_budget

    budget = create_budget(db_session)
    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=100,
        tone="factual",
    )
    assert result["score"] < 100
    assert result["status"] == "Needs Attention"


def test_budget_vs_actual_amount_executor_no_overrun(client, db_session) -> None:
    from tests.factories import create_budget

    budget = create_budget(db_session)
    executor = get_executor("budget_vs_actual_amount")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_budget_vs_actual_amount_executor_penalises_overrun(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodExpense, ExpenseItem

    budget = create_budget(db_session)
    db_session.add(ExpenseItem(budgetid=budget.budgetid, expensedesc="Rent", active=True, expenseamount=Decimal("500")))
    db_session.commit()

    now = datetime.now(timezone.utc)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now + timedelta(days=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.flush()
    db_session.add(PeriodExpense(finperiodid=period.finperiodid, budgetid=budget.budgetid, expensedesc="Rent", budgetamount=Decimal("500"), actualamount=Decimal("700")))
    db_session.commit()

    executor = get_executor("budget_vs_actual_amount")
    result = executor(
        db=db_session,
        budget=budget,
        period=period,
        parameters={"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] < 100
    assert result["status"] in ("Watch", "Needs Attention")


def test_revisions_on_paid_expenses_counts_only_expense_revisions_after_start(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodTransaction
    from app.transaction_ledger import ENTRY_KIND_STATUS_CHANGE

    budget = create_budget(db_session)
    now = datetime.now(timezone.utc)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=10),
        enddate=now + timedelta(days=20),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    # Pre-cycle expense revision — should NOT count (before start)
    db_session.add(PeriodTransaction(
        finperiodid=period.finperiodid,
        budgetid=budget.budgetid,
        source="expense",
        type="STATUS",
        amount=Decimal("0.00"),
        entrydate=now - timedelta(days=15),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        system_reason="Line marked Revised",
    ))

    # Post-cycle expense revision — SHOULD count
    db_session.add(PeriodTransaction(
        finperiodid=period.finperiodid,
        budgetid=budget.budgetid,
        source="expense",
        type="STATUS",
        amount=Decimal("0.00"),
        entrydate=now - timedelta(days=5),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        system_reason="Line marked Revised",
    ))

    # Post-cycle expense marked Paid — should NOT count (not a revision)
    db_session.add(PeriodTransaction(
        finperiodid=period.finperiodid,
        budgetid=budget.budgetid,
        source="expense",
        type="STATUS",
        amount=Decimal("0.00"),
        entrydate=now - timedelta(days=5),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        system_reason="Line marked Paid",
    ))

    # Post-cycle income revision — should NOT count (wrong source)
    db_session.add(PeriodTransaction(
        finperiodid=period.finperiodid,
        budgetid=budget.budgetid,
        source="income",
        type="STATUS",
        amount=Decimal("0.00"),
        entrydate=now - timedelta(days=5),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        system_reason="Line marked Revised",
    ))

    # Post-cycle investment revision — should NOT count (wrong source)
    db_session.add(PeriodTransaction(
        finperiodid=period.finperiodid,
        budgetid=budget.budgetid,
        source="investment",
        type="STATUS",
        amount=Decimal("0.00"),
        entrydate=now - timedelta(days=5),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        system_reason="Line marked Revised",
    ))

    db_session.commit()

    executor = get_executor("revisions_on_paid_expenses")
    result = executor(
        db=db_session,
        budget=budget,
        period=period,
        parameters={"upper_tolerance_instances": 2},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 85  # 1 revision within tolerance of 2 → 100 - 15 = 85
    assert result["status"] == "Strong"
    evidence = result["evidence"]
    assert any(ev["raw_value"] == 1 for ev in evidence)


def test_evaluate_budget_health_returns_structure(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    payload = evaluate_budget_health(db_session, budget.budgetid)
    assert payload is not None
    assert "overall_score" in payload
    assert "overall_status" in payload
    assert "pillars" in payload
    assert "momentum_status" in payload
    assert "current_period_check" in payload
    assert payload["version"] == "engine-v1"

    for pillar in payload["pillars"]:
        assert "key" in pillar
        assert "weight" in pillar
        assert "weighted_contribution" in pillar
        for ev in pillar["evidence"]:
            assert "label" in ev
            assert "value" in ev

    cpc = payload["current_period_check"]
    assert cpc is not None
    assert "metrics" in cpc
    for m in cpc["metrics"]:
        assert "key" in m
        assert "weight" in m
        assert "weighted_contribution" in m
        for ev in m["evidence"]:
            assert "label" in ev
            assert "value" in ev


def test_evaluate_period_health_returns_metrics(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    results = evaluate_period_health(db_session, budget, None, matrix)
    assert len(results) == 7
    for r in results:
        assert "score" in r
        assert "status" in r
        assert "summary" in r
        assert "evidence" in r
        for ev in r["evidence"]:
            assert "label" in ev
            assert "value" in ev


def test_compute_momentum_stable_with_no_history(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


# ---------------------------------------------------------------------------
# Additional tests for runner.py uncovered paths
# ---------------------------------------------------------------------------


def test_evaluate_budget_health_returns_none_for_missing_budget(client, db_session) -> None:
    result = evaluate_budget_health(db_session, 99999)
    assert result is None


def test_evaluate_budget_health_returns_none_for_empty_matrix(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    # Deactivate the default matrix created by create_budget
    db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).update({"is_active": False})
    db_session.commit()

    # Create a new empty matrix (no items)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, is_active=True, name="Test Matrix")
    db_session.add(matrix)
    db_session.commit()

    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is None


def test_health_status_boundaries() -> None:
    assert _health_status(100) == "Strong"
    assert _health_status(80) == "Strong"
    assert _health_status(79) == "Watch"
    assert _health_status(55) == "Watch"
    assert _health_status(54) == "Needs Attention"
    assert _health_status(0) == "Needs Attention"


def test_current_period_summary_all_tones_and_bands() -> None:
    for tone in ("supportive", "friendly", "factual"):
        for score in (0, 25, 50, 75, 100):
            summary = _current_period_summary(score, tone)
            assert isinstance(summary, str)
            assert len(summary) > 0


def test_current_period_summary_fallback() -> None:
    # Score outside defined bands should fall back to highest band
    summary = _current_period_summary(1000, "supportive")
    assert "tracking well" in summary.lower() or "good work" in summary.lower()


def test_closed_period_summary_all_tones_and_bands() -> None:
    for tone in ("supportive", "friendly", "factual"):
        for score in (0, 25, 50, 75, 100):
            summary = _closed_period_summary(score, tone)
            assert isinstance(summary, str)
            assert len(summary) > 0


def test_closed_period_summary_fallback() -> None:
    summary = _closed_period_summary(1000, "supportive")
    assert "solid result" in summary.lower() or "tracked well" in summary.lower()


def test_compute_momentum_with_insufficient_closed_periods(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    # Add only one locked period
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=60),
        enddate=datetime.now(timezone.utc) - timedelta(days=30),
        islocked=True,
    )
    db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


def test_compute_momentum_with_locked_periods_but_no_snapshots(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    # Add two locked periods but no health snapshots
    for i in range(2):
        period = FinancialPeriod(
            budgetid=budget.budgetid,
            startdate=datetime.now(timezone.utc) - timedelta(days=90 - i * 30),
            enddate=datetime.now(timezone.utc) - timedelta(days=60 - i * 30),
            islocked=True,
        )
        db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


def test_persist_period_health_snapshot_creates_rows(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod, PeriodHealthResult

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=30),
        enddate=datetime.now(timezone.utc) + timedelta(days=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    persist_period_health_snapshot(db_session, budget, period, matrix)
    db_session.commit()

    snapshots = db_session.query(PeriodHealthResult).filter_by(finperiodid=period.finperiodid).all()
    assert len(snapshots) == 7  # default matrix has 7 metrics
    for snap in snapshots:
        assert snap.is_snapshot is True
        assert snap.score is not None
        assert snap.status is not None
        assert snap.summary is not None


def test_evaluate_period_health_skips_unknown_metric_key(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()

    # Add an item with an unknown metric key
    item = BudgetHealthMatrixItem(
        matrix_id=matrix.matrix_id,
        metric_key="nonexistent_metric",
        is_enabled=True,
        weight=10,
        display_order=99,
    )
    db_session.add(item)
    db_session.commit()

    results = evaluate_period_health(db_session, budget, None, matrix)
    # Should still return results for the 7 valid metrics, skipping the unknown one
    assert len(results) == 7


def test_evaluate_period_health_handles_invalid_parameters_json(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()

    # Corrupt one item's parameters
    item = db_session.query(BudgetHealthMatrixItem).filter_by(matrix_id=matrix.matrix_id).first()
    item.health_metric_parameters = "not valid json {{{"
    db_session.commit()

    results = evaluate_period_health(db_session, budget, None, matrix)
    # Should still return results, using empty dict for corrupted parameters
    assert len(results) == 7


def test_evaluate_budget_health_finds_current_period_on_last_day(client, db_session) -> None:
    """A period whose enddate has passed but is less than a full day ago must still be
    treated as current by the health engine, matching cycle_stage() behaviour.
    """
    from datetime import datetime, timezone, timedelta
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    now = datetime.now(timezone.utc)
    # enddate is 1 hour in the past: now > enddate, but now < enddate + 1 day
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now - timedelta(hours=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    payload = evaluate_budget_health(db_session, budget.budgetid)
    assert payload is not None
    cpc = payload["current_period_check"]
    assert cpc is not None

    for m in cpc["metrics"]:
        assert m["summary"] != "No current period to evaluate."


def test_period_trend_no_historical_periods_returns_strong(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod

    budget = create_budget(db_session)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    executor = get_executor("period_trend")
    result = executor(
        db=db_session,
        budget=budget,
        period=period,
        parameters={"lookback_periods": 3, "tolerance_points": 5},
        scoring_sensitivity=50,
        tone="factual",
        current_period_composite_score=75,
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"
    assert result["trend"] == "Stable"
    assert "No closed periods" in result["calculation"]


def test_period_trend_improving_when_current_exceeds_historical(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, name="Health", is_active=True)
    db_session.add(matrix)
    db_session.flush()

    # Create two closed periods with snapshots
    for i in range(2):
        p = FinancialPeriod(
            budgetid=budget.budgetid,
            startdate=datetime.now(timezone.utc) - timedelta(days=60 - i * 30),
            enddate=datetime.now(timezone.utc) - timedelta(days=30 - i * 30),
            cycle_status=CLOSED,
            islocked=True,
        )
        db_session.add(p)
        db_session.flush()
        # Snapshot a CURRENT_PERIOD metric with score 60
        db_session.add(PeriodHealthResult(
            finperiodid=p.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key="budget_vs_actual_amount",
            score=60,
            status="Watch",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))

    current_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(current_period)
    db_session.commit()

    executor = get_executor("period_trend")
    result = executor(
        db=db_session,
        budget=budget,
        period=current_period,
        parameters={"lookback_periods": 3, "tolerance_points": 5},
        scoring_sensitivity=50,
        tone="factual",
        current_period_composite_score=90,
    )
    assert result["score"] == 100
    assert result["trend"] == "Improving"
    assert result["delta"] == 30


def test_period_trend_declining_within_tolerance_returns_strong(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, name="Health", is_active=True)
    db_session.add(matrix)
    db_session.flush()

    p = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=60),
        enddate=datetime.now(timezone.utc) - timedelta(days=30),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(p)
    db_session.flush()
    db_session.add(PeriodHealthResult(
        finperiodid=p.finperiodid,
        matrix_id=matrix.matrix_id,
        metric_key="budget_vs_actual_amount",
        score=80,
        status="Strong",
        summary="Test",
        evidence_json="[]",
        is_snapshot=True,
    ))

    current_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(current_period)
    db_session.commit()

    executor = get_executor("period_trend")
    result = executor(
        db=db_session,
        budget=budget,
        period=current_period,
        parameters={"lookback_periods": 3, "tolerance_points": 5},
        scoring_sensitivity=50,
        tone="factual",
        current_period_composite_score=76,  # 4 points below historical → within tolerance
    )
    assert result["score"] == 100
    assert result["trend"] == "Stable"


def test_period_trend_declining_beyond_tolerance_penalises(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, name="Health", is_active=True)
    db_session.add(matrix)
    db_session.flush()

    p = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=60),
        enddate=datetime.now(timezone.utc) - timedelta(days=30),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(p)
    db_session.flush()
    db_session.add(PeriodHealthResult(
        finperiodid=p.finperiodid,
        matrix_id=matrix.matrix_id,
        metric_key="budget_vs_actual_amount",
        score=80,
        status="Strong",
        summary="Test",
        evidence_json="[]",
        is_snapshot=True,
    ))

    current_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(current_period)
    db_session.commit()

    executor = get_executor("period_trend")
    result = executor(
        db=db_session,
        budget=budget,
        period=current_period,
        parameters={"lookback_periods": 3, "tolerance_points": 5},
        scoring_sensitivity=50,
        tone="factual",
        current_period_composite_score=50,  # 30 points below historical
    )
    # excess = 30 - 5 = 25, factor = 1.0, score = 100 - (25 * 1.5) = 62.5
    assert result["score"] == 62
    assert result["trend"] == "Declining"
    assert result["delta"] == -30


def test_period_trend_uses_configured_lookback(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, name="Health", is_active=True)
    db_session.add(matrix)
    db_session.flush()

    # Create 3 closed periods with different scores (most recent = highest)
    for i, score in enumerate([50, 70, 90]):
        p = FinancialPeriod(
            budgetid=budget.budgetid,
            startdate=datetime.now(timezone.utc) - timedelta(days=120 - i * 30),
            enddate=datetime.now(timezone.utc) - timedelta(days=90 - i * 30),
            cycle_status=CLOSED,
            islocked=True,
        )
        db_session.add(p)
        db_session.flush()
        db_session.add(PeriodHealthResult(
            finperiodid=p.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key="budget_vs_actual_amount",
            score=score,
            status="Strong",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))

    current_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(current_period)
    db_session.commit()

    executor = get_executor("period_trend")

    # With lookback=1, only the most recent closed period (score 90) is used
    result_1 = executor(
        db=db_session, budget=budget, period=current_period,
        parameters={"lookback_periods": 1, "tolerance_points": 5},
        scoring_sensitivity=50, tone="factual", current_period_composite_score=80,
    )
    assert result_1["delta"] == -10  # 80 - 90

    # With lookback=3, all three periods are averaged (50+70+90)/3 = 70
    result_3 = executor(
        db=db_session, budget=budget, period=current_period,
        parameters={"lookback_periods": 3, "tolerance_points": 5},
        scoring_sensitivity=50, tone="factual", current_period_composite_score=80,
    )
    assert result_3["delta"] == 10  # 80 - 70


def test_period_trend_derives_momentum_in_evaluate_budget_health(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix, PeriodExpense
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()

    # Create a closed period with snapshots
    closed = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=60),
        enddate=datetime.now(timezone.utc) - timedelta(days=30),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(closed)
    db_session.flush()

    # Add CURRENT_PERIOD scoped snapshots with low scores so current period looks better
    for metric_key in ["budget_vs_actual_amount", "budget_vs_actual_lines"]:
        db_session.add(PeriodHealthResult(
            finperiodid=closed.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key=metric_key,
            score=50,
            status="Watch",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))

    # Create current period with no overruns (so CURRENT_PERIOD metrics score 100)
    current = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=15),
        enddate=datetime.now(timezone.utc) + timedelta(days=15),
        islocked=False,
    )
    db_session.add(current)
    db_session.flush()
    db_session.commit()

    payload = evaluate_budget_health(db_session, budget.budgetid)
    assert payload is not None
    assert payload["momentum_status"] == "Improving"
    assert payload["momentum_delta"] > 0
    assert "momentum_summary" in payload
    assert payload["overall_summary"] is not None
    assert payload["overall_summary"] != ""
