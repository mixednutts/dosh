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


class BudgetOut(BudgetBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── IncomeType ────────────────────────────────────────────────────────────────

class IncomeTypeBase(BaseModel):
    incomedesc: str
    issavings: bool = False
    isfixed: bool = False
    autoinclude: bool = False
    amount: Decimal = Decimal("0.00")

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


class IncomeTypeOut(IncomeTypeBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── ExpenseItem ───────────────────────────────────────────────────────────────

class ExpenseItemBase(BaseModel):
    expensedesc: str
    active: bool = True
    freqtype: Optional[str] = None   # Fixed Day of Month | Days
    frequency_value: Optional[int] = None
    paytype: Optional[str] = None    # AUTO | MANUAL
    effectivedate: Optional[datetime] = None
    expenseamount: Decimal = Decimal("0.00")

    @field_validator("freqtype")
    @classmethod
    def validate_freqtype(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"Fixed Day of Month", "Days"}:
            raise ValueError("freqtype must be 'Fixed Day of Month' or 'Days'")
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
    # caller must indicate a revision-worthy change
    bump_revision: bool = False


class ExpenseItemOut(ExpenseItemBase):
    budgetid: int
    revisionnum: int
    model_config = {"from_attributes": True}


# ── FinancialPeriod ───────────────────────────────────────────────────────────

class PeriodGenerateRequest(BaseModel):
    budgetid: int
    startdate: datetime


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
    varianceamount: Decimal
    is_oneoff: bool
    # enriched from expenseitems — optional so existing DB rows without items still work
    freqtype: Optional[str] = None
    frequency_value: Optional[int] = None
    paytype: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodExpenseActualUpdate(BaseModel):
    actualamount: Decimal


class AddExpenseToPeriodRequest(BaseModel):
    budgetid: int
    expensedesc: str
    budgetamount: Decimal
    scope: str  # "oneoff" | "future"

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
    scope: str  # "oneoff" | "future"

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        if v not in {"oneoff", "future"}:
            raise ValueError("scope must be 'oneoff' or 'future'")
        return v


class PeriodExpenseAddActual(BaseModel):
    """Add an amount to the running actual (additive, not replace)."""
    amount: Decimal


class PeriodIncomeAddActual(BaseModel):
    """Add an amount to the running actual (additive, not replace)."""
    amount: Decimal


# ── InvestmentItem ────────────────────────────────────────────────────────────

class InvestmentItemBase(BaseModel):
    investmentdesc: str
    active: bool = True
    effectivedate: Optional[datetime] = None
    initial_value: Decimal = Decimal("0.00")


class InvestmentItemCreate(InvestmentItemBase):
    pass


class InvestmentItemUpdate(BaseModel):
    active: Optional[bool] = None
    effectivedate: Optional[datetime] = None
    initial_value: Optional[Decimal] = None


class InvestmentItemOut(InvestmentItemBase):
    budgetid: int
    model_config = {"from_attributes": True}


# ── Period detail (combined) ──────────────────────────────────────────────────

class PeriodDetailOut(BaseModel):
    period: PeriodOut
    incomes: list[PeriodIncomeOut]
    expenses: list[PeriodExpenseOut]
