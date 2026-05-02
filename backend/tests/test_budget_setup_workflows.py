from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from app.time_utils import utc_now

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, create_investment_item, generate_periods


def test_income_source_defaults_to_autoinclude_on_create_and_can_be_switched_off(client, db_session):
    budget = create_budget(db_session)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Everyday", is_primary=True)

    create_response = client.post(
        f"/api/budgets/{budget.budgetid}/income-types/",
        json={
            "incomedesc": "Salary",
            "issavings": False,
            "amount": "2500.00",
            "linked_account": "Everyday",
        },
    )
    assert create_response.status_code == 201, create_response.text
    assert create_response.json()["autoinclude"] is True

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/income-types/Salary",
        json={"autoinclude": False, "amount": "400.00"},
    )
    assert update_response.status_code == 200, update_response.text
    payload = update_response.json()
    assert payload["autoinclude"] is False
    assert payload["amount"] == "400.00"


def test_generated_periods_use_income_source_amount_for_auto_included_income(client, db_session):
    budget = create_budget(db_session)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Everyday", is_primary=True)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("2750.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")

    generate_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "count": 1,
        },
    )
    assert generate_response.status_code == 201, generate_response.text

    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{generate_response.json()['finperiodid']}")
    assert detail_response.status_code == 200, detail_response.text
    incomes = {row["incomedesc"]: row for row in detail_response.json()["incomes"]}
    assert incomes["Salary"]["budgetamount"] == "2750.00"


def test_adding_existing_income_to_current_and_future_updates_source_amount(client, db_session):
    budget = create_budget(db_session)
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Everyday", is_primary=True)
    income_type = create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("2500.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    current_period = periods[0]

    remove_response = client.delete(f"/api/budgets/{budget.budgetid}/periods/{current_period['finperiodid']}/income/Salary")
    assert remove_response.status_code == 204, remove_response.text

    add_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{current_period['finperiodid']}/add-income",
        json={
            "budgetid": budget.budgetid,
            "incomedesc": "Salary",
            "budgetamount": "2800.00",
            "scope": "future",
            "note": "Pay rise",
        },
    )
    assert add_response.status_code == 201, add_response.text

    db_session.refresh(income_type)
    assert income_type.amount == Decimal("2800.00")

    next_period_id = periods[1]["finperiodid"]
    next_period_detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{next_period_id}")
    assert next_period_detail.status_code == 200, next_period_detail.text
    incomes = {row["incomedesc"]: row for row in next_period_detail.json()["incomes"]}
    assert incomes["Salary"]["budgetamount"] == "2800.00"


def test_income_type_can_be_renamed_from_budget_setup_when_not_in_use(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("2500.00"))

    update_response = client.patch(
        f"/api/budgets/{budget.budgetid}/income-types/Salary",
        json={"incomedesc": "Main Salary", "amount": "2600.00"},
    )

    assert update_response.status_code == 200, update_response.text
    payload = update_response.json()
    assert payload["incomedesc"] == "Main Salary"
    assert payload["amount"] == "2600.00"

    list_response = client.get(f"/api/budgets/{budget.budgetid}/income-types/")
    assert list_response.status_code == 200, list_response.text
    income_descriptions = [item["incomedesc"] for item in list_response.json()]
    assert "Main Salary" in income_descriptions
    assert "Salary" not in income_descriptions


def test_primary_balance_and_primary_investment_selection_stay_unique(client, db_session):
    budget = create_budget(db_session)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    second_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Joint Account",
            "balance_type": "Transaction",
            "opening_balance": "250.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert second_balance.status_code == 201, second_balance.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/balance-types/")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert balances["Main Account"]["is_primary"] is False
    assert balances["Joint Account"]["is_primary"] is True

    first_investment = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Emergency Fund",
            "active": True,
            "initial_value": "100.00",
            "linked_account_desc": None,
            "is_primary": True,
        },
    )
    assert first_investment.status_code == 201, first_investment.text

    second_investment = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Holiday Fund",
            "active": True,
            "initial_value": "50.00",
            "linked_account_desc": None,
            "is_primary": True,
        },
    )
    assert second_investment.status_code == 201, second_investment.text

    investments_response = client.get(f"/api/budgets/{budget.budgetid}/investment-items/")
    assert investments_response.status_code == 200, investments_response.text
    investments = {row["investmentdesc"]: row for row in investments_response.json()}
    assert investments["Emergency Fund"]["is_primary"] is False
    assert investments["Holiday Fund"]["is_primary"] is True


