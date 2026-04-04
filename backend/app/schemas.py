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
    account_naming_preference: str = "Transaction"

    @field_validator("budget_frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        allowed = {"Weekly", "Fortnightly", "Monthly"}
        if v not in allowed:
            raise ValueError(f"budget_frequency must be one of {allowed}")
        return v

    @field_validator("account_naming_preference")
    @classmethod
    def validate_account_naming_preference(cls, v: str) -> str:
        allowed = {"Transaction", "Everyday", "Checking"}
        if v not in allowed:
            raise ValueError(f"account_naming_preference must be one of {allowed}")
        return v


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    budgetowner: Optional[str] = None
    description: Optional[str] = None
    budget_frequency: Optional[str] = None
    variance_mode: Optional[str] = None
    auto_add_surplus_to_investment: Optional[bool] = None
    acceptable_expense_overrun_pct: Optional[int] = None
    comfortable_surplus_buffer_pct: Optional[int] = None
    maximum_deficit_amount: Optional[Decimal] = None
    revision_sensitivity: Optional[int] = None
    savings_priority: Optional[int] = None
    period_criticality_bias: Optional[int] = None
    allow_cycle_lock: Optional[bool] = None
    account_naming_preference: Optional[str] = None

    @field_validator(
        "acceptable_expense_overrun_pct",
        "comfortable_surplus_buffer_pct",
        "revision_sensitivity",
        "savings_priority",
        "period_criticality_bias",
    )
    @classmethod
    def validate_percentage_preference(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 0 or v > 100:
            raise ValueError("Personalisation values must be between 0 and 100")
        return v

    @field_validator("maximum_deficit_amount")
    @classmethod
    def validate_maximum_deficit_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is None:
            return v
        if v < 0:
            raise ValueError("Maximum deficit amount must be 0 or more")
        return v.quantize(Decimal("0.01"))

    @field_validator("account_naming_preference")
    @classmethod
    def validate_optional_account_naming_preference(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"Transaction", "Everyday", "Checking"}
        if v not in allowed:
            raise ValueError(f"account_naming_preference must be one of {allowed}")
        return v


class BudgetOut(BudgetBase):
    budgetid: int
    variance_mode: str = "always"
    auto_add_surplus_to_investment: bool = False
    acceptable_expense_overrun_pct: int = 10
    comfortable_surplus_buffer_pct: int = 5
    maximum_deficit_amount: Optional[Decimal] = None
    revision_sensitivity: int = 50
    savings_priority: int = 50
    period_criticality_bias: int = 50
    allow_cycle_lock: bool = True
    account_naming_preference: str = "Transaction"
    model_config = {"from_attributes": True}


class SetupAssessmentAccountOut(BaseModel):
    balancedesc: str
    in_use: bool = False
    reasons: list[str] = []
    can_delete: bool = True
    can_deactivate: bool = True
    can_edit_structure: bool = True


class SetupAssessmentIncomeOut(BaseModel):
    incomedesc: str
    in_use: bool = False
    reasons: list[str] = []
    can_delete: bool = True
    can_edit_structure: bool = True


class SetupAssessmentExpenseOut(BaseModel):
    expensedesc: str
    in_use: bool = False
    reasons: list[str] = []
    can_delete: bool = True
    can_deactivate: bool = True
    can_edit_structure: bool = True


class SetupAssessmentInvestmentOut(BaseModel):
    investmentdesc: str
    in_use: bool = False
    reasons: list[str] = []
    can_delete: bool = True
    can_deactivate: bool = True
    can_edit_structure: bool = True


class BudgetSetupAssessmentOut(BaseModel):
    budgetid: int
    can_generate: bool = False
    blocking_issues: list[str] = []
    warnings: list[str] = []
    accounts: list[SetupAssessmentAccountOut] = []
    income_types: list[SetupAssessmentIncomeOut] = []
    expense_items: list[SetupAssessmentExpenseOut] = []
    investment_items: list[SetupAssessmentInvestmentOut] = []


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
    cycle_status: str = "PLANNED"
    closed_at: Optional[datetime] = None
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
    delete_mode: Optional[str] = None
    delete_reason: Optional[str] = None


class PeriodDeleteOptionsOut(BaseModel):
    can_delete_single: bool = False
    can_delete_future_chain: bool = False
    future_chain_count: int = 0
    delete_reason: Optional[str] = None
    cycle_status: str


# ── PeriodIncome ──────────────────────────────────────────────────────────────

class PeriodIncomeOut(BaseModel):
    finperiodid: int
    budgetid: int
    incomedesc: str
    budgetamount: Decimal
    actualamount: Decimal
    varianceamount: Decimal
    is_system: bool = False
    system_key: Optional[str] = None
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
    status: str = "Current"
    revision_comment: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodInvestmentStatusUpdate(BaseModel):
    status: str
    revision_comment: Optional[str] = None


class PeriodCloseoutSnapshotOut(BaseModel):
    comments: Optional[str] = None
    goals: Optional[str] = None
    carry_forward_amount: Decimal = Decimal("0")
    health_snapshot_json: str
    totals_snapshot_json: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PeriodCloseoutPreviewOut(BaseModel):
    period: PeriodOut
    next_period: Optional[PeriodOut] = None
    carry_forward_amount: Decimal = Decimal("0")
    totals: dict
    health: dict
    next_cycle_exists: bool = False
    can_close_early: bool = False


class PeriodCloseoutRequest(BaseModel):
    create_next_cycle: bool = False
    comments: Optional[str] = None
    goals: Optional[str] = None


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


class IncomeTxCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None


class IncomeTxOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    incomedesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    source: str
    affected_account_desc: Optional[str] = None
    related_account_desc: Optional[str] = None
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
    projected_savings: Decimal = Decimal("0")
    closeout_snapshot: Optional[PeriodCloseoutSnapshotOut] = None


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
    current_period_check: BudgetHealthPillarOut
    pillars: list[BudgetHealthPillarOut]
