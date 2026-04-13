from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from app.models import Budget, FinancialPeriod, IncomeType, PeriodBalance
from app.time_utils import utc_now
from app.transaction_ledger import sync_period_state

from .factories import create_balance_type, create_minimum_budget_setup, generate_periods


def _get_balances(client, finperiodid: int) -> dict[str, dict]:
    response = client.get(f"/api/periods/{finperiodid}/balances")
    assert response.status_code == 200, response.text
    return {row["balancedesc"]: row for row in response.json()}


def test_dynamic_balances_with_no_closed_cycles(client, db_session):
    """Explicitly tests the no-closed-cycle case; verifies fallback to BalanceType.opening_balance."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    # Create a savings account with a specific opening balance
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    assert len(periods) == 2

    # Both cycles should use BalanceType.opening_balance as the base
    for period in periods:
        balances = _get_balances(client, period["finperiodid"])
        assert Decimal(balances["Main Account"]["opening_amount"]) == Decimal("1000.00")
        assert Decimal(balances["Savings"]["opening_amount"]) == Decimal("500.00")


def test_dynamic_balances_after_transaction_in_first_open_cycle(client, db_session):
    """Second open cycle picks up new closing from first after income transaction."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    # Record income in first cycle
    income_update = client.patch(
        f"/api/periods/{first_id}/income/Salary",
        json={"actualamount": "500.00"},
    )
    assert income_update.status_code == 200, income_update.text

    # Second cycle's opening should reflect first cycle's new closing
    second_balances = _get_balances(client, second_id)
    assert Decimal(second_balances["Main Account"]["opening_amount"]) == Decimal("1500.00")
    assert Decimal(second_balances["Main Account"]["closing_amount"]) == Decimal("1500.00")


