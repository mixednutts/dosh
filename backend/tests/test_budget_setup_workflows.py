from __future__ import annotations

from decimal import Decimal

from app.time_utils import app_now_naive

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, create_investment_item, generate_periods


def test_income_source_defaults_to_autoinclude_on_create_and_can_be_switched_off(client, db_session):
    budget = create_budget(db_session)

    create_response = client.post(
        f"/api/budgets/{budget.budgetid}/income-types/",
        json={
            "incomedesc": "Salary",
            "issavings": False,
            "amount": "2500.00",
            "linked_account": None,
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
        "/api/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "count": 1,
        },
    )
    assert generate_response.status_code == 201, generate_response.text

    detail_response = client.get(f"/api/periods/{generate_response.json()['finperiodid']}")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    current_period = periods[0]

    remove_response = client.delete(f"/api/periods/{current_period['finperiodid']}/income/Salary")
    assert remove_response.status_code == 204, remove_response.text

    add_response = client.post(
        f"/api/periods/{current_period['finperiodid']}/add-income",
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
    next_period_detail = client.get(f"/api/periods/{next_period_id}")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    period = generated[0]

    detail_response = client.get(f"/api/periods/{period['finperiodid']}")
    assert detail_response.status_code == 200, detail_response.text
    payload = detail_response.json()
    assert payload["period"]["cycle_status"] == "ACTIVE"
    assert payload["investments"] == []
    assert len(payload["balances"]) == 1


def test_single_account_scenario_rejects_savings_transfer_without_savings_account(client, db_session):
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    transfer_attempt = client.post(
        f"/api/periods/{active_period['finperiodid']}/savings-transfer",
        json={"budgetid": budget.budgetid, "balancedesc": "Main Account", "amount": "50.00"},
    )
    assert transfer_attempt.status_code == 422
    assert "not a savings account" in transfer_attempt.json()["detail"].lower()


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
        "/api/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    expense_entry = client.post(
        f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "125.00", "note": "Primary account spend"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    demote_primary = client.patch(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account",
        json={"is_primary": False},
    )
    assert demote_primary.status_code == 422
    assert "active primary account" in demote_primary.json()["detail"].lower()

    expense_entry = client.post(
        f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_update = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert income_update.status_code == 200, income_update.text

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
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
        f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "80.00", "note": "Updated default account"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    detail_response = client.get(f"/api/periods/{active_period['finperiodid']}")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    detail_response = client.get(f"/api/periods/{active_period['finperiodid']}")
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
            "is_primary": True,
        },
    )
    assert investment_item.status_code == 201, investment_item.text

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    salary_update = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert salary_update.status_code == 200, salary_update.text

    investment_tx = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/ETF/transactions/",
        json={"amount": "150.00", "note": "Brokerage transfer"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    transfer_create = client.post(
        f"/api/periods/{active_period['finperiodid']}/savings-transfer",
        json={"budgetid": budget.budgetid, "balancedesc": "Rainy Day", "amount": "75.00"},
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Transfer%20from%20Rainy%20Day",
        json={"actualamount": "75.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("1075.00")
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    missing_investment_tx = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/ETF/transactions/",
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_adjust = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary/budget",
        json={"budgetamount": "2600.00", "scope": "current", "note": "Pay review landed"},
    )
    assert income_adjust.status_code == 200, income_adjust.text

    expense_adjust = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Rent increased"},
    )
    assert expense_adjust.status_code == 200, expense_adjust.text

    investment_adjust = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/budget",
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
