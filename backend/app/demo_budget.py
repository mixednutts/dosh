from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .cycle_constants import ACTIVE, CLOSED, PLANNED
from .cycle_management import close_cycle, ordered_budget_periods
from .models import BalanceType, Budget, ExpenseItem, IncomeType, InvestmentItem
from .routers.periods import generate_period
from .schemas import PeriodGenerateRequest
from .time_utils import app_now_naive
from .transaction_ledger import (
    PeriodTransactionContext,
    build_budget_adjustment_tx,
    build_expense_tx,
    build_income_tx,
    build_investment_tx,
    sync_period_state,
)


def _month_start(value):
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _create_demo_setup(db: Session) -> Budget:
    budget = Budget(
        budgetowner="Dosh Demo",
        description="Demo Household Budget",
        budget_frequency="Monthly",
        variance_mode="always",
        auto_add_surplus_to_investment=True,
        acceptable_expense_overrun_pct=8,
        comfortable_surplus_buffer_pct=6,
        maximum_deficit_amount=Decimal("250.00"),
        revision_sensitivity=45,
        savings_priority=70,
        period_criticality_bias=55,
        allow_cycle_lock=True,
        account_naming_preference="Everyday",
    )
    db.add(budget)
    db.flush()

    db.add_all([
        BalanceType(
            budgetid=budget.budgetid,
            balancedesc="Everyday Account",
            balance_type="Transaction",
            opening_balance=Decimal("3200.00"),
            active=True,
            is_primary=True,
        ),
        BalanceType(
            budgetid=budget.budgetid,
            balancedesc="Rainy Day Savings",
            balance_type="Savings",
            opening_balance=Decimal("1800.00"),
            active=True,
            is_primary=False,
        ),
        IncomeType(
            budgetid=budget.budgetid,
            incomedesc="Salary",
            issavings=False,
            isfixed=True,
            autoinclude=True,
            amount=Decimal("4200.00"),
            linked_account="Everyday Account",
        ),
        IncomeType(
            budgetid=budget.budgetid,
            incomedesc="Side Hustle",
            issavings=False,
            isfixed=True,
            autoinclude=True,
            amount=Decimal("450.00"),
            linked_account="Everyday Account",
        ),
        IncomeType(
            budgetid=budget.budgetid,
            incomedesc="Interest",
            issavings=True,
            isfixed=True,
            autoinclude=True,
            amount=Decimal("25.00"),
            linked_account="Rainy Day Savings",
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Rent",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("1850.00"),
            sort_order=0,
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Groceries",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("780.00"),
            sort_order=1,
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Utilities",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("260.00"),
            sort_order=2,
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Transport",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("210.00"),
            sort_order=3,
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Subscriptions",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("95.00"),
            sort_order=4,
        ),
        InvestmentItem(
            budgetid=budget.budgetid,
            investmentdesc="Emergency Fund",
            active=True,
            initial_value=Decimal("5400.00"),
            planned_amount=Decimal("550.00"),
            linked_account_desc="Rainy Day Savings",
            is_primary=True,
        ),
    ])
    db.flush()
    return budget


