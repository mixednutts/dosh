from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator


# ── PayType ──────────────────────────────────────────────────────────────────

class PayTypeOut(BaseModel):
    paytype: str
    model_config = {"from_attributes": True}


# ── Budget ───────────────────────────────────────────────────────────────────

class BudgetBase(BaseModel):
    budgetowner: str
    description: Optional[str] = None
    budget_frequency: str  # Weekly | Fortnightly | Monthly

    @field_validator("budget_frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        allowed = {"Weekly", "Fortnightly", "Monthly"}
        if v not in allowed:
            raise ValueError(f"budget_frequency must be one of {allowed}")
        return v


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    budgetowner: Optional[str] = None
    description: Optional[str] = None
    budget_frequency: Optional[str] = None
    variance_mode: Optional[str] = None
    auto_add_surplus_to_investment: Optional[bool] = None


class BudgetOut(BudgetBase):
    budgetid: int
    variance_mode: str = "always"
    auto_add_surplus_to_investment: bool = False
    model_config = {"from_attributes": True}


# ── IncomeType ────────────────────────────────────────────────────────────────

class IncomeTypeBase(BaseModel):
    incomedesc: str
    issavings: bool = False
    isfixed: bool = False
    autoinclude: bool = False
    amount: Decimal = Decimal("0.00")
    linked_account: Optional[str] = None

    @model_validator(mode="after")
    def auto_set_autoinclude(self) -> "IncomeTypeBase":
        if self.isfixed:
            self.autoinclude = True
        return self


class IncomeTypeCreate(IncomeTypeBase):
    pass


class IncomeTypeUpdate(BaseModel):
    issavings: Optional[bool] = None
    isfixed: Optional[bool] = None
    autoinclude: Optional[bool] = None
    amount: Optional[Decimal] = None
    linked_account: Optional[str] = None


class IncomeTypeOut(IncomeTypeBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── ExpenseItem ───────────────────────────────────────────────────────────────

class ExpenseItemBase(BaseModel):
    expensedesc: str
    active: bool = True
    freqtype: Optional[str] = None
    frequency_value: Optional[int] = None
    paytype: Optional[str] = None
    effectivedate: Optional[datetime] = None
    expenseamount: Decimal = Decimal("0.00")
    sort_order: int = 0

    @field_validator("freqtype")
    @classmethod
    def validate_freqtype(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"Always", "Fixed Day of Month", "Every N Days"}:
            raise ValueError("freqtype must be 'Always', 'Fixed Day of Month', or 'Every N Days'")
        return v

    @field_validator("paytype")
    @classmethod
    def validate_paytype(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"AUTO", "MANUAL"}:
            raise ValueError("paytype must be 'AUTO' or 'MANUAL'")
        return v


class ExpenseItemCreate(ExpenseItemBase):
    pass


class ExpenseItemUpdate(BaseModel):
    active: Optional[bool] = None
    freqtype: Optional[str] = None
    frequency_value: Optional[int] = None
    paytype: Optional[str] = None
    effectivedate: Optional[datetime] = None
    expenseamount: Optional[Decimal] = None
    sort_order: Optional[int] = None
    bump_revision: bool = False


class ExpenseItemOut(ExpenseItemBase):
    budgetid: int
    revisionnum: int
    model_config = {"from_attributes": True}


class ExpenseReorderItem(BaseModel):
    expensedesc: str
    sort_order: int


class PeriodExpenseReorderRequest(BaseModel):
    items: list[ExpenseReorderItem]


class ExpenseItemReorderRequest(BaseModel):
    items: list[ExpenseReorderItem]


# ── FinancialPeriod ───────────────────────────────────────────────────────────

class PeriodGenerateRequest(BaseModel):
    budgetid: int
    startdate: datetime
    count: int = 1


class PeriodOut(BaseModel):
    finperiodid: int
    budgetid: int
    startdate: datetime
    enddate: datetime
    budgetowner: Optional[str] = None
    islocked: bool
    model_config = {"from_attributes": True}


class PeriodLockRequest(BaseModel):
    islocked: bool


class PeriodSummaryOut(BaseModel):
    period: PeriodOut
    period_status: str
    income_budget: Decimal = Decimal("0")
    income_actual: Decimal = Decimal("0")
    expense_budget: Decimal = Decimal("0")
    expense_actual: Decimal = Decimal("0")
    investment_budget: Decimal = Decimal("0")
    investment_actual: Decimal = Decimal("0")
    surplus_budget: Decimal = Decimal("0")
    surplus_actual: Decimal = Decimal("0")
    projected_savings: Decimal = Decimal("0")
    can_delete: bool = False


# ── PeriodIncome ──────────────────────────────────────────────────────────────

class PeriodIncomeOut(BaseModel):
    finperiodid: int
    budgetid: int
    incomedesc: str
    budgetamount: Decimal
    actualamount: Decimal
    varianceamount: Decimal
    model_config = {"from_attributes": True}


class PeriodIncomeActualUpdate(BaseModel):
    actualamount: Decimal


# ── PeriodExpense ─────────────────────────────────────────────────────────────

class PeriodExpenseOut(BaseModel):
    finperiodid: int
    budgetid: int
    expensedesc: str
    budgetamount: Decimal
    actualamount: Decimal
    varianceamount: Decimal = Decimal("0")
    is_oneoff: bool
    sort_order: int = 0
    revision_snapshot: int = 0
    status: str = 'Current'
    # computed: budgetamount - actualamount (0 when Paid)
    remaining_amount: Decimal = Decimal("0")
    freqtype: Optional[str] = None
    frequency_value: Optional[int] = None
    paytype: Optional[str] = None
    effectivedate: Optional[datetime] = None
    note: Optional[str] = None
    revision_comment: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodExpenseNoteUpdate(BaseModel):
    note: Optional[str] = None


class PeriodExpenseStatusUpdate(BaseModel):
    status: str
    revision_comment: Optional[str] = None


class PeriodExpenseBudgetUpdate(BaseModel):
    budgetamount: Decimal


class PeriodExpenseActualUpdate(BaseModel):
    actualamount: Decimal


class AddExpenseToPeriodRequest(BaseModel):
    budgetid: int
    expensedesc: str
    budgetamount: Decimal
    scope: str

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        if v not in {"oneoff", "future"}:
            raise ValueError("scope must be 'oneoff' or 'future'")
        return v


class AddIncomeToPeriodRequest(BaseModel):
    budgetid: int
    incomedesc: str
    budgetamount: Decimal
    scope: str

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        if v not in {"oneoff", "future"}:
            raise ValueError("scope must be 'oneoff' or 'future'")
        return v


class SavingsTransferRequest(BaseModel):
    budgetid: int
    balancedesc: str
    amount: Decimal


class PeriodExpenseAddActual(BaseModel):
    amount: Decimal


class PeriodIncomeAddActual(BaseModel):
    amount: Decimal


# ── InvestmentItem ────────────────────────────────────────────────────────────

class InvestmentItemBase(BaseModel):
    investmentdesc: str
    active: bool = True
    effectivedate: Optional[datetime] = None
    initial_value: Decimal = Decimal("0.00")
    linked_account_desc: Optional[str] = None
    is_primary: bool = False


class InvestmentItemCreate(InvestmentItemBase):
    pass


class InvestmentItemUpdate(BaseModel):
    active: Optional[bool] = None
    effectivedate: Optional[datetime] = None
    initial_value: Optional[Decimal] = None
    linked_account_desc: Optional[str] = None
    is_primary: Optional[bool] = None


class InvestmentItemOut(InvestmentItemBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── PeriodInvestment ──────────────────────────────────────────────────────────

class PeriodInvestmentOut(BaseModel):
    finperiodid: int
    budgetid: int
    investmentdesc: str
    opening_value: Decimal
    closing_value: Decimal
    budgeted_amount: Decimal = Decimal("0")
    actualamount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    linked_account_desc: Optional[str] = None
    model_config = {"from_attributes": True}


# ── PeriodInvestmentTransaction ───────────────────────────────────────────────

class InvestmentTxCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None
    linked_incomedesc: Optional[str] = None


class InvestmentTxOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    investmentdesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    linked_incomedesc: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodTransactionOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    source: str
    type: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    is_system: bool
    system_reason: Optional[str] = None
    source_key: Optional[str] = None
    source_label: Optional[str] = None
    affected_account_desc: Optional[str] = None
    related_account_desc: Optional[str] = None
    linked_incomedesc: Optional[str] = None
    model_config = {"from_attributes": True}


# ── PeriodExpenseEntry ────────────────────────────────────────────────────────

class ExpenseEntryCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None


class ExpenseEntryOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    expensedesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    model_config = {"from_attributes": True}


# ── BalanceType ───────────────────────────────────────────────────────────────

class BalanceTypeBase(BaseModel):
    balancedesc: str
    balance_type: Optional[str] = None
    opening_balance: Decimal = Decimal("0.00")
    active: bool = True
    is_primary: bool = False


class BalanceTypeCreate(BalanceTypeBase):
    pass


class BalanceTypeUpdate(BaseModel):
    balance_type: Optional[str] = None
    opening_balance: Optional[Decimal] = None
    active: Optional[bool] = None
    is_primary: Optional[bool] = None


class BalanceTypeOut(BalanceTypeBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── PeriodBalance ─────────────────────────────────────────────────────────────

class PeriodBalanceOut(BaseModel):
    finperiodid: int
    budgetid: int
    balancedesc: str
    balance_type: Optional[str] = None
    opening_amount: Decimal
    closing_amount: Decimal
    movement_amount: Decimal = Decimal("0.00")
    model_config = {"from_attributes": True}


class PeriodBalanceUpdate(BaseModel):
    movement_amount: Decimal


# ── Period detail (combined) ──────────────────────────────────────────────────

class PeriodDetailOut(BaseModel):
    period: PeriodOut
    incomes: list[PeriodIncomeOut]
    expenses: list[PeriodExpenseOut]
    investments: list[PeriodInvestmentOut] = []
    balances: list[PeriodBalanceOut] = []


# ── Budget Health ─────────────────────────────────────────────────────────────

class BudgetHealthEvidenceOut(BaseModel):
    label: str
    value: str
    detail: Optional[str] = None


class BudgetHealthPillarOut(BaseModel):
    key: str
    title: str
    score: int
    status: str
    summary: str
    evidence: list[BudgetHealthEvidenceOut]


class BudgetHealthOut(BaseModel):
    budgetid: int
    score_version: str
    evaluated_at: datetime
    overall_score: int
    overall_status: str
    overall_summary: str
    momentum_status: str
    momentum_delta: int = 0
    momentum_summary: str
    pillars: list[BudgetHealthPillarOut]
