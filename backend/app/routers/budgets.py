from fastapi import APIRouter, HTTPException
from ..budget_health import build_budget_health_payload
from ..api_docs import DbSession, error_responses
from ..demo_budget import create_standard_demo_budget
from ..models import Budget
from ..runtime_settings import dev_mode_enabled
from ..schemas import (
    BudgetCreate,
    BudgetHealthOut,
    BudgetOut,
    BudgetSetupAssessmentOut,
    BudgetUpdate,
    DATE_FORMAT_OPTIONS,
    SUPPORTED_CURRENCIES,
    SUPPORTED_LOCALES,
    SUPPORTED_TIMEZONES,
)
from ..setup_assessment import budget_setup_assessment

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetOut])
def list_budgets(db: DbSession):
    return db.query(Budget).all()


@router.post("/", response_model=BudgetOut, status_code=201)
def create_budget(payload: BudgetCreate, db: DbSession):
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.post("/demo", response_model=BudgetOut, status_code=201, responses=error_responses(404))
def create_demo_budget(db: DbSession):
    if not dev_mode_enabled():
        raise HTTPException(404, "Not found")
    return create_standard_demo_budget(db)


@router.get("/localisation-options")
def get_localisation_options():
    return {
        "locales": list(SUPPORTED_LOCALES),
        "currencies": list(SUPPORTED_CURRENCIES),
        "timezones": list(SUPPORTED_TIMEZONES),
        "date_formats": list(DATE_FORMAT_OPTIONS),
    }


@router.get("/{budgetid}", response_model=BudgetOut, responses=error_responses(404))
def get_budget(budgetid: int, db: DbSession):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


@router.get("/{budgetid}/health", response_model=BudgetHealthOut, responses=error_responses(404))
def get_budget_health(budgetid: int, db: DbSession):
    payload = build_budget_health_payload(db, budgetid)
    if not payload:
        raise HTTPException(404, "Budget not found")
    return payload


@router.get("/{budgetid}/setup-assessment", response_model=BudgetSetupAssessmentOut, responses=error_responses(404))
def get_budget_setup_assessment(budgetid: int, db: DbSession):
    payload = budget_setup_assessment(budgetid, db)
    if not payload:
        raise HTTPException(404, "Budget not found")
    return payload


@router.patch("/{budgetid}", response_model=BudgetOut, responses=error_responses(404))
def update_budget(budgetid: int, payload: BudgetUpdate, db: DbSession):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budgetid}", status_code=204, responses=error_responses(404))
def delete_budget(budgetid: int, db: DbSession):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()