def _seed_period_activity(period, *, salary_amount: Decimal, side_hustle_amount: Decimal, interest_amount: Decimal,
                          groceries_amount: Decimal, utilities_amount: Decimal, transport_amount: Decimal,
                          subscriptions_amount: Decimal, investment_amount: Decimal, db: Session) -> None:
    salary_day = period.startdate + timedelta(days=1)
    side_hustle_day = period.startdate + timedelta(days=7)
    interest_day = period.enddate - timedelta(days=2)
    rent_day = period.startdate + timedelta(days=2)
    grocery_day = period.startdate + timedelta(days=10)
    utility_day = period.startdate + timedelta(days=14)
    transport_day = period.startdate + timedelta(days=18)
    subscription_day = period.startdate + timedelta(days=21)
    investment_day = period.enddate - timedelta(days=4)

    build_income_tx(period.finperiodid, period.budgetid, "Salary", salary_amount, db, note="Primary salary", entrydate=salary_day)
    build_income_tx(period.finperiodid, period.budgetid, "Side Hustle", side_hustle_amount, db, note="Freelance work", entrydate=side_hustle_day)
    build_income_tx(period.finperiodid, period.budgetid, "Interest", interest_amount, db, note="Savings interest", entrydate=interest_day)

    build_expense_tx(period.finperiodid, period.budgetid, "Rent", Decimal("1850.00"), db, note="Monthly rent", entrydate=rent_day)
    build_expense_tx(period.finperiodid, period.budgetid, "Groceries", groceries_amount, db, note="Supermarket shops", entrydate=grocery_day)
    build_expense_tx(period.finperiodid, period.budgetid, "Utilities", utilities_amount, db, note="Utilities bundle", entrydate=utility_day)
    build_expense_tx(period.finperiodid, period.budgetid, "Transport", transport_amount, db, note="Fuel and parking", entrydate=transport_day)
    build_expense_tx(period.finperiodid, period.budgetid, "Subscriptions", subscriptions_amount, db, note="Recurring services", entrydate=subscription_day)

    build_investment_tx(
        period.finperiodid,
        period.budgetid,
        "Emergency Fund",
        investment_amount,
        db,
        note="Auto surplus contribution",
        linked_incomedesc="Salary",
        entrydate=investment_day,
    )
    sync_period_state(period.finperiodid, db)


def _prepare_closeout_target(periods, target_index: int) -> None:
    for index, period in enumerate(periods):
        if index < target_index:
            period.cycle_status = CLOSED
        elif index == target_index:
            period.cycle_status = ACTIVE
        else:
            period.cycle_status = PLANNED


def _apply_current_period_health_pressure(period) -> None:
    expenses_by_desc = {expense.expensedesc: expense for expense in period.period_expenses}

    rent = expenses_by_desc.get("Rent")
    if rent:
        rent.status = "Paid"

    utilities = expenses_by_desc.get("Utilities")
    if utilities:
        utilities.status = "Paid"

    groceries = expenses_by_desc.get("Groceries")
    if groceries:
        groceries.status = "Revised"


def _add_demo_budget_adjustments(period, db: Session) -> None:
    income_by_desc = {income.incomedesc: income for income in period.period_incomes}
    expenses_by_desc = {expense.expensedesc: expense for expense in period.period_expenses}
    investments_by_desc = {investment.investmentdesc: investment for investment in period.period_investments}

    salary = income_by_desc.get("Salary")
    if salary:
        before_amount = Decimal(str(salary.budgetamount))
        after_amount = Decimal("4350.00")
        salary.budgetamount = after_amount
        build_budget_adjustment_tx(
            db,
            PeriodTransactionContext(
                finperiodid=period.finperiodid,
                budgetid=period.budgetid,
                source="income",
                tx_type="BUDGETADJ",
                source_key="Salary",
                budget_scope="current",
            ),
            note="Adjusted after an in-cycle pay review.",
            budget_before_amount=before_amount,
            budget_after_amount=after_amount,
        )

    subscriptions = expenses_by_desc.get("Subscriptions")
    if subscriptions:
        before_amount = Decimal(str(subscriptions.budgetamount))
        after_amount = Decimal("110.00")
        subscriptions.budgetamount = after_amount
        build_budget_adjustment_tx(
            db,
            PeriodTransactionContext(
                finperiodid=period.finperiodid,
                budgetid=period.budgetid,
                source="expense",
                tx_type="BUDGETADJ",
                source_key="Subscriptions",
                budget_scope="current",
            ),
            note="Streaming services increased during the current cycle.",
            budget_before_amount=before_amount,
            budget_after_amount=after_amount,
        )

    emergency_fund = investments_by_desc.get("Emergency Fund")
    if emergency_fund:
        before_amount = Decimal(str(emergency_fund.budgeted_amount))
        after_amount = Decimal("900.00")
        emergency_fund.budgeted_amount = after_amount
        build_budget_adjustment_tx(
            db,
            PeriodTransactionContext(
                finperiodid=period.finperiodid,
                budgetid=period.budgetid,
                source="investment",
                tx_type="BUDGETADJ",
                source_key="Emergency Fund",
                budget_scope="current",
            ),
            note="Savings target was lifted for the rest of the cycle.",
            budget_before_amount=before_amount,
            budget_after_amount=after_amount,
        )