def test_dynamic_balances_anchor_to_most_recent_closed_cycle(client, db_session):
    """Multiple closed cycles exist; calculation anchors to the most recent one."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=120)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=4)
    assert len(periods) == 4

    p1_id = periods[0]["finperiodid"]
    p2_id = periods[1]["finperiodid"]
    p3_id = periods[2]["finperiodid"]
    p4_id = periods[3]["finperiodid"]

    # Close first two cycles
    for pid in [p1_id, p2_id]:
        close_response = client.post(
            f"/api/periods/{pid}/closeout",
            json={"create_next_cycle": False},
        )
        assert close_response.status_code == 200, close_response.text

    # Record income in cycle 3
    income_update = client.patch(
        f"/api/periods/{p3_id}/income/Salary",
        json={"actualamount": "300.00"},
    )
    assert income_update.status_code == 200, income_update.text

    # Cycle 4's opening should be based on cycle 2's closing (most recent closed)
    # Cycle 2 closed with Main Account at 1000.00 (no transactions in cycle 2)
    # Cycle 3 had 300 income, so closing = 1300
    # Cycle 4 opening should be 1300
    fourth_balances = _get_balances(client, p4_id)
    assert Decimal(fourth_balances["Main Account"]["opening_amount"]) == Decimal("1300.00")

    # Cycle 1 and 2 closing balances should remain frozen
    p1_balances = _get_balances(client, p1_id)
    p2_balances = _get_balances(client, p2_id)
    assert Decimal(p1_balances["Main Account"]["closing_amount"]) == Decimal("1000.00")
    assert Decimal(p2_balances["Main Account"]["closing_amount"]) == Decimal("1000.00")


def test_dynamic_balances_with_transfers(client, db_session):
    """Transfer out of savings; both accounts reconcile correctly."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    # Create transfer in first cycle
    transfer_create = client.post(
        f"/api/periods/{first_id}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Savings",
            "destination_account": "Main Account",
            "amount": "100.00",
        },
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/periods/{first_id}/income/Transfer%3A%20Savings%20to%20Main%20Account",
        json={"actualamount": "100.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    # First cycle: Main = 1100, Savings = 400
    first_balances = _get_balances(client, first_id)
    assert Decimal(first_balances["Main Account"]["closing_amount"]) == Decimal("1100.00")
    assert Decimal(first_balances["Savings"]["closing_amount"]) == Decimal("400.00")

    # Second cycle should inherit these as openings
    second_balances = _get_balances(client, second_id)
    assert Decimal(second_balances["Main Account"]["opening_amount"]) == Decimal("1100.00")
    assert Decimal(second_balances["Savings"]["opening_amount"]) == Decimal("400.00")


def test_stored_values_propagate_after_income_actual_update(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    client.patch(f"/api/periods/{first_id}/income/Salary", json={"actualamount": "500.00"})

    # Direct DB check: stored values in second period should be fresh
    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    assert Decimal(pb.opening_amount) == Decimal("1500.00")


def test_stored_values_propagate_after_income_actual_add(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    client.post(f"/api/periods/{first_id}/income/Salary/add", json={"amount": "300.00"})

    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    assert Decimal(pb.opening_amount) == Decimal("1300.00")


def test_stored_values_propagate_after_expense_entry(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    response = client.post(
        f"/api/periods/{first_id}/expenses/Rent/entries/",
        json={"amount": "200.00", "note": "Rent paid"},
    )
    assert response.status_code == 201, response.text

    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    assert Decimal(pb.opening_amount) == Decimal("800.00")


def test_stored_values_propagate_after_expense_actual_set(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    client.patch(f"/api/periods/{first_id}/expense/Rent", json={"actualamount": "300.00"})

    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    assert Decimal(pb.opening_amount) == Decimal("700.00")


def test_stored_values_propagate_after_investment_transaction(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    emergency = db_session.get(
        type(setup["investment_item"]),
        (budget.budgetid, "Emergency Fund"),
    )
    emergency.linked_account_desc = "Savings"
    emergency.source_account_desc = "Main Account"
    db_session.commit()

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    response = client.post(
        f"/api/periods/{first_id}/investments/Emergency%20Fund/transactions/",
        json={"amount": "100.00", "note": "Contribution"},
    )
    assert response.status_code == 201, response.text

    # Investment debits source account and credits linked account
    pb_main = db_session.get(PeriodBalance, (second_id, "Main Account"))
    assert Decimal(pb_main.opening_amount) == Decimal("900.00")
    pb_savings = db_session.get(PeriodBalance, (second_id, "Savings"))
    assert Decimal(pb_savings.opening_amount) == Decimal("600.00")


def test_transfer_validation_uses_fresh_closing_amount(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    # Drain Main Account in first cycle
    client.patch(f"/api/periods/{first_id}/income/Salary", json={"actualamount": "-1000.00"})

    # Try to transfer 1.00 from Main Account in second cycle
    # Main Account closing in first cycle is 0.00, so this should fail
    transfer_response = client.post(
        f"/api/periods/{second_id}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Main Account",
            "destination_account": "Savings",
            "amount": "1.00",
        },
    )
    assert transfer_response.status_code == 422
    assert "sufficient balance" in transfer_response.json()["detail"].lower()


def test_transfer_validation_defensive_guard_catches_stale_data(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]

    # Add income in first cycle (propagation updates second cycle opening to 1500)
    client.patch(f"/api/periods/{first_id}/income/Salary", json={"actualamount": "500.00"})

    # Manually corrupt the stored second-cycle opening to make it look like 2000
    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    pb.opening_amount = Decimal("2000.00")
    pb.closing_amount = Decimal("2000.00")
    db_session.commit()

    # Try to transfer 1800 from Main Account in second cycle
    # Stored value says 2000, so 1800 would pass
    # But true computed value is 1500, so 1800 should fail
    transfer_response = client.post(
        f"/api/periods/{second_id}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Main Account",
            "destination_account": "Savings",
            "amount": "1800.00",
        },
    )
    assert transfer_response.status_code == 422
    assert "sufficient balance" in transfer_response.json()["detail"].lower()


def test_all_transaction_entry_points_leave_no_stale_balances(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    emergency = db_session.get(
        type(setup["investment_item"]),
        (budget.budgetid, "Emergency Fund"),
    )
    emergency.linked_account_desc = "Savings"
    emergency.source_account_desc = "Main Account"
    db_session.commit()

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)
    first_id = periods[0]["finperiodid"]
    second_id = periods[1]["finperiodid"]
    third_id = periods[2]["finperiodid"]

    # 1. Income actual set
    client.patch(f"/api/periods/{first_id}/income/Salary", json={"actualamount": "100.00"})
    # 2. Income actual add
    client.post(f"/api/periods/{first_id}/income/Salary/add", json={"amount": "50.00"})
    # 3. Expense entry
    client.post(
        f"/api/periods/{first_id}/expenses/Rent/entries/",
        json={"amount": "25.00", "note": "Rent"},
    )
    # 4. Expense actual set
    client.patch(f"/api/periods/{first_id}/expense/Rent", json={"actualamount": "30.00"})
    # 5. Investment transaction
    client.post(
        f"/api/periods/{first_id}/investments/Emergency%20Fund/transactions/",
        json={"amount": "10.00", "note": "Save"},
    )
    # 6. Transfer
    client.post(
        f"/api/periods/{first_id}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Savings",
            "destination_account": "Main Account",
            "amount": "20.00",
        },
    )
    client.patch(
        f"/api/periods/{first_id}/income/Transfer%3A%20Savings%20to%20Main%20Account",
        json={"actualamount": "20.00"},
    )

    # Compute expected first-cycle closing manually
    # Main Account: 1000 + 100 + 50 - 30 - 10 (investment debit) + 20 = 1130
    # Savings: 500 + 10 (investment credit) - 20 = 490
    first_balances = _get_balances(client, first_id)
    assert Decimal(first_balances["Main Account"]["closing_amount"]) == Decimal("1130.00")
    assert Decimal(first_balances["Savings"]["closing_amount"]) == Decimal("490.00")

    # Second and third cycles should have fresh stored values
    for pid in [second_id, third_id]:
        pb_main = db_session.get(PeriodBalance, (pid, "Main Account"))
        pb_savings = db_session.get(PeriodBalance, (pid, "Savings"))
        assert Decimal(pb_main.opening_amount) == Decimal("1130.00")
        assert Decimal(pb_savings.opening_amount) == Decimal("490.00")

        # API should also return the same values
        api_balances = _get_balances(client, pid)
        assert Decimal(api_balances["Main Account"]["opening_amount"]) == Decimal("1130.00")
        assert Decimal(api_balances["Savings"]["opening_amount"]) == Decimal("490.00")


def test_forward_limit_returns_200_with_limit_exceeded_header(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=15)
    assert len(periods) == 15

    # Default limit is 10; cycle 12 is 12 cycles from the start (no frozen anchor)
    # So it exceeds the limit
    cycle_12_id = periods[11]["finperiodid"]
    response = client.get(f"/api/periods/{cycle_12_id}/balances")
    assert response.status_code == 200
    assert response.json() == []
    assert response.headers.get("X-Balances-Limit-Exceeded") == "true"

    # Period detail should also report the limit exceeded
    detail = client.get(f"/api/periods/{cycle_12_id}").json()
    assert detail["balances_limit_exceeded"] is True


def test_forward_limit_allows_within_limit(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=10)
    assert len(periods) == 10

    # Cycle 10 is exactly at the limit
    cycle_10_id = periods[9]["finperiodid"]
    response = client.get(f"/api/periods/{cycle_10_id}/balances")
    assert response.status_code == 200
    balances = response.json()
    assert len(balances) > 0
    assert balances[0]["balancedesc"] == "Main Account"


def test_forward_limit_respects_custom_budget_setting(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    # Set custom limit to 5
    budget.max_forward_balance_cycles = 5
    db_session.commit()

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=7)
    assert len(periods) == 7

    # Cycle 6 exceeds limit of 5
    cycle_6_id = periods[5]["finperiodid"]
    response = client.get(f"/api/periods/{cycle_6_id}/balances")
    assert response.status_code == 200
    assert response.json() == []
    assert response.headers.get("X-Balances-Limit-Exceeded") == "true"

    detail = client.get(f"/api/periods/{cycle_6_id}").json()
    assert detail["balances_limit_exceeded"] is True

    # Cycle 5 is within limit
    cycle_5_id = periods[4]["finperiodid"]
    response = client.get(f"/api/periods/{cycle_5_id}/balances")
    assert response.status_code == 200
    assert response.headers.get("X-Balances-Limit-Exceeded") is None


def test_gap_analysis_zero_anomalies(client, db_session):
    """Reconciliation test: stored values match dynamically computed values."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    db_session.commit()

    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Savings",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=5)
    first_id = periods[0]["finperiodid"]

    # Add mixed transactions
    client.patch(f"/api/periods/{first_id}/income/Salary", json={"actualamount": "200.00"})
    client.post(
        f"/api/periods/{first_id}/expenses/Rent/entries/",
        json={"amount": "50.00", "note": "Rent"},
    )

    # Deliberately corrupt a later period's stored value
    second_id = periods[1]["finperiodid"]
    pb = db_session.get(PeriodBalance, (second_id, "Main Account"))
    pb.opening_amount = Decimal("9999.99")
    db_session.commit()

    # Run propagation to fix it
    sync_period_state(first_id, db_session)
    db_session.commit()

    # Verify all stored values match computed values within the limit
    from app.transaction_ledger import compute_dynamic_period_balances

    anomalies = []
    for period in periods:
        pid = period["finperiodid"]
        dynamic = compute_dynamic_period_balances(pid, db_session, max_forward_cycles=10)
        if dynamic is None:
            continue
        dynamic_by_account = {b.balancedesc: b for b in dynamic}
        for pb in db_session.query(PeriodBalance).filter(PeriodBalance.finperiodid == pid).all():
            dyn = dynamic_by_account.get(pb.balancedesc)
            if not dyn:
                continue
            if (
                Decimal(pb.opening_amount) != Decimal(dyn.opening_amount)
                or Decimal(pb.movement_amount) != Decimal(dyn.movement_amount)
                or Decimal(pb.closing_amount) != Decimal(dyn.closing_amount)
            ):
                anomalies.append({
                    "period": pid,
                    "account": pb.balancedesc,
                    "stored": (str(pb.opening_amount), str(pb.movement_amount), str(pb.closing_amount)),
                    "computed": (str(dyn.opening_amount), str(dyn.movement_amount), str(dyn.closing_amount)),
                })

    assert anomalies == [], f"Found anomalies: {anomalies}"
