from datetime import datetime
from decimal import Decimal
import re
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, field_validator, model_validator

from .period_logic import parse_budget_frequency_days

SUPPORTED_LOCALES = ("en-AU", "en-US", "en-GB", "en-NZ", "de-DE")
SUPPORTED_CURRENCIES = ("AUD", "USD", "GBP", "NZD", "EUR", "CAD")
SUPPORTED_TIMEZONES = (
    "Australia/Sydney",
    "Australia/Perth",
    "Pacific/Auckland",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "UTC",
)
DATE_FORMAT_OPTIONS = ("compact", "short", "medium", "long", "numeric", "MM-dd-yy", "MMM-dd-yyyy")
SUPPORTED_CURRENCY_VALUES = set(SUPPORTED_CURRENCIES)
SUPPORTED_TIMEZONE_VALUES = set(SUPPORTED_TIMEZONES)
DATE_FORMAT_VALUES = set(DATE_FORMAT_OPTIONS)
LOCALE_CANONICAL = {locale.lower(): locale for locale in SUPPORTED_LOCALES}
DATE_FORMAT_TOKEN_PATTERN = re.compile(r"(yyyy|yy|MMMM|MMM|MM|M|dd|d|[\s.,/-]+)")
DATE_FORMAT_TOKEN_VALUES = {"yyyy", "yy", "MMMM", "MMM", "MM", "M", "dd", "d"}


def _validate_locale(value: str) -> str:
    normalized = value.strip()
    canonical = LOCALE_CANONICAL.get(normalized.lower())
    if not canonical:
        raise ValueError(f"locale must be one of {SUPPORTED_LOCALES}")
    return canonical


def _validate_currency(value: str) -> str:
    normalized = value.strip().upper()
    if normalized not in SUPPORTED_CURRENCY_VALUES:
        raise ValueError(f"currency must be one of {SUPPORTED_CURRENCIES}")
    return normalized


def _validate_timezone(value: str) -> str:
    normalized = value.strip()
    if normalized not in SUPPORTED_TIMEZONE_VALUES:
        raise ValueError(f"timezone must be one of {SUPPORTED_TIMEZONES}")
    try:
        ZoneInfo(normalized)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("timezone must be a valid IANA timezone") from exc
    return normalized


def _validate_date_format(value: str | None) -> str:
    if value is None:
        return "medium"

    normalized = value.strip().replace("Y", "y").replace("D", "d")
    if normalized in DATE_FORMAT_VALUES:
        return normalized

    tokens = DATE_FORMAT_TOKEN_PATTERN.findall(normalized)
    if "".join(tokens) != normalized:
        raise ValueError("date_format must use day, month, and year tokens with standard separators")

    token_values = {token for token in tokens if token in DATE_FORMAT_TOKEN_VALUES}
    has_day = bool(token_values & {"d", "dd"})
    has_month = bool(token_values & {"M", "MM", "MMM", "MMMM"})
    has_year = bool(token_values & {"yy", "yyyy"})
    if not (has_day and has_month and has_year):
        raise ValueError("date_format must include day, month, and year tokens")

    return normalized


# ── PayType ──────────────────────────────────────────────────────────────────

class PayTypeOut(BaseModel):
    paytype: str
    model_config = {"from_attributes": True}


class ReleaseNotesSectionOut(BaseModel):
    title: str
    items: list[str] = []


class ReleaseNoteOut(BaseModel):
    version: str
    status: str
    release_date: str
    summary: str = ""
    sections: list[ReleaseNotesSectionOut] = []


class ReleaseNotesResponseOut(BaseModel):
    current_version: str
    update_available: bool = False
    newer_release_count: int = 0
    previous_release_count: int = 0
    current_release: Optional[ReleaseNoteOut] = None
    newer_releases: list[ReleaseNoteOut] = []
    previous_releases: list[ReleaseNoteOut] = []


# ── Budget ───────────────────────────────────────────────────────────────────

