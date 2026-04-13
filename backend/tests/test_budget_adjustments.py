from __future__ import annotations

from decimal import Decimal

from app.models import ExpenseItem, IncomeType, InvestmentItem, PeriodExpense, PeriodIncome, PeriodInvestment
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_income_budget_adjustment_updates_current_and_future_unlocked_periods_and_setup(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=3,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    planned_periods = sorted(
        [period for period in periods if period["cycle_status"] == "PLANNED"],
        key=lambda period: period["finperiodid"],
    )

    adjust_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary/budget",
        json={"budgetamount": "3100.00", "scope": "future", "note": "Annual pay review"},
    )
    assert adjust_response.status_code == 200, adjust_response.text

    db_session.expire_all()
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    assert Decimal(str(salary.amount)) == Decimal("3100.00")
    assert salary.revisionnum == 1

    current_row = db_session.get(PeriodIncome, (active_period["finperiodid"], "Salary"))
    assert current_row is not None
    assert Decimal(str(current_row.budgetamount)) == Decimal("3100.00")
    assert current_row.revision_snapshot == 1

    for planned_period in planned_periods:
        planned_row = db_session.get(PeriodIncome, (planned_period["finperiodid"], "Salary"))
        assert planned_row is not None
        assert Decimal(str(planned_row.budgetamount)) == Decimal("3100.00")
        assert planned_row.revision_snapshot == 1

    detail = client.get(f"/api/periods/{active_period['finperiodid']}")
    assert detail.status_code == 200, detail.text
    salary_detail = next(income for income in detail.json()["incomes"] if income["incomedesc"] == "Salary")
    assert Decimal(salary_detail["actualamount"]) == Decimal("0.00")

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("0.00")

    history = client.get(f"/api/periods/{active_period['finperiodid']}/income/Salary/transactions/")
    assert history.status_code == 200, history.text
    payload = history.json()
    assert len(payload) == 1
    assert payload[0]["type"] == "BUDGETADJ"
    assert payload[0]["entry_kind"] == "budget_adjustment"
    assert payload[0]["line_status"] is None
    assert payload[0]["budget_scope"] == "future"
    assert payload[0]["revisionnum"] == 1
    assert Decimal(payload[0]["budget_before_amount"]) == Decimal("2500.00")
    assert Decimal(payload[0]["budget_after_amount"]) == Decimal("3100.00")


def test_expense_budget_adjustment_stays_out_of_actuals_and_balance_movement(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    active_period = periods[0]

    adjust_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Rent increased this month"},
    )
    assert adjust_response.status_code == 200, adjust_response.text

    db_session.expire_all()
    expense_row = db_session.get(PeriodExpense, (active_period["finperiodid"], budget.budgetid, "Rent"))
    assert expense_row is not None
    assert Decimal(str(expense_row.budgetamount)) == Decimal("1300.00")

    detail = client.get(f"/api/periods/{active_period['finperiodid']}")
    assert detail.status_code == 200, detail.text
    rent_detail = next(expense for expense in detail.json()["expenses"] if expense["expensedesc"] == "Rent")
    assert Decimal(rent_detail["actualamount"]) == Decimal("0.00")

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("0.00")

    history = client.get(f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/")
    assert history.status_code == 200, history.text
    payload = history.json()
    assert len(payload) == 1
    assert payload[0]["type"] == "BUDGETADJ"
    assert payload[0]["entry_kind"] == "budget_adjustment"
    assert payload[0]["line_status"] == "Current"
    assert payload[0]["budget_scope"] == "current"
    assert payload[0]["revisionnum"] is None
    assert Decimal(payload[0]["budget_before_amount"]) == Decimal("1200.00")
    assert Decimal(payload[0]["budget_after_amount"]) == Decimal("1300.00")


def test_investment_budget_adjustment_updates_setup_and_future_unlocked_periods_without_moving_balances(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    investment_item = db_session.get(InvestmentItem, (budget.budgetid, "Emergency Fund"))
    investment_item.linked_account_desc = "Main Account"
    investment_item.source_account_desc = "Main Account"
    db_session.commit()

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=3,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    planned_periods = sorted(
        [period for period in periods if period["cycle_status"] == "PLANNED"],
        key=lambda period: period["finperiodid"],
    )

    adjust_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/budget",
        json={"budgetamount": "225.00", "scope": "future", "note": "Increase ongoing contribution"},
    )
    assert adjust_response.status_code == 200, adjust_response.text

    db_session.expire_all()
    investment_item = db_session.get(InvestmentItem, (budget.budgetid, "Emergency Fund"))
    assert Decimal(str(investment_item.planned_amount)) == Decimal("225.00")
    assert investment_item.revisionnum == 1

    current_row = db_session.get(PeriodInvestment, (active_period["finperiodid"], "Emergency Fund"))
    assert current_row is not None
    assert Decimal(str(current_row.budgeted_amount)) == Decimal("225.00")
    assert current_row.revision_snapshot == 1

    for planned_period in planned_periods:
        planned_row = db_session.get(PeriodInvestment, (planned_period["finperiodid"], "Emergency Fund"))
        assert planned_row is not None
        assert Decimal(str(planned_row.budgeted_amount)) == Decimal("225.00")
        assert planned_row.revision_snapshot == 1

    detail = client.get(f"/api/periods/{active_period['finperiodid']}")
    assert detail.status_code == 200, detail.text
    investment_detail = next(
        investment for investment in detail.json()["investments"] if investment["investmentdesc"] == "Emergency Fund"
    )
    assert Decimal(investment_detail["actualamount"]) == Decimal("0.00")

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("0.00")

    history = client.get(
        f"/api/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/"
    )
    assert history.status_code == 200, history.text
    payload = history.json()
    assert len(payload) == 1
    assert payload[0]["type"] == "BUDGETADJ"
    assert payload[0]["entry_kind"] == "budget_adjustment"
    assert payload[0]["line_status"] == "Current"
    assert payload[0]["budget_scope"] == "future"
    assert payload[0]["revisionnum"] == 1
    assert Decimal(payload[0]["budget_before_amount"]) == Decimal("0.00")
    assert Decimal(payload[0]["budget_after_amount"]) == Decimal("225.00")


def test_expense_setup_history_merges_setup_revision_events_with_budget_adjustments(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    active_period = periods[0]

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={
            "freqtype": "Every N Days",
            "frequency_value": 14,
            "effectivedate": "2026-04-01T00:00:00",
            "expenseamount": "1250.00",
        },
    )
    assert update_response.status_code == 200, update_response.text

    adjust_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Short-term increase"},
    )
    assert adjust_response.status_code == 200, adjust_response.text

    history_response = client.get(f"/api/budgets/{budget.budgetid}/expense-items/Rent/history")
    assert history_response.status_code == 200, history_response.text

    payload = history_response.json()
    assert payload["current_revisionnum"] == 1
    assert len(payload["entries"]) == 2
    entry_by_kind = {entry["history_kind"]: entry for entry in payload["entries"]}
    assert set(entry_by_kind) == {"budget_adjustment", "setup_revision"}
    assert entry_by_kind["setup_revision"]["revisionnum"] == 1
    assert entry_by_kind["budget_adjustment"]["revisionnum"] is None

    change_details = {change["field"]: change for change in entry_by_kind["setup_revision"]["change_details"]}
    assert change_details["freqtype"]["before_value"] == "Always"
    assert change_details["freqtype"]["after_value"] == "Every N Days"
    assert change_details["frequency_value"]["before_value"] is None
    assert change_details["frequency_value"]["after_value"] == 14
    assert change_details["expenseamount"]["before_value"] == "1200.00"
    assert change_details["expenseamount"]["after_value"] == "1250.00"


