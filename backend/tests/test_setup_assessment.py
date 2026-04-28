from __future__ import annotations

from app.setup_assessment import budget_setup_assessment
from app.models import FinancialPeriod, PeriodBalance, PeriodTransaction
from app.time_utils import utc_now

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, create_investment_item, generate_periods, local_midnight_utc


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
    assert any("primary transaction account" in issue.lower() for issue in payload["blocking_issues"])


def test_setup_assessment_ignores_non_transaction_primary_accounts(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings Jar",
        balance_type="Savings",
        is_primary=True,
    )

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["can_generate"] is False
    assert any("primary transaction account" in issue.lower() for issue in payload["blocking_issues"])


def test_balance_type_primary_is_scoped_per_account_type(client, db_session):
    budget = create_budget(db_session)
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Everyday",
        balance_type="Transaction",
        is_primary=True,
    )

    create_response = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Rainy Day Savings",
            "balance_type": "Savings",
            "opening_balance": "250.00",
            "active": True,
            "is_primary": True,
        },
    )

    assert create_response.status_code == 201, create_response.text

    list_response = client.get(f"/api/budgets/{budget.budgetid}/balance-types/")
    assert list_response.status_code == 200, list_response.text
    balances = {item["balancedesc"]: item for item in list_response.json()}

    assert balances["Everyday"]["is_primary"] is True
    assert balances["Rainy Day Savings"]["is_primary"] is True


def test_setup_assessment_marks_generated_primary_account_as_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)
    startdate = local_midnight_utc(utc_now())
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


def test_setup_assessment_marks_account_with_recorded_movement_as_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)
    startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
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
        PeriodTransaction(
            finperiodid=period.finperiodid,
            budgetid=budget.budgetid,
            source="expense",
            type="expense_payment",
            source_key="Rent",
            amount="45.00",
            affected_account_desc="Main Account",
        )
    )
    db_session.commit()

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    main_account = next(account for account in payload["accounts"] if account["balancedesc"] == "Main Account")
    assert main_account["in_use"] is True
    assert main_account["can_edit_structure"] is False
    assert any("recorded account movement" in reason.lower() for reason in main_account["reasons"])


def test_setup_assessment_marks_generated_income_type_as_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary")
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    salary = next(item for item in payload["income_types"] if item["incomedesc"] == "Salary")
    assert salary["in_use"] is True
    assert salary["can_delete"] is False


def test_setup_assessment_warns_when_auto_surplus_has_no_primary_investment(client, db_session):
    budget = create_budget(db_session)
    budget.auto_add_surplus_to_investment = True
    db_session.add(budget)
    db_session.commit()
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary")
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)
    create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Emergency Fund", is_primary=False)

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["can_generate"] is True
    assert any("automatic surplus allocation" in warning.lower() for warning in payload["warnings"])


def test_setup_assessment_requires_an_active_account_when_only_inactive_accounts_exist(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    inactive_account = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Dormant Account", is_primary=True)
    inactive_account.active = False
    db_session.add(inactive_account)
    db_session.commit()

    response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["can_generate"] is False
    assert any("add at least one active account" in issue.lower() for issue in payload["blocking_issues"])


def test_budget_setup_assessment_returns_none_for_missing_budget(db_session):
    assert budget_setup_assessment(999999, db_session) is None


def test_delete_rejects_account_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
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
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account",
        json={"active": False},
    )

    assert update_response.status_code == 422
    assert "in use" in update_response.json()["detail"].lower()


def test_in_use_account_allows_primary_flag_change_when_structure_is_unchanged(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Everyday", is_primary=True)
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Test Savings Account",
        balance_type="Savings",
        opening_balance="500.00",
        is_primary=False,
    )

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Test%20Savings%20Account",
        json={
            "balance_type": "Savings",
            "opening_balance": "500.00",
            "active": True,
            "is_primary": True,
        },
    )

    assert update_response.status_code == 200, update_response.text
    payload = update_response.json()
    assert payload["is_primary"] is True
    assert payload["balance_type"] == "Savings"


def test_delete_rejects_income_type_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary")
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
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
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}/expense-items/Rent")

    assert delete_response.status_code == 422
    assert "in use" in delete_response.json()["detail"].lower()


def test_deactivation_allows_expense_item_that_is_already_in_use(client, db_session):
    """Deactivation is allowed for in-use expenses; it only affects future cycle generation."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    # Verify assessment shows in_use but allows deactivation with impact guidance
    assessment_response = client.get(f"/api/budgets/{budget.budgetid}/setup-assessment")
    assert assessment_response.status_code == 200
    expense_assessment = next(
        (e for e in assessment_response.json()["expense_items"] if e["expensedesc"] == "Rent"),
        None
    )
    assert expense_assessment is not None
    assert expense_assessment["in_use"] is True
    assert expense_assessment["can_deactivate"] is True
    assert expense_assessment["deactivation_impact"] is not None
    assert "future generated budget cycles" in expense_assessment["deactivation_impact"]

    # Deactivation should succeed (only affects future cycles)
    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"active": False},
    )

    assert update_response.status_code == 200
    assert update_response.json()["active"] is False


def test_edit_rejects_investment_line_that_is_already_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Emergency Fund")
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund",
        json={"active": False},
    )

    assert update_response.status_code == 422
    assert "in use" in update_response.json()["detail"].lower()
