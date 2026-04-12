from datetime import datetime as dt, timezone
from sqlalchemy import (
    Boolean, Column, DateTime as _DateTime, ForeignKey, ForeignKeyConstraint, Integer,
    Numeric, String, Text, UniqueConstraint, func, TypeDecorator,
)
from sqlalchemy.orm import relationship
from .database import Base


class UTCDateTime(TypeDecorator):
    """DateTime type that ensures UTC timezone on load (for SQLite compatibility)."""
    impl = _DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        # SQLite strips timezone - add it back
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

class Budget(Base):
    __tablename__ = "budgets"

    budgetid = Column(Integer, primary_key=True, autoincrement=True)
    budgetowner = Column(String, nullable=False)
    description = Column(String)
    # Weekly | Fortnightly | Monthly
    budget_frequency = Column(String, nullable=False)
    # always | overspend_only
    variance_mode = Column(String, nullable=False, default="always")
    auto_add_surplus_to_investment = Column(Boolean, nullable=False, default=False)
    acceptable_expense_overrun_pct = Column(Integer, nullable=False, default=10)
    comfortable_surplus_buffer_pct = Column(Integer, nullable=False, default=5)
    maximum_deficit_amount = Column(Numeric(10, 2), nullable=True)
    revision_sensitivity = Column(Integer, nullable=False, default=50)
    savings_priority = Column(Integer, nullable=False, default=50)
    period_criticality_bias = Column(Integer, nullable=False, default=50)
    allow_cycle_lock = Column(Boolean, nullable=False, default=True)
    account_naming_preference = Column(String, nullable=False, default="Transaction")
    locale = Column(String, nullable=False, default="en-AU")
    currency = Column(String, nullable=False, default="AUD")
    timezone = Column(String, nullable=False, default="Australia/Sydney")
    date_format = Column(String, nullable=False, default="medium")
    auto_expense_enabled = Column(Boolean, nullable=False, default=False)
    auto_expense_offset_days = Column(Integer, nullable=False, default=0)
    record_line_status_changes = Column(Boolean, nullable=False, default=False)

    periods = relationship("FinancialPeriod", back_populates="budget", cascade="all, delete-orphan")
    income_types = relationship("IncomeType", back_populates="budget", cascade="all, delete-orphan")
    expense_items = relationship("ExpenseItem", back_populates="budget", cascade="all, delete-orphan")
    investment_items = relationship("InvestmentItem", back_populates="budget", cascade="all, delete-orphan")
    balance_types = relationship("BalanceType", back_populates="budget", cascade="all, delete-orphan")
    setup_revision_events = relationship("SetupRevisionEvent", back_populates="budget", cascade="all, delete-orphan")


class PayType(Base):
    __tablename__ = "paytypes"

    # AUTO | MANUAL
    paytype = Column(String, primary_key=True)


class FinancialPeriod(Base):
    __tablename__ = "financialperiods"

    finperiodid = Column(Integer, primary_key=True, autoincrement=True)
    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), nullable=False)
    startdate = Column(UTCDateTime, nullable=False)
    enddate = Column(UTCDateTime, nullable=False)
    budgetowner = Column(String)
    islocked = Column(Boolean, default=False, nullable=False)
    cycle_status = Column(String, nullable=False, default="PLANNED")
    closed_at = Column(UTCDateTime, nullable=True)

    budget = relationship("Budget", back_populates="periods")
    period_incomes = relationship("PeriodIncome", back_populates="period", cascade="all, delete-orphan")
    period_expenses = relationship("PeriodExpense", back_populates="period", cascade="all, delete-orphan")
    period_balances = relationship("PeriodBalance", back_populates="period", cascade="all, delete-orphan")
    period_investments = relationship("PeriodInvestment", back_populates="period", cascade="all, delete-orphan")
    period_transactions = relationship("PeriodTransaction", back_populates="period", cascade="all, delete-orphan")
    closeout_snapshot = relationship("PeriodCloseoutSnapshot", back_populates="period", uselist=False, cascade="all, delete-orphan")

    @property
    def cycle_stage(self) -> str:
        from .cycle_management import cycle_stage

        return cycle_stage(self)


class IncomeType(Base):
    __tablename__ = "incometypes"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    incomedesc = Column(String, primary_key=True)
    issavings = Column(Boolean, default=False, nullable=False)
    autoinclude = Column(Boolean, default=True, nullable=False)
    amount = Column(Numeric(10, 2), default=0)
    linked_account = Column(String, nullable=True)
    revisionnum = Column(Integer, default=0, nullable=False)

    budget = relationship("Budget", back_populates="income_types")