def test_income_setup_amount_change_creates_setup_revision_history_event(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/income-types/Salary",
        json={"amount": "2600.00"},
    )
    assert response.status_code == 200, response.text

    history_response = client.get(f"/api/budgets/{budget.budgetid}/income-types/Salary/history")
    assert history_response.status_code == 200, history_response.text

    payload = history_response.json()
    assert payload["current_revisionnum"] == 1
    assert len(payload["entries"]) == 1
    assert payload["entries"][0]["history_kind"] == "setup_revision"
    assert payload["entries"][0]["revisionnum"] == 1
    assert payload["entries"][0]["change_details"] == [
        {
            "field": "amount",
            "label": "Amount",
            "before_value": "2500.00",
            "after_value": "2600.00",
        }
    ]


def test_investment_setup_amount_change_creates_setup_revision_history_event(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund",
        json={"planned_amount": "90.00"},
    )
    assert response.status_code == 200, response.text

    history_response = client.get(f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund/history")
    assert history_response.status_code == 200, history_response.text

    payload = history_response.json()
    assert payload["current_revisionnum"] == 1
    assert len(payload["entries"]) == 1
    assert payload["entries"][0]["history_kind"] == "setup_revision"
    assert payload["entries"][0]["revisionnum"] == 1
    assert payload["entries"][0]["change_details"] == [
        {
            "field": "planned_amount",
            "label": "Planned amount",
            "before_value": "0.00",
            "after_value": "90.00",
        }
    ]


def test_future_budget_adjustment_uses_next_supported_revision_after_direct_setup_revision(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    setup_response = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"expenseamount": "1250.00"},
    )
    assert setup_response.status_code == 200, setup_response.text

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")

    adjust_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "future", "note": "Revision-linked increase"},
    )
    assert adjust_response.status_code == 200, adjust_response.text

    db_session.expire_all()
    expense_item = db_session.get(ExpenseItem, (budget.budgetid, "Rent"))
    assert expense_item.revisionnum == 2

    history_response = client.get(f"/api/budgets/{budget.budgetid}/expense-items/Rent/history")
    assert history_response.status_code == 200, history_response.text
    payload = history_response.json()
    assert payload["current_revisionnum"] == 2

    revision_numbers = [entry["revisionnum"] for entry in payload["entries"] if entry["revisionnum"] is not None]
    assert 1 in revision_numbers
    assert revision_numbers.count(2) >= 1


def test_history_endpoint_rebases_stale_stored_revisionnum_to_supported_history(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    expense_item = setup["expense_item"]
    expense_item.revisionnum = 7
    db_session.commit()

    history_response = client.get(f"/api/budgets/{budget.budgetid}/expense-items/Rent/history")
    assert history_response.status_code == 200, history_response.text
    payload = history_response.json()
    assert payload["current_revisionnum"] == 0

    db_session.refresh(expense_item)
    assert expense_item.revisionnum == 0
