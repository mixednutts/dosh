from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .cycle_constants import ACTIVE, CLOSED, PLANNED
from .cycle_management import assign_period_lifecycle_states, close_cycle, ordered_budget_periods
from .models import BalanceType, Budget, ExpenseItem, IncomeType, InvestmentItem, PeriodIncome
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
        auto_expense_enabled=True,
        auto_expense_offset_days=0,
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
            autoinclude=True,
            amount=Decimal("4200.00"),
            linked_account="Everyday Account",
        ),
        IncomeType(
            budgetid=budget.budgetid,
            incomedesc="Side Hustle",
            issavings=False,
            autoinclude=True,
            amount=Decimal("450.00"),
            linked_account="Everyday Account",
        ),
        IncomeType(
            budgetid=budget.budgetid,
            incomedesc="Interest",
            issavings=True,
            autoinclude=True,
            amount=Decimal("25.00"),
            linked_account="Rainy Day Savings",
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Rent",
            active=True,
            freqtype="Fixed Day of Month",
            frequency_value=1,
            paytype="AUTO",
            revisionnum=0,
            expenseamount=Decimal("1850.00"),
            sort_order=0,
            default_account_desc="Everyday Account",
            effectivedate=datetime(2020, 1, 1),
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Groceries",
            active=True,
            freqtype="Every N Days",
            frequency_value=7,
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("140.00"),
            sort_order=1,
            default_account_desc="Everyday Account",
            effectivedate=datetime(2020, 1, 1),
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Utilities",
            active=True,
            freqtype="Fixed Day of Month",
            frequency_value=15,
            paytype="AUTO",
            revisionnum=0,
            expenseamount=Decimal("240.00"),
            sort_order=2,
            default_account_desc="Everyday Account",
            effectivedate=datetime(2020, 1, 1),
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Transport",
            active=True,
            freqtype="Always",
            paytype="MANUAL",
            revisionnum=0,
            expenseamount=Decimal("200.00"),
            sort_order=3,
            default_account_desc="Everyday Account",
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Subscriptions",
            active=True,
            freqtype="Fixed Day of Month",
            frequency_value=3,
            paytype="AUTO",
            revisionnum=0,
            expenseamount=Decimal("85.00"),
            sort_order=4,
            default_account_desc="Everyday Account",
            effectivedate=datetime(2020, 1, 1),
        ),
        ExpenseItem(
            budgetid=budget.budgetid,
            expensedesc="Phone & Internet",
            active=True,
            freqtype="Fixed Day of Month",
            frequency_value=20,
            paytype="AUTO",
            revisionnum=0,
            expenseamount=Decimal("75.00"),
            sort_order=5,
            default_account_desc="Everyday Account",
            effectivedate=datetime(2020, 1, 1),
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
                          rent_amount: Decimal, groceries_amount: Decimal, utilities_amount: Decimal,
                          transport_amount: Decimal, subscriptions_amount: Decimal, phone_internet_amount: Decimal,
                          investment_amount: Decimal, db: Session) -> None:
    salary_day = period.startdate + timedelta(days=1)
    side_hustle_day = period.startdate + timedelta(days=7)
    interest_day = period.enddate - timedelta(days=2)
    rent_day = period.startdate + timedelta(days=1)
    grocery_day = period.startdate + timedelta(days=5)
    utility_day = period.startdate + timedelta(days=14)
    transport_day = period.startdate + timedelta(days=10)
    subscription_day = period.startdate + timedelta(days=3)
    phone_internet_day = period.startdate + timedelta(days=20)
    investment_day = period.enddate - timedelta(days=4)

    build_income_tx(period.finperiodid, period.budgetid, "Salary", salary_amount, db, note="Primary salary", entrydate=salary_day)
    build_income_tx(period.finperiodid, period.budgetid, "Side Hustle", side_hustle_amount, db, note="Freelance work", entrydate=side_hustle_day)
    build_income_tx(period.finperiodid, period.budgetid, "Interest", interest_amount, db, note="Savings interest", entrydate=interest_day)

    build_expense_tx(period.finperiodid, period.budgetid, "Rent", rent_amount, db, note="Monthly rent", entrydate=rent_day, account_desc="Everyday Account")
    build_expense_tx(period.finperiodid, period.budgetid, "Groceries", groceries_amount, db, note="Supermarket shops", entrydate=grocery_day, account_desc="Everyday Account")
    build_expense_tx(period.finperiodid, period.budgetid, "Utilities", utilities_amount, db, note="Utilities bundle", entrydate=utility_day, account_desc="Everyday Account")
    build_expense_tx(period.finperiodid, period.budgetid, "Transport", transport_amount, db, note="Fuel and parking", entrydate=transport_day, account_desc="Everyday Account")
    build_expense_tx(period.finperiodid, period.budgetid, "Subscriptions", subscriptions_amount, db, note="Recurring services", entrydate=subscription_day, account_desc="Everyday Account")
    build_expense_tx(period.finperiodid, period.budgetid, "Phone & Internet", phone_internet_amount, db, note="Monthly connectivity", entrydate=phone_internet_day, account_desc="Everyday Account")

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


