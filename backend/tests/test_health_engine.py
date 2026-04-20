from decimal import Decimal

from app.health_engine.metric_executors import get_executor
from app.health_engine.runner import evaluate_budget_health, evaluate_period_health, _compute_momentum


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
    from datetime import datetime, timezone, timedelta
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
    assert len(results) == 6
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