class PeriodIncome(Base):
    __tablename__ = "periodincome"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    budgetid = Column(Integer, nullable=False)
    incomedesc = Column(String, primary_key=True)
    budgetamount = Column(Numeric(10, 2), default=0)
    actualamount = Column(Numeric(10, 2), default=0)
    varianceamount = Column(Numeric(10, 2), default=0)
    is_system = Column(Boolean, nullable=False, default=False)
    system_key = Column(String, nullable=True)
    revision_snapshot = Column(Integer, default=0, nullable=False)
    # Current | Paid | Revised
    status = Column(String, default='Current', nullable=False)
    revision_comment = Column(String, nullable=True)

    period = relationship("FinancialPeriod", back_populates="period_incomes")


class ExpenseItem(Base):
    __tablename__ = "expenseitems"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    expensedesc = Column(String, primary_key=True)
    active = Column(Boolean, default=True, nullable=False)
    freqtype = Column(String)
    frequency_value = Column(Integer)
    paytype = Column(String, ForeignKey("paytypes.paytype"))
    revisionnum = Column(Integer, default=0, nullable=False)
    effectivedate = Column(UTCDateTime)
    expenseamount = Column(Numeric(10, 2), default=0)
    sort_order = Column(Integer, default=0, nullable=False)
    default_account_desc = Column(String, nullable=True)

    budget = relationship("Budget", back_populates="expense_items")
    period_expenses = relationship("PeriodExpense", back_populates="expense_item")


class PeriodExpense(Base):
    __tablename__ = "periodexpenses"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    budgetid = Column(Integer, primary_key=True)
    expensedesc = Column(String, primary_key=True)
    budgetamount = Column(Numeric(10, 2), default=0)
    # actualamount is kept in sync with SUM of periodexpense_transactions
    actualamount = Column(Numeric(10, 2), default=0)
    varianceamount = Column(Numeric(10, 2), default=0)
    is_oneoff = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    # snapshot of revisionnum at time of period generation — identifies historical revision
    revision_snapshot = Column(Integer, default=0, nullable=False)
    # Current | Paid | Revised
    status = Column(String, default='Current', nullable=False)
    revision_comment = Column(String, nullable=True)

    period = relationship("FinancialPeriod", back_populates="period_expenses")
    expense_item = relationship(
        "ExpenseItem",
        primaryjoin="and_(PeriodExpense.budgetid == ExpenseItem.budgetid, "
                    "PeriodExpense.expensedesc == ExpenseItem.expensedesc)",
        foreign_keys="[PeriodExpense.budgetid, PeriodExpense.expensedesc]",
        back_populates="period_expenses",
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["budgetid", "expensedesc"],
            ["expenseitems.budgetid", "expenseitems.expensedesc"],
        ),
    )


class BalanceType(Base):
    """Account balance definitions per budget (bank, savings, cash, etc.)."""
    __tablename__ = "balancetypes"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    balancedesc = Column(String, primary_key=True)
    balance_type = Column(String)
    opening_balance = Column(Numeric(10, 2), default=0)
    active = Column(Boolean, default=True, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)

    budget = relationship("Budget", back_populates="balance_types")
    period_balances = relationship("PeriodBalance", back_populates="balance_type_rel")


class PeriodBalance(Base):
    """Opening/closing balance snapshot per period per account."""
    __tablename__ = "periodbalances"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    budgetid = Column(Integer, nullable=False)
    balancedesc = Column(String, primary_key=True)
    opening_amount = Column(Numeric(10, 2), default=0)
    closing_amount = Column(Numeric(10, 2), default=0)

    # movement tracked; closing = opening + movement
    movement_amount = Column(Numeric(10, 2), default=0)

    period = relationship("FinancialPeriod", back_populates="period_balances")
    balance_type_rel = relationship(
        "BalanceType",
        primaryjoin="and_(PeriodBalance.budgetid == BalanceType.budgetid, "
                    "PeriodBalance.balancedesc == BalanceType.balancedesc)",
        foreign_keys="[PeriodBalance.budgetid, PeriodBalance.balancedesc]",
        back_populates="period_balances",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["budgetid", "balancedesc"],
            ["balancetypes.budgetid", "balancetypes.balancedesc"],
        ),
    )