class BudgetBase(BaseModel):
    budgetowner: str
    description: Optional[str] = None
    budget_frequency: str  # Weekly | Fortnightly | Monthly | Every N Days
    account_naming_preference: str = "Transaction"
    locale: str = "en-AU"
    currency: str = "AUD"
    timezone: str = "Australia/Sydney"
    date_format: str = "medium"
    max_forward_balance_cycles: int = 10
    health_tone: str = "supportive"
    ai_insights_enabled: bool = False
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_custom_model: Optional[str] = None
    ai_system_prompt: Optional[str] = None
    ai_insights_on_closeout: bool = False

    @field_validator("health_tone")
    @classmethod
    def validate_health_tone(cls, v: str) -> str:
        allowed = {"supportive", "factual", "friendly"}
        if v not in allowed:
            raise ValueError(f"health_tone must be one of {allowed}")
        return v

    @field_validator("max_forward_balance_cycles")
    @classmethod
    def validate_max_forward_balance_cycles(cls, v: int) -> int:
        if v < 1 or v > 50:
            raise ValueError("max_forward_balance_cycles must be between 1 and 50")
        return v

    @field_validator("budget_frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        allowed = {"Weekly", "Fortnightly", "Monthly"}
        if v in allowed:
            return v
        custom_days = parse_budget_frequency_days(v)
        if custom_days is None:
            raise ValueError("budget_frequency must be Weekly, Fortnightly, Monthly, or Every N Days")
        if custom_days < 2 or custom_days > 365:
            raise ValueError("Custom day cycles must be between 2 and 365 days")
        return v

    @field_validator("account_naming_preference")
    @classmethod
    def validate_account_naming_preference(cls, v: str) -> str:
        allowed = {"Transaction", "Everyday", "Checking"}
        if v not in allowed:
            raise ValueError(f"account_naming_preference must be one of {allowed}")
        return v

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: str) -> str:
        return _validate_locale(v)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return _validate_currency(v)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        return _validate_timezone(v)

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        return _validate_date_format(v)


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
    locale: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    auto_expense_enabled: Optional[bool] = None
    auto_expense_offset_days: Optional[int] = None
    record_line_status_changes: Optional[bool] = None
    max_forward_balance_cycles: Optional[int] = None
    health_tone: Optional[str] = None
    ai_insights_enabled: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_custom_model: Optional[str] = None
    ai_system_prompt: Optional[str] = None
    ai_insights_on_closeout: Optional[bool] = None
    ai_api_key: Optional[str] = None

    @field_validator("health_tone")
    @classmethod
    def validate_optional_health_tone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"supportive", "factual", "friendly"}
        if v not in allowed:
            raise ValueError(f"health_tone must be one of {allowed}")
        return v

    @field_validator("ai_provider")
    @classmethod
    def validate_optional_ai_provider(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"openrouter", "openai_compatible"}
        if v not in allowed:
            raise ValueError(f"ai_provider must be one of {allowed}")
        return v

    @field_validator("max_forward_balance_cycles")
    @classmethod
    def validate_optional_max_forward_balance_cycles(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 1 or v > 50:
            raise ValueError("max_forward_balance_cycles must be between 1 and 50")
        return v

    @field_validator(
        "acceptable_expense_overrun_pct",
        "comfortable_surplus_buffer_pct",
        "revision_sensitivity",
        "savings_priority",
        "period_criticality_bias",
    )
    @classmethod
    def validate_percentage_preference(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Threshold values must be between 0 and 100")
        return v

    @field_validator("auto_expense_offset_days")
    @classmethod
    def validate_auto_expense_offset_days(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Auto expense offset days must be 0 or more")
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

    @field_validator("locale")
    @classmethod
    def validate_optional_locale(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_locale(v)

    @field_validator("currency")
    @classmethod
    def validate_optional_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_currency(v)

    @field_validator("timezone")
    @classmethod
    def validate_optional_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_timezone(v)

    @field_validator("date_format", mode="before")
    @classmethod
    def validate_optional_date_format(cls, v: Optional[str]) -> str:
        return _validate_date_format(v)

    @field_validator("budget_frequency")
    @classmethod
    def validate_optional_frequency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"Weekly", "Fortnightly", "Monthly"}
        if v in allowed:
            return v
        custom_days = parse_budget_frequency_days(v)
        if custom_days is None:
            raise ValueError("budget_frequency must be Weekly, Fortnightly, Monthly, or Every N Days")
        if custom_days < 2 or custom_days > 365:
            raise ValueError("Custom day cycles must be between 2 and 365 days")
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
    locale: str = "en-AU"
    currency: str = "AUD"
    timezone: str = "Australia/Sydney"
    date_format: str = "medium"
    auto_expense_enabled: bool = False
    auto_expense_offset_days: int = 0
    record_line_status_changes: bool = False
    max_forward_balance_cycles: int = 10
    health_tone: str = "supportive"
    ai_insights_enabled: bool = False
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_custom_model: Optional[str] = None
    ai_system_prompt: Optional[str] = None
    ai_insights_on_closeout: bool = False
    ai_api_key_configured: bool = False
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
    deactivation_impact: str | None = None
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
    autoinclude: bool = True
    amount: Decimal = Decimal("0.00")
    linked_account: Optional[str] = None


class IncomeTypeCreate(IncomeTypeBase):
    pass


class IncomeTypeUpdate(BaseModel):
    incomedesc: Optional[str] = None
    issavings: Optional[bool] = None
    autoinclude: Optional[bool] = None
    amount: Optional[Decimal] = None
    linked_account: Optional[str] = None


class IncomeTypeOut(IncomeTypeBase):
    budgetid: int
    revisionnum: int = 0
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
    default_account_desc: Optional[str] = None

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
    default_account_desc: Optional[str] = None
    bump_revision: bool = False


class ExpenseItemOut(ExpenseItemBase):
    budgetid: int
    revisionnum: int
    default_account_desc: Optional[str] = None
    model_config = {"from_attributes": True}


class SetupHistoryEntryOut(BaseModel):
    id: int
    history_kind: str = "budget_adjustment"
    finperiodid: Optional[int] = None
    period_startdate: Optional[datetime] = None
    period_enddate: Optional[datetime] = None
    source: Optional[str] = None
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    note: Optional[str] = None
    entrydate: datetime
    is_system: bool = False
    system_reason: Optional[str] = None
    source_key: Optional[str] = None
    source_label: Optional[str] = None
    affected_account_desc: Optional[str] = None
    related_account_desc: Optional[str] = None
    linked_incomedesc: Optional[str] = None
    entry_kind: str = "movement"
    line_status: Optional[str] = None
    budget_scope: Optional[str] = None
    budget_before_amount: Optional[Decimal] = None
    budget_after_amount: Optional[Decimal] = None
    revisionnum: Optional[int] = None
    change_details: list[dict[str, Any]] = []


class SetupHistoryOut(BaseModel):
    item_desc: str
    category: str
    current_revisionnum: int = 0
    entries: list[SetupHistoryEntryOut] = []


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
    cycle_stage: str = "PLANNED"
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
    projected_investment: Decimal = Decimal("0")
    can_delete: bool = False
    delete_mode: Optional[str] = None
    delete_reason: Optional[str] = None


class PeriodDeleteOptionsOut(BaseModel):
    can_delete_single: bool = False
    can_delete_future_chain: bool = False
    future_chain_count: int = 0
    delete_reason: Optional[str] = None
    cycle_status: str
    cycle_stage: str = "PLANNED"


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
    revision_snapshot: int = 0
    linked_account: Optional[str] = None
    status: str = 'Current'
    revision_comment: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodIncomeActualUpdate(BaseModel):
    actualamount: Decimal


class PeriodIncomeStatusUpdate(BaseModel):
    status: str
    revision_comment: Optional[str] = None


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
    revision_comment: Optional[str] = None
    model_config = {"from_attributes": True}


class PeriodExpensePayTypeUpdate(BaseModel):
    paytype: str

    @field_validator("paytype")
    @classmethod
    def validate_paytype(cls, v: str) -> str:
        if v not in {"AUTO", "MANUAL"}:
            raise ValueError("paytype must be 'AUTO' or 'MANUAL'")
        return v


class PeriodExpenseStatusUpdate(BaseModel):
    status: str
    revision_comment: Optional[str] = None


class PeriodExpenseBudgetUpdate(BaseModel):
    budgetamount: Decimal


class PeriodLineBudgetAdjustRequest(BaseModel):
    budgetamount: Decimal
    scope: str
    note: str

    @field_validator("scope")
    @classmethod
    def validate_adjustment_scope(cls, v: str) -> str:
        if v not in {"current", "future"}:
            raise ValueError("scope must be 'current' or 'future'")
        return v

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("note is required")
        return value


class PeriodExpenseActualUpdate(BaseModel):
    actualamount: Decimal


class AddExpenseToPeriodRequest(BaseModel):
    budgetid: int
    expensedesc: str
    budgetamount: Decimal
    scope: str
    note: Optional[str] = None

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
    note: Optional[str] = None

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        if v not in {"oneoff", "future"}:
            raise ValueError("scope must be 'oneoff' or 'future'")
        return v


class AccountTransferRequest(BaseModel):
    budgetid: int
    source_account: str
    destination_account: str
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
    planned_amount: Decimal = Decimal("0.00")
    linked_account_desc: Optional[str] = None
    source_account_desc: Optional[str] = None
    is_primary: bool = False


class InvestmentItemCreate(InvestmentItemBase):
    pass


class InvestmentItemUpdate(BaseModel):
    active: Optional[bool] = None
    effectivedate: Optional[datetime] = None
    initial_value: Optional[Decimal] = None
    planned_amount: Optional[Decimal] = None
    linked_account_desc: Optional[str] = None
    source_account_desc: Optional[str] = None
    is_primary: Optional[bool] = None


class InvestmentItemOut(InvestmentItemBase):
    budgetid: int
    revisionnum: int = 0
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
    source_account_desc: Optional[str] = None
    revision_snapshot: int = 0
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
    carry_forward_applied: bool = False
    health_snapshot_json: str
    totals_snapshot_json: str
    ai_insight_text: Optional[str] = None
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
    carry_forward: bool = False
    comments: Optional[str] = None
    goals: Optional[str] = None
    ai_insight_text: Optional[str] = None


# ── PeriodInvestmentTransaction ───────────────────────────────────────────────

class InvestmentTxCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None
    linked_incomedesc: Optional[str] = None
    entrydate: Optional[datetime] = None
    account_desc: Optional[str] = None


class InvestmentTxOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    investmentdesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    linked_incomedesc: Optional[str] = None
    type: Optional[str] = None
    entry_kind: str = "movement"
    line_status: Optional[str] = None
    budget_scope: Optional[str] = None
    budget_before_amount: Optional[Decimal] = None
    budget_after_amount: Optional[Decimal] = None
    revisionnum: Optional[int] = None
    affected_account_desc: Optional[str] = None
    model_config = {"from_attributes": True}


class IncomeTxCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None
    entrydate: Optional[datetime] = None


class IncomeTxOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    incomedesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    source: str
    type: Optional[str] = None
    affected_account_desc: Optional[str] = None
    related_account_desc: Optional[str] = None
    entry_kind: str = "movement"
    line_status: Optional[str] = None
    budget_scope: Optional[str] = None
    budget_before_amount: Optional[Decimal] = None
    budget_after_amount: Optional[Decimal] = None
    revisionnum: Optional[int] = None
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
    entry_kind: str = "movement"
    line_status: Optional[str] = None
    budget_scope: Optional[str] = None
    budget_before_amount: Optional[Decimal] = None
    budget_after_amount: Optional[Decimal] = None
    revisionnum: Optional[int] = None
    model_config = {"from_attributes": True}


class AutoExpenseRunResultOut(BaseModel):
    created_count: int = 0
    skipped_count: int = 0
    skipped_reasons: list[str] = []


# ── PeriodExpenseEntry ────────────────────────────────────────────────────────

class ExpenseEntryCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None
    entrydate: Optional[datetime] = None
    account_desc: Optional[str] = None


class ExpenseEntryOut(BaseModel):
    id: int
    finperiodid: int
    budgetid: int
    expensedesc: str
    amount: Decimal
    note: Optional[str] = None
    entrydate: datetime
    type: Optional[str] = None
    entry_kind: str = "movement"
    line_status: Optional[str] = None
    budget_scope: Optional[str] = None
    budget_before_amount: Optional[Decimal] = None
    budget_after_amount: Optional[Decimal] = None
    revisionnum: Optional[int] = None
    affected_account_desc: Optional[str] = None
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
    balances_limit_exceeded: bool = False
    projected_investment: Decimal = Decimal("0")
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