def _add_demo_transfer_line(period, db: Session, *, amount: Decimal, note: str, day_offset: int) -> None:
    transfer_desc = "Transfer from Rainy Day Savings"
    transfer_line = db.get(PeriodIncome, (period.finperiodid, transfer_desc))
    if transfer_line is None:
        transfer_line = PeriodIncome(
            finperiodid=period.finperiodid,
            budgetid=period.budgetid,
            incomedesc=transfer_desc,
            budgetamount=amount,
            actualamount=Decimal("0.00"),
            varianceamount=Decimal("0.00") - amount,
            revision_snapshot=0,
        )
        db.add(transfer_line)
    else:
        transfer_line.budgetamount = amount

    build_income_tx(
        period.finperiodid,
        period.budgetid,
        transfer_desc,
        amount,
        db,
        note=note,
        entrydate=period.startdate + timedelta(days=day_offset),
    )


def _add_demo_transaction_edge_cases(period, db: Session) -> None:
    build_expense_tx(
        period.finperiodid,
        period.budgetid,
        "Groceries",
        Decimal("-42.00"),
        db,
        note="Refund for overcharged grocery items",
        entrydate=period.startdate + timedelta(days=12),
    )
    build_income_tx(
        period.finperiodid,
        period.budgetid,
        "Side Hustle",
        Decimal("-60.00"),
        db,
        note="Client correction on an earlier invoice",
        entrydate=period.startdate + timedelta(days=16),
    )
    build_investment_tx(
        period.finperiodid,
        period.budgetid,
        "Emergency Fund",
        Decimal("-75.00"),
        db,
        note="Brokerage fee and valuation correction",
        entrydate=period.startdate + timedelta(days=24),
    )


