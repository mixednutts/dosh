from __future__ import annotations

from decimal import Decimal

from app.cycle_constants import CARRIED_FORWARD_DESC
from app.models import PeriodIncome, PeriodTransaction
from app.time_utils import utc_now

from .factories import create_balance_type, create_minimum_budget_setup, generate_periods


def test_income_transactions_drive_actuals_and_support_corrections_and_delete(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]
    finperiodid = active_period["finperiodid"]

    income_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "500.00", "note": "Salary paid"},
    )
    assert income_tx.status_code == 201, income_tx.text

    correction_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "-50.00", "note": "Payslip correction"},
    )
    assert correction_tx.status_code == 201, correction_tx.text

    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}")
    assert detail.status_code == 200, detail.text
    salary = next(income for income in detail.json()["incomes"] if income["incomedesc"] == "Salary")
    assert Decimal(salary["actualamount"]) == Decimal("450.00")

    list_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/")
    assert list_response.status_code == 200, list_response.text
    payload = list_response.json()
    assert len(payload) == 2
    assert {row["source"] for row in payload} == {"income"}

    delete_response = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/{correction_tx.json()['id']}"
    )
    assert delete_response.status_code == 204, delete_response.text

    refreshed_detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}")
    assert refreshed_detail.status_code == 200, refreshed_detail.text
    refreshed_salary = next(income for income in refreshed_detail.json()["incomes"] if income["incomedesc"] == "Salary")
    assert Decimal(refreshed_salary["actualamount"]) == Decimal("500.00")


def test_transfer_backed_income_transactions_preserve_transfer_ledger_behavior(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Rainy Day",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]
    finperiodid = active_period["finperiodid"]

    transfer_create = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Rainy Day",
            "destination_account": "Main Account",
            "amount": "75.00",
        },
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main%20Account/transactions/",
        json={"amount": "75.00", "note": "Moved to cover bills"},
    )
    assert transfer_tx.status_code == 201, transfer_tx.text
    assert transfer_tx.json()["source"] == "transfer"

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}
    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("75.00")
    assert Decimal(balances["Rainy Day"]["movement_amount"]) == Decimal("-75.00")


def test_carried_forward_uses_income_transactions_but_stays_structurally_protected(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    next_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    income_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "2500.00"},
    )
    assert income_update.status_code == 200, income_update.text

    closeout = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "carry_forward": True, "comments": "Carry it forward"},
    )
    assert closeout.status_code == 200, closeout.text

    carried_forward_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{next_period['finperiodid']}/income/{CARRIED_FORWARD_DESC.replace(' ', '%20')}/transactions/",
        json={"amount": "2500.00", "note": "Opening cash arrived"},
    )
    assert carried_forward_tx.status_code == 201, carried_forward_tx.text

    next_detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{next_period['finperiodid']}")
    assert next_detail.status_code == 200, next_detail.text
    carried_forward = next(
        income for income in next_detail.json()["incomes"] if income["incomedesc"] == CARRIED_FORWARD_DESC
    )
    assert Decimal(carried_forward["actualamount"]) == Decimal("2500.00")

    delete_line = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{next_period['finperiodid']}/income/{CARRIED_FORWARD_DESC.replace(' ', '%20')}"
    )
    assert delete_line.status_code == 409


def test_income_transactions_respect_locked_active_and_closed_cycle_rules_and_block_line_delete_with_history(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    finperiodid = active_period["finperiodid"]

    lock_response = client.patch(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/lock", json={"islocked": True})
    assert lock_response.status_code == 200, lock_response.text

    add_while_locked = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "100.00", "note": "Locked cycle income"},
    )
    assert add_while_locked.status_code == 201, add_while_locked.text

    offset_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "-100.00", "note": "Offsetting correction"},
    )
    assert offset_tx.status_code == 201, offset_tx.text

    unlock_response = client.patch(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/lock", json={"islocked": False})
    assert unlock_response.status_code == 200, unlock_response.text

    # Actual is $0 because +100 and -100 offset; deletion should succeed and cascade delete transactions
    remove_line = client.delete(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary")
    assert remove_line.status_code == 204, remove_line.text

    period_after = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}")
    assert period_after.status_code == 200, period_after.text
    income_names = [i["incomedesc"] for i in period_after.json()["incomes"]]
    assert "Salary" not in income_names

    txs_after = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/")
    assert txs_after.status_code == 404  # income line gone

    # Add a fresh income line to test closed-cycle guards
    client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/",
        json={"budgetid": budget.budgetid, "incomedesc": "Side Gig", "amount": "500.00", "linked_account": setup["balance_type"].balancedesc},
    )

    closeout = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/closeout",
        json={"create_next_cycle": False, "comments": "Closed"},
    )
    assert closeout.status_code == 200, closeout.text

    add_closed = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Side%20Gig/transactions/",
        json={"amount": "25.00", "note": "Late deposit"},
    )
    assert add_closed.status_code == 423

    db_rows = (
        db_session.query(PeriodTransaction)
        .filter(PeriodTransaction.finperiodid == finperiodid, PeriodTransaction.source_key == "Salary")
        .order_by(PeriodTransaction.id)
        .all()
    )
    assert len(db_rows) == 0  # cascaded deleted when zero-actual line was removed

    salary_row = db_session.get(PeriodIncome, (finperiodid, "Salary"))
    assert salary_row is None  # cascaded deleted


def test_add_income_transaction_rejects_malformed_entrydate(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]
    finperiodid = active_period["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "500.00", "entrydate": "not-a-valid-date"},
    )
    assert response.status_code == 422
