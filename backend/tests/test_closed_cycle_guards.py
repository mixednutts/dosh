from __future__ import annotations

from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_closed_cycle_rejects_common_write_paths(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")

    closeout = client.post(
        f"/api/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "comments": "Lock it down"},
    )
    assert closeout.status_code == 200, closeout.text

    closed_period_id = active_period["finperiodid"]

    income_update = client.patch(
        f"/api/periods/{closed_period_id}/income/Salary",
        json={"actualamount": "100.00"},
    )
    assert income_update.status_code == 423
    assert "closed" in income_update.json()["detail"].lower()

    expense_budget_update = client.patch(
        f"/api/periods/{closed_period_id}/expense/Rent/budget",
        json={"budgetamount": "1250.00", "scope": "current", "note": "Should not be editable"},
    )
    assert expense_budget_update.status_code == 423

    expense_entry = client.post(
        f"/api/periods/{closed_period_id}/expenses/Rent/entries/",
        json={"amount": "50.00", "note": "Late addition"},
    )
    assert expense_entry.status_code == 423

    investment_tx = client.post(
        f"/api/periods/{closed_period_id}/investments/Emergency%20Fund/transactions/",
        json={"amount": "25.00", "note": "Late addition"},
    )
    assert investment_tx.status_code == 423

    unlock = client.patch(
        f"/api/periods/{closed_period_id}/lock",
        json={"islocked": False},
    )
    assert unlock.status_code == 423
    assert "cannot be unlocked" in unlock.json()["detail"].lower()

    delete_options = client.get(f"/api/periods/{closed_period_id}/delete-options")
    assert delete_options.status_code == 200, delete_options.text
    options_payload = delete_options.json()
    assert options_payload["can_delete_single"] is False
    assert options_payload["can_delete_future_chain"] is False
    assert "closed cycles cannot be deleted" in options_payload["delete_reason"].lower()

    delete_response = client.delete(f"/api/periods/{closed_period_id}?delete_mode=single")
    assert delete_response.status_code == 423