def test_generation_succeeds_without_investment_lines_even_when_auto_surplus_is_enabled(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("1500.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("900.00"))

    balance_response = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "500.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert balance_response.status_code == 201, balance_response.text

    budget_update = client.patch(
        f"/api/budgets/{budget.budgetid}",
        json={"auto_add_surplus_to_investment": True},
    )
    assert budget_update.status_code == 200, budget_update.text

    generated = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    period = generated[0]

    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{period['finperiodid']}")
    assert detail_response.status_code == 200, detail_response.text
    payload = detail_response.json()
    assert payload["period"]["cycle_status"] == "ACTIVE"
    assert payload["investments"] == []
    assert len(payload["balances"]) == 1


def test_single_account_scenario_rejects_transfer_when_destination_missing(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    transfer_attempt = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Main Account",
            "destination_account": "Rainy Day",
            "amount": "50.00",
        },
    )
    assert transfer_attempt.status_code == 404
    assert "destination account not found" in transfer_attempt.json()["detail"].lower()


def test_generation_requires_a_primary_account_when_expense_tracking_is_configured(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    first_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Everyday",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert first_balance.status_code == 201, first_balance.text

    second_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Savings",
            "balance_type": "Savings",
            "opening_balance": "500.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert second_balance.status_code == 201, second_balance.text

    generation_attempt = client.post(
        f"/api/budgets/{budget.budgetid}/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": utc_now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "count": 1,
        },
    )
    assert generation_attempt.status_code == 422
    assert "primary account" in generation_attempt.json()["detail"].lower()


def test_multi_transaction_setup_uses_primary_account_for_expense_activity(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    joint_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Joint Account",
            "balance_type": "Transaction",
            "opening_balance": "400.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert joint_balance.status_code == 201, joint_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "125.00", "note": "Primary account spend"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("-125.00")
    assert Decimal(balances["Joint Account"]["movement_amount"]) == Decimal("0.00")


def test_primary_account_cannot_be_removed_when_it_is_the_only_active_primary(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    demote_primary = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account",
        json={"is_primary": False},
    )
    assert demote_primary.status_code == 422
    assert "active primary account" in demote_primary.json()["detail"].lower()

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "125.00", "note": "Primary account should still be available"},
    )
    assert expense_entry.status_code == 201, expense_entry.text


def test_primary_transaction_account_cannot_be_deleted_when_it_would_leave_no_primary(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    backup_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Backup Account",
            "balance_type": "Transaction",
            "opening_balance": "200.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert backup_balance.status_code == 201, backup_balance.text

    delete_response = client.delete(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account",
    )
    assert delete_response.status_code == 422
    assert "primary account" in delete_response.json()["detail"].lower()


def test_multi_transaction_setup_routes_linked_income_to_non_primary_account(client, db_session):
    budget = create_budget(db_session)
    create_income_type(
        db_session,
        budgetid=budget.budgetid,
        linked_account="Bills Account",
    )
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    bills_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Bills Account",
            "balance_type": "Transaction",
            "opening_balance": "250.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert bills_balance.status_code == 201, bills_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert income_update.status_code == 200, income_update.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("0.00")
    assert Decimal(balances["Bills Account"]["movement_amount"]) == Decimal("1000.00")


def test_reassigning_primary_account_changes_future_expense_activity_home(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    bills_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Bills Account",
            "balance_type": "Transaction",
            "opening_balance": "350.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert bills_balance.status_code == 201, bills_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    bills_reassignment = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Bills%20Account",
        json={"is_primary": True},
    )
    assert bills_reassignment.status_code == 200, bills_reassignment.text

    balances_config_response = client.get(f"/api/budgets/{budget.budgetid}/balance-types/")
    assert balances_config_response.status_code == 200, balances_config_response.text
    configured_balances = {row["balancedesc"]: row for row in balances_config_response.json()}
    assert configured_balances["Main Account"]["is_primary"] is False
    assert configured_balances["Bills Account"]["is_primary"] is True

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "80.00", "note": "Updated default account"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("0.00")
    assert Decimal(balances["Bills Account"]["movement_amount"]) == Decimal("-80.00")


def test_auto_surplus_allocation_targets_only_primary_investment_line(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("2000.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("1200.00"))

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    emergency_fund = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Emergency Fund",
            "active": True,
            "initial_value": "100.00",
            "linked_account_desc": None,
            "is_primary": True,
        },
    )
    assert emergency_fund.status_code == 201, emergency_fund.text

    holiday_fund = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Holiday Fund",
            "active": True,
            "initial_value": "50.00",
            "linked_account_desc": None,
            "is_primary": False,
        },
    )
    assert holiday_fund.status_code == 201, holiday_fund.text

    budget_update = client.patch(
        f"/api/budgets/{budget.budgetid}",
        json={"auto_add_surplus_to_investment": True},
    )
    assert budget_update.status_code == 200, budget_update.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}")
    assert detail_response.status_code == 200, detail_response.text
    investments = {row["investmentdesc"]: row for row in detail_response.json()["investments"]}
    assert Decimal(investments["Emergency Fund"]["budgeted_amount"]) == Decimal("800.00")
    assert Decimal(investments["Holiday Fund"]["budgeted_amount"]) == Decimal("0.00")