def create_standard_demo_budget(db: Session) -> Budget:
    budget = _create_demo_setup(db)

    now = app_now_naive()
    startdate = _month_start(now).replace(month=_month_start(now).month, year=_month_start(now).year)
    for _ in range(3):
        startdate = (startdate.replace(day=1) - timedelta(days=1)).replace(day=1)

    generate_period(
        PeriodGenerateRequest(
            budgetid=budget.budgetid,
            startdate=startdate,
            count=7,
        ),
        db,
    )

    periods = ordered_budget_periods(budget.budgetid, db)
    historical_patterns = [
        {
            "salary_amount": Decimal("4200.00"),
            "side_hustle_amount": Decimal("320.00"),
            "interest_amount": Decimal("23.00"),
            "groceries_amount": Decimal("980.00"),
            "utilities_amount": Decimal("355.00"),
            "transport_amount": Decimal("295.00"),
            "subscriptions_amount": Decimal("95.00"),
            "investment_amount": Decimal("540.00"),
            "comments": "A pressured close-out. Groceries, utilities, and transport all ran high, which squeezed the month more than expected.",
            "goals": "Rebuild discipline on day-to-day spending and reduce avoidable cost drift next cycle.",
        },
        {
            "salary_amount": Decimal("4200.00"),
            "side_hustle_amount": Decimal("510.00"),
            "interest_amount": Decimal("24.00"),
            "groceries_amount": Decimal("860.00"),
            "utilities_amount": Decimal("300.00"),
            "transport_amount": Decimal("245.00"),
            "subscriptions_amount": Decimal("95.00"),
            "investment_amount": Decimal("610.00"),
            "comments": "Still a little untidy, but better than the prior month. Extra side income helped absorb some of the overrun.",
            "goals": "Keep tightening grocery and utility spend while protecting savings momentum.",
        },
        {
            "salary_amount": Decimal("4200.00"),
            "side_hustle_amount": Decimal("380.00"),
            "interest_amount": Decimal("25.00"),
            "groceries_amount": Decimal("760.00"),
            "utilities_amount": Decimal("255.00"),
            "transport_amount": Decimal("205.00"),
            "subscriptions_amount": Decimal("95.00"),
            "investment_amount": Decimal("565.00"),
            "comments": "The month closed in a steadier place, with spending much closer to plan and healthier carry-through into the next cycle.",
            "goals": "Hold the line on everyday costs and keep recovery momentum visible.",
        },
    ]
    current_pattern = {
        "salary_amount": Decimal("4200.00"),
        "side_hustle_amount": Decimal("140.00"),
        "interest_amount": Decimal("0.00"),
        "groceries_amount": Decimal("960.00"),
        "utilities_amount": Decimal("320.00"),
        "transport_amount": Decimal("210.00"),
        "subscriptions_amount": Decimal("95.00"),
        "investment_amount": Decimal("1200.00"),
    }

    for period, pattern in zip(periods[:3], historical_patterns):
        _seed_period_activity(period, db=db, **{k: v for k, v in pattern.items() if k not in {"comments", "goals"}})

    _seed_period_activity(periods[3], db=db, **current_pattern)
    _apply_current_period_health_pressure(periods[3])
    _add_demo_budget_adjustments(periods[3], db)
    sync_period_state(periods[3].finperiodid, db)

    for target_index, pattern in enumerate(historical_patterns):
        _prepare_closeout_target(periods, target_index)
        close_cycle(
            periods[target_index],
            budget,
            pattern["comments"],
            pattern["goals"],
            False,
            db,
        )
        db.flush()

    db.commit()
    db.refresh(budget)
    return budget
