from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..api_docs import DbSession, error_responses
from ..cycle_constants import PLANNED
from ..cycle_management import current_period_totals, cycle_stage, ordered_budget_periods
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

    # Exclude upcoming/planned periods; anchor default range to the latest non-planned period
    non_planned = [p for p in periods if cycle_stage(p) != PLANNED]
    if not non_planned:
        return BudgetVsActualTrendsResponseOut(periods=[])

    latest_period = non_planned[-1]
    default_from = (latest_period.enddate - timedelta(days=365)).date()
    default_to = latest_period.enddate.date()

    effective_from = from_date or default_from
    effective_to = to_date or default_to

    result = []
    for period in non_planned:
        period_start = period.startdate.date() if isinstance(period.startdate, datetime) else period.startdate
        period_end = period.enddate.date() if isinstance(period.enddate, datetime) else period.enddate
        if period_start < effective_from or period_end > effective_to:
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


def _period_label(period) -> str:
    start = period.startdate
    end = period.enddate
    if isinstance(start, datetime):
        start = start.date()
    if isinstance(end, datetime):
        end = end.date()
    return f"{start.strftime('%b %d')}–{end.strftime('%b %d')}"