def test_reassigning_primary_investment_changes_future_auto_surplus_target(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("2000.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("1200.00"))

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    emergency_fund = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Emergency Fund",
            "active": True,
            "initial_value": "100.00",
            "linked_account_desc": None,
            "is_primary": True,
        },
    )
    assert emergency_fund.status_code == 201, emergency_fund.text

    holiday_fund = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Holiday Fund",
            "active": True,
            "initial_value": "50.00",
            "linked_account_desc": None,
            "is_primary": False,
        },
    )
    assert holiday_fund.status_code == 201, holiday_fund.text

    budget_update = client.patch(
        f"/api/budgets/{budget.budgetid}",
        json={"auto_add_surplus_to_investment": True},
    )
    assert budget_update.status_code == 200, budget_update.text

    primary_reassignment = client.patch(
        f"/api/budgets/{budget.budgetid}/investment-items/Holiday%20Fund",
        json={"is_primary": True},
    )
    assert primary_reassignment.status_code == 200, primary_reassignment.text
    assert primary_reassignment.json()["is_primary"] is True

    investments_response = client.get(f"/api/budgets/{budget.budgetid}/investment-items/")
    assert investments_response.status_code == 200, investments_response.text
    investments = {row["investmentdesc"]: row for row in investments_response.json()}
    assert investments["Emergency Fund"]["is_primary"] is False
    assert investments["Holiday Fund"]["is_primary"] is True

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}")
    assert detail_response.status_code == 200, detail_response.text
    period_investments = {row["investmentdesc"]: row for row in detail_response.json()["investments"]}
    assert Decimal(period_investments["Emergency Fund"]["budgeted_amount"]) == Decimal("0.00")
    assert Decimal(period_investments["Holiday Fund"]["budgeted_amount"]) == Decimal("800.00")


