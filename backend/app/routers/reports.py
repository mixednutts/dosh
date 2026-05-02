from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..api_docs import DbSession, error_responses
from ..cycle_constants import CLOSED, CURRENT_STAGE, PENDING_CLOSURE_STAGE, PLANNED
from ..cycle_management import current_period_totals, cycle_stage, ordered_budget_periods, _to_decimal
from ..models import Budget
from ..schemas import PeriodOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/budgets/{budget_id}/summary", responses=error_responses(404))
def get_budget_report_summary(budget_id: int, db: DbSession):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")
    periods = ordered_budget_periods(budget_id, db)
    if not periods:
        return {
            "budget": {"budgetid": budget.budgetid, "description": budget.description, "budgetowner": budget.budgetowner},
            "period_count": 0,
            "date_range": None,
        }
    return {
        "budget": {"budgetid": budget.budgetid, "description": budget.description, "budgetowner": budget.budgetowner},
        "period_count": len(periods),
        "date_range": {"start": periods[0].startdate.date().isoformat(), "end": periods[-1].enddate.date().isoformat()},
    }


class BudgetVsActualTrendOut(PeriodOut):
    label: str
    income_budget: Decimal = Decimal("0")
    income_actual: Decimal = Decimal("0")
    expense_budget: Decimal = Decimal("0")
    expense_actual: Decimal = Decimal("0")
    investment_budget: Decimal = Decimal("0")
    investment_actual: Decimal = Decimal("0")


class BudgetVsActualTrendsResponseOut(BaseModel):
    periods: list[BudgetVsActualTrendOut]
    model_config = {"from_attributes": True}


class IncomeAllocationTrendOut(PeriodOut):
    label: str
    income_budget: Decimal = Decimal("0")
    income_actual: Decimal = Decimal("0")
    expense_budget: Decimal = Decimal("0")
    expense_actual: Decimal = Decimal("0")
    investment_budget: Decimal = Decimal("0")
    investment_actual: Decimal = Decimal("0")
    surplus_budget: Decimal = Decimal("0")
    surplus_actual: Decimal = Decimal("0")


class IncomeAllocationTrendsResponseOut(BaseModel):
    periods: list[IncomeAllocationTrendOut]
    model_config = {"from_attributes": True}


class InvestmentTrendOut(PeriodOut):
    label: str
    cumulative_contributed: Optional[Decimal] = None
    cumulative_projected: Decimal = Decimal("0")


class InvestmentTrendsResponseOut(BaseModel):
    periods: list[InvestmentTrendOut]
    model_config = {"from_attributes": True}


def _period_label(period) -> str:
    start = period.startdate
    end = period.enddate
    if isinstance(start, datetime):
        start = start.date()
    if isinstance(end, datetime):
        end = end.date()
    return f"{start.strftime('%b %d')}–{end.strftime('%b %d')}"


def _effective_date_range(periods: list, from_date: Optional[date], to_date: Optional[date]) -> tuple[date, date]:
    """Compute effective from/to dates given a list of non-planned periods."""
    latest_period = periods[-1]
    default_from = (latest_period.enddate - timedelta(days=365)).date()
    default_to = latest_period.enddate.date()
    effective_from = from_date or default_from
    effective_to = to_date or default_to
    return effective_from, effective_to


def _period_in_range(period, effective_from: date, effective_to: date) -> bool:
    period_start = period.startdate.date() if isinstance(period.startdate, datetime) else period.startdate
    period_end = period.enddate.date() if isinstance(period.enddate, datetime) else period.enddate
    return period_start >= effective_from and period_end <= effective_to


@router.get(
    "/budgets/{budget_id}/trends/budget-vs-actual",
    response_model=BudgetVsActualTrendsResponseOut,
    responses=error_responses(404),
)
def get_budget_vs_actual_trends(
    budget_id: int,
    db: DbSession,
    from_date: Annotated[Optional[date], Query()] = None,
    to_date: Annotated[Optional[date], Query()] = None,
):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")

    periods = ordered_budget_periods(budget_id, db)
    if not periods:
        return BudgetVsActualTrendsResponseOut(periods=[])

    non_planned = [p for p in periods if cycle_stage(p) != PLANNED]
    if not non_planned:
        return BudgetVsActualTrendsResponseOut(periods=[])

    effective_from, effective_to = _effective_date_range(non_planned, from_date, to_date)

    result = []
    for period in non_planned:
        if not _period_in_range(period, effective_from, effective_to):
            continue

        totals = current_period_totals(period, db)
        label = _period_label(period)

        trend = BudgetVsActualTrendOut(
            finperiodid=period.finperiodid,
            budgetid=period.budgetid,
            startdate=period.startdate,
            enddate=period.enddate,
            budgetowner=period.budgetowner,
            islocked=period.islocked,
            cycle_status=period.cycle_status,
            cycle_stage=period.cycle_stage,
            closed_at=period.closed_at,
            label=label,
            income_budget=totals["income_budget"],
            income_actual=totals["income_actual"],
            expense_budget=totals["expense_budget"],
            expense_actual=totals["expense_actual"],
            investment_budget=totals["investment_budget"],
            investment_actual=totals["investment_actual"],
        )
        result.append(trend)

    return BudgetVsActualTrendsResponseOut(periods=result)