class InvestmentItem(Base):
    __tablename__ = "investmentitems"

    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), primary_key=True)
    investmentdesc = Column(String, primary_key=True)
    active = Column(Boolean, default=True, nullable=False)
    effectivedate = Column(UTCDateTime)
    initial_value = Column(Numeric(10, 2), default=0)
    planned_amount = Column(Numeric(10, 2), default=0)
    # optional link to an account balance (contributions credited to that account)
    linked_account_desc = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    revisionnum = Column(Integer, default=0, nullable=False)

    budget = relationship("Budget", back_populates="investment_items")
    period_investments = relationship("PeriodInvestment", back_populates="investment_item")


class PeriodInvestment(Base):
    """Per-period investment value tracking."""
    __tablename__ = "periodinvestments"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    budgetid = Column(Integer, nullable=False)
    investmentdesc = Column(String, primary_key=True)
    # opening = prev period closing, or initial_value if first period
    opening_value = Column(Numeric(10, 2), default=0)
    # closing synced from opening + sum(transactions)
    closing_value = Column(Numeric(10, 2), default=0)
    # budget/actual tracking (like expense items)
    budgeted_amount = Column(Numeric(10, 2), default=0)
    actualamount = Column(Numeric(10, 2), default=0)
    revision_snapshot = Column(Integer, default=0, nullable=False)
    status = Column(String, default='Current', nullable=False)
    revision_comment = Column(String, nullable=True)

    period = relationship("FinancialPeriod", back_populates="period_investments")
    investment_item = relationship(
        "InvestmentItem",
        primaryjoin="and_(PeriodInvestment.budgetid == InvestmentItem.budgetid, "
                    "PeriodInvestment.investmentdesc == InvestmentItem.investmentdesc)",
        foreign_keys="[PeriodInvestment.budgetid, PeriodInvestment.investmentdesc]",
        back_populates="period_investments",
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["budgetid", "investmentdesc"],
            ["investmentitems.budgetid", "investmentitems.investmentdesc"],
        ),
    )


class PeriodTransaction(Base):
    __tablename__ = "periodtransactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), nullable=False)
    budgetid = Column(Integer, nullable=False)
    source = Column(String, nullable=False)
    type = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    note = Column(String, nullable=True)
    entrydate = Column(UTCDateTime, default=lambda: dt.now(timezone.utc), nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    system_reason = Column(String, nullable=True)
    source_key = Column(String, nullable=True)
    source_label = Column(String, nullable=True)
    affected_account_desc = Column(String, nullable=True)
    related_account_desc = Column(String, nullable=True)
    linked_incomedesc = Column(String, nullable=True)
    legacy_table = Column(String, nullable=True)
    legacy_id = Column(Integer, nullable=True)
    dedupe_key = Column(String, nullable=True)
    entry_kind = Column(String, nullable=False, default="movement")
    line_status = Column(String, nullable=True)
    budget_scope = Column(String, nullable=True)
    budget_before_amount = Column(Numeric(10, 2), nullable=True)
    budget_after_amount = Column(Numeric(10, 2), nullable=True)
    revisionnum = Column(Integer, nullable=True)

    period = relationship("FinancialPeriod", back_populates="period_transactions")

    __table_args__ = (
        UniqueConstraint("legacy_table", "legacy_id", name="uq_periodtransactions_legacy"),
        UniqueConstraint("dedupe_key", name="uq_periodtransactions_dedupe"),
    )


class PeriodCloseoutSnapshot(Base):
    __tablename__ = "periodcloseouts"

    finperiodid = Column(Integer, ForeignKey("financialperiods.finperiodid"), primary_key=True)
    comments = Column(Text, nullable=True)
    goals = Column(Text, nullable=True)
    carry_forward_amount = Column(Numeric(10, 2), nullable=False, default=0)
    health_snapshot_json = Column(Text, nullable=False, default="{}")
    totals_snapshot_json = Column(Text, nullable=False, default="{}")
    created_at = Column(UTCDateTime, default=lambda: dt.now(timezone.utc), nullable=False)

    period = relationship("FinancialPeriod", back_populates="closeout_snapshot")


class SetupRevisionEvent(Base):
    __tablename__ = "setuprevisionevents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    budgetid = Column(Integer, ForeignKey("budgets.budgetid"), nullable=False)
    category = Column(String, nullable=False)
    item_desc = Column(String, nullable=False)
    revisionnum = Column(Integer, nullable=False)
    changed_fields_json = Column(Text, nullable=False, default="[]")
    created_at = Column(UTCDateTime, default=lambda: dt.now(timezone.utc), nullable=False)

    budget = relationship("Budget", back_populates="setup_revision_events")