def test_mixed_accounts_scenario_routes_movements_to_linked_accounts(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, linked_account="Main Account")
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    brokerage_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Brokerage Cash",
            "balance_type": "Transaction",
            "opening_balance": "300.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert brokerage_balance.status_code == 201, brokerage_balance.text

    savings_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Rainy Day",
            "balance_type": "Savings",
            "opening_balance": "600.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert savings_balance.status_code == 201, savings_balance.text

    investment_item = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "ETF",
            "active": True,
            "initial_value": "0.00",
            "linked_account_desc": "Brokerage Cash",
            "source_account_desc": "Main Account",
            "is_primary": True,
        },
    )
    assert investment_item.status_code == 201, investment_item.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    salary_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert salary_update.status_code == 200, salary_update.text

    investment_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investments/ETF/transactions/",
        json={"amount": "150.00", "note": "Brokerage transfer"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    transfer_create = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Rainy Day",
            "destination_account": "Main Account",
            "amount": "75.00",
        },
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Transfer%3A%20Rainy%20Day%20to%20Main%20Account",
        json={"actualamount": "75.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("925.00")
    assert Decimal(balances["Brokerage Cash"]["movement_amount"]) == Decimal("150.00")
    assert Decimal(balances["Rainy Day"]["movement_amount"]) == Decimal("-75.00")


def test_missing_period_investment_reference_fails_clearly_for_downstream_activity(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    main_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert main_balance.status_code == 201, main_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    missing_investment_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investments/ETF/transactions/",
        json={"amount": "50.00", "note": "Should fail"},
    )
    assert missing_investment_tx.status_code == 404
    assert "investment line item not found" in missing_investment_tx.json()["detail"].lower()


def test_setup_history_endpoints_return_budget_adjustment_details(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("2500.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", expenseamount=Decimal("1200.00"))
    create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Emergency Fund")
    primary_balance = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={
            "balancedesc": "Main Account",
            "balance_type": "Transaction",
            "opening_balance": "1000.00",
            "active": True,
            "is_primary": True,
        },
    )
    assert primary_balance.status_code == 201, primary_balance.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_adjust = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary/budget",
        json={"budgetamount": "2600.00", "scope": "current", "note": "Pay review landed"},
    )
    assert income_adjust.status_code == 200, income_adjust.text

    expense_adjust = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Rent increased"},
    )
    assert expense_adjust.status_code == 200, expense_adjust.text

    investment_adjust = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/budget",
        json={"budgetamount": "100.00", "scope": "current", "note": "Boost savings target"},
    )
    assert investment_adjust.status_code == 200, investment_adjust.text

    income_history = client.get(f"/api/budgets/{budget.budgetid}/income-types/Salary/history")
    assert income_history.status_code == 200, income_history.text
    income_payload = income_history.json()
    assert income_payload["category"] == "income"
    assert income_payload["item_desc"] == "Salary"
    assert income_payload["entries"][0]["type"] == "BUDGETADJ"
    assert income_payload["entries"][0]["note"] == "Pay review landed"

    expense_history = client.get(f"/api/budgets/{budget.budgetid}/expense-items/Rent/history")
    assert expense_history.status_code == 200, expense_history.text
    expense_payload = expense_history.json()
    assert expense_payload["category"] == "expense"
    assert expense_payload["entries"][0]["type"] == "BUDGETADJ"
    assert expense_payload["entries"][0]["note"] == "Rent increased"

    investment_history = client.get(f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund/history")
    assert investment_history.status_code == 200, investment_history.text
    investment_payload = investment_history.json()
    assert investment_payload["category"] == "investment"
    assert investment_payload["entries"][0]["type"] == "BUDGETADJ"
    assert investment_payload["entries"][0]["note"] == "Boost savings target"


def test_adding_scheduled_expense_to_future_only_applies_to_periods_where_due(client, db_session):
    """A new 'Every N Days' expense should not be added to future periods where it does not occur."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    # Dummy expense so generation succeeds; the real scheduled expense is added afterward
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")

    # Generate three monthly periods: Jan, Feb, Mar 2026
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=3)
    period_1 = periods[0]
    period_2 = periods[1]
    period_3 = periods[2]

    # Create the scheduled expense after generation so it is not already in any period
    expense = create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Quarterly Bill",
        expenseamount=Decimal("100.00"),
        freqtype="Every N Days",
        frequency_value=75,
        effectivedate=datetime(2026, 1, 1),
        paytype="MANUAL",
    )

    # Add the expense to the first period with "future" scope
    add_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_1['finperiodid']}/add-expense",
        json={
            "budgetid": budget.budgetid,
            "expensedesc": expense.expensedesc,
            "budgetamount": "100.00",
            "scope": "future",
            "note": "Adding scheduled expense",
        },
    )
    assert add_response.status_code == 201, add_response.text

    # Verify the expense exists in period 1 (directly added)
    detail_1 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_1['finperiodid']}").json()
    expenses_1 = {e["expensedesc"] for e in detail_1["expenses"]}
    assert "Quarterly Bill" in expenses_1

    # Verify the expense does NOT exist in period 2 (no occurrence within Feb)
    detail_2 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_2['finperiodid']}").json()
    expenses_2 = {e["expensedesc"] for e in detail_2["expenses"]}
    assert "Quarterly Bill" not in expenses_2

    # Verify the expense exists in period 3 (occurs on 17 Mar, which is 75 days after 1 Jan)
    detail_3 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_3['finperiodid']}").json()
    expenses_3 = {e["expensedesc"] for e in detail_3["expenses"]}
    assert "Quarterly Bill" in expenses_3


def test_expense_item_default_account_can_be_non_transaction_account(client, db_session):
    """An expense item can route to any active account, not just Transaction accounts."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    # Primary transaction account
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main", balance_type="Transaction", is_primary=True)
    # Savings account
    create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Holiday Savings", balance_type="Savings", is_primary=False)

    # Create an expense item routed to the Savings account
    response = client.post(
        f"/api/budgets/{budget.budgetid}/expense-items/",
        json={
            "expensedesc": "Holiday",
            "active": True,
            "freqtype": "Always",
            "expenseamount": "500.00",
            "default_account_desc": "Holiday Savings",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["default_account_desc"] == "Holiday Savings"

    # Update the expense item to route to the Transaction account
    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Holiday",
        json={"default_account_desc": "Main"},
    )
    assert update.status_code == 200, update.text
    assert update.json()["default_account_desc"] == "Main"


def test_create_scheduled_expense_rejects_missing_frequency_value(client, db_session):
    """Fixed Day of Month and Every N Days require frequency_value on creation."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)

    fixed_response = client.post(
        f"/api/budgets/{budget.budgetid}/expense-items/",
        json={
            "expensedesc": "Rent",
            "active": True,
            "freqtype": "Fixed Day of Month",
            "expenseamount": "1200.00",
        },
    )
    assert fixed_response.status_code == 422
    assert "frequency value is required" in fixed_response.json()["detail"].lower()

    every_n_response = client.post(
        f"/api/budgets/{budget.budgetid}/expense-items/",
        json={
            "expensedesc": "Petrol",
            "active": True,
            "freqtype": "Every N Days",
            "expenseamount": "80.00",
        },
    )
    assert every_n_response.status_code == 422
    assert "frequency value is required" in every_n_response.json()["detail"].lower()


def test_create_every_n_days_expense_rejects_missing_effective_date(client, db_session):
    """Every N Days requires an effective date on creation."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)

    response = client.post(
        f"/api/budgets/{budget.budgetid}/expense-items/",
        json={
            "expensedesc": "Petrol",
            "active": True,
            "freqtype": "Every N Days",
            "frequency_value": 14,
            "expenseamount": "80.00",
        },
    )
    assert response.status_code == 422
    assert "effective date is required" in response.json()["detail"].lower()


def test_update_expense_to_scheduled_requires_frequency_value(client, db_session):
    """Updating an Always expense to Fixed Day of Month requires frequency_value."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always")

    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"freqtype": "Fixed Day of Month"},
    )
    assert update.status_code == 422
    assert "frequency value is required" in update.json()["detail"].lower()


def test_update_expense_schedule_adds_to_future_periods_where_now_due(client, db_session):
    """Changing an expense schedule should create PeriodExpense rows in future unlocked periods where it now occurs."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    # Create an 'Always' expense that exists in all generated periods
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always", expenseamount=Decimal("100.00"))

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=3)
    period_1 = periods[0]
    period_2 = periods[1]
    period_3 = periods[2]

    # Verify Rent exists in all three periods
    for p in periods:
        detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p['finperiodid']}").json()
        assert "Rent" in {e["expensedesc"] for e in detail["expenses"]}

    # Change to Every 75 Days (occurs in Jan and Mar, but not Feb)
    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={
            "freqtype": "Every N Days",
            "frequency_value": 75,
            "effectivedate": "2026-01-01T00:00:00",
            "expenseamount": "100.00",
        },
    )
    assert update.status_code == 200, update.text

    # Period 1 (Jan) — still occurs on 1 Jan
    detail_1 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_1['finperiodid']}").json()
    expenses_1 = {e["expensedesc"]: e for e in detail_1["expenses"]}
    assert "Rent" in expenses_1
    assert expenses_1["Rent"]["budgetamount"] == "100.00"

    # Period 2 (Feb) — no longer occurs (next is 17 Mar)
    detail_2 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_2['finperiodid']}").json()
    expenses_2 = {e["expensedesc"] for e in detail_2["expenses"]}
    assert "Rent" not in expenses_2

    # Period 3 (Mar) — occurs on 17 Mar
    detail_3 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_3['finperiodid']}").json()
    expenses_3 = {e["expensedesc"]: e for e in detail_3["expenses"]}
    assert "Rent" in expenses_3
    assert expenses_3["Rent"]["budgetamount"] == "100.00"