def _add_pending_closure_adjustments(period, db: Session) -> None:
    expenses_by_desc = {expense.expensedesc: expense for expense in period.period_expenses}
    investments_by_desc = {investment.investmentdesc: investment for investment in period.period_investments}

    groceries = expenses_by_desc.get("Groceries")
    if groceries:
        before_amount = Decimal(str(groceries.budgetamount))
        after_amount = Decimal("845.00")
        groceries.budgetamount = after_amount
        build_budget_adjustment_tx(
            db,
            PeriodTransactionContext(
                finperiodid=period.finperiodid,
                budgetid=period.budgetid,
                source="expense",
                tx_type="BUDGETADJ",
                source_key="Groceries",
                budget_scope="current",
            ),
            note="Food costs were reforecast after a late-month reset.",
            budget_before_amount=before_amount,
            budget_after_amount=after_amount,
        )

    emergency_fund = investments_by_desc.get("Emergency Fund")
    if emergency_fund:
        before_amount = Decimal(str(emergency_fund.budgeted_amount))
        after_amount = Decimal("700.00")
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
            note="Savings target was eased after catching up overdue spending.",
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
    closed_pattern = {
        "salary_amount": Decimal("4200.00"),
        "side_hustle_amount": Decimal("320.00"),
        "interest_amount": Decimal("23.00"),
        "rent_amount": Decimal("1850.00"),
        "groceries_amount": Decimal("720.00"),
        "utilities_amount": Decimal("295.00"),
        "transport_amount": Decimal("245.00"),
        "subscriptions_amount": Decimal("85.00"),
        "phone_internet_amount": Decimal("75.00"),
        "investment_amount": Decimal("540.00"),
        "comments": "A pressured close-out. Groceries, utilities, and transport all ran high, which squeezed the month more than expected.",
        "goals": "Rebuild discipline on day-to-day spending and reduce avoidable cost drift next cycle.",
    }
    pending_patterns = [
        {
            "salary_amount": Decimal("4200.00"),
            "side_hustle_amount": Decimal("510.00"),
            "interest_amount": Decimal("24.00"),
            "rent_amount": Decimal("1850.00"),
            "groceries_amount": Decimal("680.00"),
            "utilities_amount": Decimal("265.00"),
            "transport_amount": Decimal("225.00"),
            "subscriptions_amount": Decimal("85.00"),
            "phone_internet_amount": Decimal("75.00"),
            "investment_amount": Decimal("610.00"),
            "comments": "Still a little untidy, but better than the prior month. Extra side income helped absorb some of the overrun.",
            "goals": "Keep tightening grocery and utility spend while protecting savings momentum.",
        },
        {
            "salary_amount": Decimal("4200.00"),
            "side_hustle_amount": Decimal("380.00"),
            "interest_amount": Decimal("25.00"),
            "rent_amount": Decimal("1850.00"),
            "groceries_amount": Decimal("620.00"),
            "utilities_amount": Decimal("235.00"),
            "transport_amount": Decimal("195.00"),
            "subscriptions_amount": Decimal("85.00"),
            "phone_internet_amount": Decimal("75.00"),
            "investment_amount": Decimal("565.00"),
            "comments": "The month closed in a steadier place, with spending much closer to plan and healthier carry-through into the next cycle.",
            "goals": "Hold the line on everyday costs and keep recovery momentum visible.",
        },
    ]
    current_pattern = {
        "salary_amount": Decimal("4200.00"),
        "side_hustle_amount": Decimal("140.00"),
        "interest_amount": Decimal("0.00"),
        "rent_amount": Decimal("1850.00"),
        "groceries_amount": Decimal("580.00"),
        "utilities_amount": Decimal("240.00"),
        "transport_amount": Decimal("180.00"),
        "subscriptions_amount": Decimal("85.00"),
        "phone_internet_amount": Decimal("75.00"),
        "investment_amount": Decimal("1200.00"),
    }

    _seed_period_activity(periods[0], db=db, **{k: v for k, v in closed_pattern.items() if k not in {"comments", "goals"}})
    for period, pattern in zip(periods[1:3], pending_patterns):
        _seed_period_activity(period, db=db, **{k: v for k, v in pattern.items() if k not in {"comments", "goals"}})
    _seed_period_activity(periods[3], db=db, **current_pattern)

    _add_demo_transfer_line(
        periods[1],
        db,
        amount=Decimal("250.00"),
        note="Buffer top-up from savings after a tighter month.",
        day_offset=5,
    )
    _add_pending_closure_adjustments(periods[1], db)
    _add_demo_transaction_edge_cases(periods[1], db)
    sync_period_state(periods[1].finperiodid, db)

    _add_demo_transfer_line(
        periods[2],
        db,
        amount=Decimal("180.00"),
        note="Short-term transfer while close-out is still outstanding.",
        day_offset=6,
    )
    _add_demo_transaction_edge_cases(periods[2], db)
    sync_period_state(periods[2].finperiodid, db)

    _apply_current_period_health_pressure(periods[3])
    _add_demo_budget_adjustments(periods[3], db)
    _add_demo_transfer_line(
        periods[3],
        db,
        amount=Decimal("120.00"),
        note="Transfer from savings to smooth a high-spend week.",
        day_offset=9,
    )
    _add_demo_transaction_edge_cases(periods[3], db)
    sync_period_state(periods[3].finperiodid, db)

    _prepare_closeout_target(periods, 0)
    close_cycle(
        periods[0],
        budget,
        closed_pattern["comments"],
        closed_pattern["goals"],
        False,
        db,
    )
    assign_period_lifecycle_states(budget.budgetid, db)
    db.flush()

    db.commit()
    db.refresh(budget)
    return budget
