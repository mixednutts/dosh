from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import InvestmentItem

from .factories import (
    create_balance_type,
    create_budget,
    create_expense_item,
    create_income_type,
    create_investment_item,
    generate_periods,
    local_midnight_utc,
)


def _period_id_by_index(client, budgetid: int, index: int) -> int:
    resp = client.get(f"/api/budgets/{budgetid}/periods")
    assert resp.status_code == 200
    periods = sorted(resp.json(), key=lambda p: p["startdate"])
    return periods[index]["finperiodid"]


def test_projected_investment_is_cumulative_across_periods(client, db_session):
    """Upcoming periods should carry forward the previous period's closing projected investment."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("3000.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("1000.00"))
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Main Account",
        balance_type="Transaction",
        opening_balance=Decimal("5000.00"),
        is_primary=True,
    )
    investment = create_investment_item(
        db_session,
        budgetid=budget.budgetid,
        investmentdesc="Emergency Fund",
        initial_value=Decimal("5000.00"),
        planned_amount=Decimal("550.00"),
    )
    investment.linked_account_desc = "Main Account"
    investment.source_account_desc = "Main Account"
    db_session.commit()

    start = local_midnight_utc(datetime(2026, 5, 1), budget.timezone)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    # Post a transaction in the first period
    first_id = _period_id_by_index(client, budget.budgetid, 0)
    resp = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{first_id}/investments/Emergency%20Fund/transactions/",
        json={"amount": "200.00", "note": "Contribution"},
    )
    assert resp.status_code == 201, resp.text

    summaries_resp = client.get(f"/api/budgets/{budget.budgetid}/periods/summary")
    assert summaries_resp.status_code == 200, summaries_resp.text
    summaries = sorted(summaries_resp.json(), key=lambda s: s["period"]["startdate"])

    # Period 1: initial 5000 + committed 550 = 5550
    p1_projected = Decimal(summaries[0]["projected_investment"])
    assert p1_projected == Decimal("5550.00"), f"Expected 5550.00, got {p1_projected}"

    # Period 2: carry forward period 1 projected (5550) + committed 550 = 6100
    p2_projected = Decimal(summaries[1]["projected_investment"])
    assert p2_projected == Decimal("6100.00"), f"Expected 6100.00, got {p2_projected}"

    # Period 3: carry forward period 2 projected (6100) + committed 550 = 6650
    p3_projected = Decimal(summaries[2]["projected_investment"])
    assert p3_projected == Decimal("6650.00"), f"Expected 6650.00, got {p3_projected}"


def test_projected_investment_uses_committed_funds_logic(client, db_session):
    """Committed funds: max(budgeted, actual) unless PAID, then actual."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("3000.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("1000.00"))
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Main Account",
        balance_type="Transaction",
        opening_balance=Decimal("1000.00"),
        is_primary=True,
    )
    investment = create_investment_item(
        db_session,
        budgetid=budget.budgetid,
        investmentdesc="Fund",
        initial_value=Decimal("1000.00"),
        planned_amount=Decimal("300.00"),
    )
    investment.source_account_desc = "Main Account"
    db_session.commit()

    start = local_midnight_utc(datetime(2026, 5, 1), budget.timezone)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=1)
    period_id = periods[0]["finperiodid"]

    # Case 1: budget > actual -> use budget
    resp = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Fund/transactions/",
        json={"amount": "200.00", "note": "Under budget"},
    )
    assert resp.status_code == 201, resp.text
    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}").json()
    assert Decimal(detail["projected_investment"]) == Decimal("1300.00")  # 1000 + 300

    # Case 2: actual > budget -> use actual
    resp = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Fund/transactions/",
        json={"amount": "150.00", "note": "Over budget"},
    )
    assert resp.status_code == 201, resp.text
    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}").json()
    assert Decimal(detail["projected_investment"]) == Decimal("1350.00")  # 1000 + 350

    # Case 3: PAID -> use actual regardless
    resp = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investment/Fund/status",
        json={"status": "Paid"},
    )
    assert resp.status_code == 200, resp.text
    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}").json()
    assert Decimal(detail["projected_investment"]) == Decimal("1350.00")  # 1000 + 350 (actual)