def test_update_expense_schedule_removes_from_future_periods_via_later_effective_date(client, db_session):
    """Pushing an effective date forward should remove the expense from future periods before the new date."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Subscription",
        freqtype="Fixed Day of Month",
        frequency_value=15,
        effectivedate=datetime(2026, 1, 1),
        expenseamount=Decimal("50.00"),
    )

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=3)
    period_2 = periods[1]  # Feb
    period_3 = periods[2]  # Mar

    # Push effective date to 1 March — Feb should lose the expense
    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Subscription",
        json={"effectivedate": "2026-03-01T00:00:00"},
    )
    assert update.status_code == 200, update.text

    detail_2 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_2['finperiodid']}").json()
    assert "Subscription" not in {e["expensedesc"] for e in detail_2["expenses"]}

    detail_3 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_3['finperiodid']}").json()
    assert "Subscription" in {e["expensedesc"] for e in detail_3["expenses"]}


def test_update_expense_amount_propagates_to_all_future_unlocked_periods(client, db_session):
    """Changing the amount of an 'Always' expense updates every future unlocked period."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always", expenseamount=Decimal("1000.00"))

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=2)

    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"expenseamount": "1200.00"},
    )
    assert update.status_code == 200, update.text

    for p in periods:
        detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p['finperiodid']}").json()
        rent = next(e for e in detail["expenses"] if e["expensedesc"] == "Rent")
        assert rent["budgetamount"] == "1200.00"