@router.get(
    "/budgets/{budget_id}/trends/income-allocation",
    response_model=IncomeAllocationTrendsResponseOut,
    responses=error_responses(404),
)
def get_income_allocation_trends(
    budget_id: int,
    db: DbSession,
    from_date: Annotated[Optional[date], Query()] = None,
    to_date: Annotated[Optional[date], Query()] = None,
):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")

    periods = ordered_budget_periods(budget_id, db)
    if not periods:
        return IncomeAllocationTrendsResponseOut(periods=[])

    non_planned = [p for p in periods if cycle_stage(p) != PLANNED]
    if not non_planned:
        return IncomeAllocationTrendsResponseOut(periods=[])

    effective_from, effective_to = _effective_date_range(non_planned, from_date, to_date)

    result = []
    for period in non_planned:
        if not _period_in_range(period, effective_from, effective_to):
            continue

        totals = current_period_totals(period, db)
        label = _period_label(period)

        trend = IncomeAllocationTrendOut(
            finperiodid=period.finperiodid,
            budgetid=period.budgetid,
            startdate=period.startdate,
            enddate=period.enddate,
            budgetowner=period.budgetowner,
            islocked=period.islocked,
            cycle_status=period.cycle_status,
            cycle_stage=period.cycle_stage,
            closed_at=period.closed_at,
            label=label,
            income_budget=totals["income_budget"],
            income_actual=totals["income_actual"],
            expense_budget=totals["expense_budget"],
            expense_actual=totals["expense_actual"],
            investment_budget=totals["investment_budget"],
            investment_actual=totals["investment_actual"],
            surplus_budget=totals["surplus_budget"],
            surplus_actual=totals["surplus_actual"],
        )
        result.append(trend)

    return IncomeAllocationTrendsResponseOut(periods=result)


@router.get(
    "/budgets/{budget_id}/trends/investment-trends",
    response_model=InvestmentTrendsResponseOut,
    responses=error_responses(404),
)
def get_investment_trends(
    budget_id: int,
    db: DbSession,
):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")

    periods = ordered_budget_periods(budget_id, db)
    if not periods:
        return InvestmentTrendsResponseOut(periods=[])

    result = []
    cumulative_committed = Decimal("0")
    cumulative_budgeted = Decimal("0")
    for period in periods:
        investments = period.period_investments
        budgeted = sum((_to_decimal(inv.budgeted_amount) for inv in investments), Decimal("0"))
        actual = sum((_to_decimal(inv.actualamount) for inv in investments), Decimal("0"))
        committed = sum(
            (max(_to_decimal(inv.actualamount), _to_decimal(inv.budgeted_amount)) for inv in investments),
            Decimal("0"),
        )
        cumulative_budgeted += budgeted

        stage = cycle_stage(period)
        if stage == PLANNED:
            contributed = None
        elif stage == CLOSED:
            cumulative_committed += actual
            contributed = cumulative_committed
        else:
            # Current or pending closure — use committed value
            cumulative_committed += committed
            contributed = cumulative_committed

        label = _period_label(period)

        trend = InvestmentTrendOut(
            finperiodid=period.finperiodid,
            budgetid=period.budgetid,
            startdate=period.startdate,
            enddate=period.enddate,
            budgetowner=period.budgetowner,
            islocked=period.islocked,
            cycle_status=period.cycle_status,
            cycle_stage=cycle_stage(period),
            closed_at=period.closed_at,
            label=label,
            cumulative_contributed=contributed,
            cumulative_projected=cumulative_budgeted,
        )
        result.append(trend)

    return InvestmentTrendsResponseOut(periods=result)
