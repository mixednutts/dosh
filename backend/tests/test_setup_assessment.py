from __future__ import annotations

from app.models import FinancialPeriod, PeriodBalance
from app.time_utils import app_now_naive

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, create_investment_item, generate_periods


def test_setup_assessment_reports_blocking_primary_account_gap(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Everyday",
        is_primary=False,
    )

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["can_generate"] is False
    assert any("primary account" in issue.lower() for issue in payload["blocking_issues"])


def test_setup_assessment_marks_generated_primary_account_as_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)
    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=startdate,
        enddate=startdate,
        budgetowner=budget.budgetowner,
        cycle_status="ACTIVE",
    )
    db_session.add(period)
    db_session.flush()
    db_session.add(
        PeriodBalance(
            finperiodid=period.finperiodid,
            budgetid=budget.budgetid,
            balancedesc="Main Account",
            opening_amount="1000.00",
            closing_amount="1000.00",
            movement_amount="0.00",
        )
    )
    db_session.commit()

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    main_account = next(account for account in payload["accounts"] if account["balancedesc"] == "Main Account")
    assert main_account["in_use"] is True
    assert main_account["can_delete"] is False
    assert any("generated budget cycles" in reason.lower() for reason in main_account["reasons"])


def test_setup_assessment_marks_generated_income_type_as_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary")
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    salary = next(item for item in payload["income_types"] if item["incomedesc"] == "Salary")
    assert salary["in_use"] is True
    assert salary["can_delete"] is False


def test_delete_rejects_account_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account")

    assert delete_response.status_code == 422
    assert "in use" in delete_response.json()["detail"].lower()


def test_deactivation_rejects_account_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account",
        json={"active": False},
    )

    assert update_response.status_code == 422
    assert "in use" in update_response.json()["detail"].lower()


def test_delete_rejects_income_type_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary")
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}/income-types/Salary")

    assert delete_response.status_code == 422
    assert "in use" in delete_response.json()["detail"].lower()


def test_delete_rejects_expense_item_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}/expense-items/Rent")

    assert delete_response.status_code == 422
    assert "in use" in delete_response.json()["detail"].lower()


def test_deactivation_rejects_expense_item_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"active": False},
    )

    assert update_response.status_code == 422
    assert "in use" in update_response.json()["detail"].lower()


def test_edit_rejects_investment_line_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Emergency Fund")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund",
        json={"active": False},
    )

    assert update_response.status_code == 422
    assert "in use" in update_response.json()["detail"].lower()