def test_update_expense_schedule_does_not_remove_future_periods_with_actuals(client, db_session):
    """If a future unlocked period already has actuals for the expense, schedule propagation must not delete it."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always", expenseamount=Decimal("100.00"))

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=2)
    period_2 = periods[1]

    # Record an actual amount in period 2
    patch = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{period_2['finperiodid']}/expense/Rent",
        json={"actualamount": "50.00"},
    )
    assert patch.status_code == 200, patch.text

    # Change schedule so it no longer occurs in period 2 (push effective date past period 2)
    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"effectivedate": "2026-03-01T00:00:00"},
    )
    assert update.status_code == 200, update.text

    # Period 2 should still contain Rent because actuals were recorded
    detail_2 = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_2['finperiodid']}").json()
    assert "Rent" in {e["expensedesc"] for e in detail_2["expenses"]}


def test_deactivating_expense_removes_from_future_unlocked_periods(client, db_session):
    """Setting active=False should remove the expense from all future unlocked periods without actuals."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always", expenseamount=Decimal("100.00"))

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=2)

    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"active": False},
    )
    assert update.status_code == 200, update.text

    for p in periods:
        detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p['finperiodid']}").json()
        assert "Rent" not in {e["expensedesc"] for e in detail["expenses"]}


def test_activating_expense_adds_to_future_unlocked_periods(client, db_session):
    """Setting active=True on an inactive expense should add it to future unlocked periods according to its schedule."""
    budget = create_budget(db_session, budget_frequency="Monthly")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Rent",
        freqtype="Always",
        expenseamount=Decimal("100.00"),
    )

    # Deactivate before generating periods
    deactivate = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"active": False},
    )
    assert deactivate.status_code == 200, deactivate.text

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 1, 1), count=2)

    # Verify Rent is absent before activation
    for p in periods:
        detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p['finperiodid']}").json()
        assert "Rent" not in {e["expensedesc"] for e in detail["expenses"]}

    update = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"active": True},
    )
    assert update.status_code == 200, update.text

    for p in periods:
        detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p['finperiodid']}").json()
        expenses = {e["expensedesc"]: e for e in detail["expenses"]}
        assert "Rent" in expenses
        assert expenses["Rent"]["budgetamount"] == "100.00"
