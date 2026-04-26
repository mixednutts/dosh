import json
from typing import Annotated, Any

import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.responses import Response

from ..api_docs import DbSession, error_responses
from ..backup_service import build_backup_payload
from ..demo_budget import create_standard_demo_budget
from ..health_engine import evaluate_budget_health
from ..health_engine_seed import create_default_matrix_for_budget
from ..models import Budget
from ..restore_service import inspect_backup, restore_budgets
from ..encryption import encrypt_value, encryption_ready
from ..schemas import (
    BudgetCreate,
    BudgetOut,
    BudgetSetupAssessmentOut,
    BudgetUpdate,
    DATE_FORMAT_OPTIONS,
    SUPPORTED_CURRENCIES,
    SUPPORTED_LOCALES,
    SUPPORTED_TIMEZONES,
)
from ..setup_assessment import budget_setup_assessment

logger = logging.getLogger(__name__)

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
    create_default_matrix_for_budget(db, budget)
    db.commit()
    db.refresh(budget)
    logger.info("create_budget completed")
    return budget


@router.post("/demo", response_model=BudgetOut, status_code=201, responses=error_responses(404))
def create_demo_budget(db: DbSession):
    logger.info("create_demo_budget completed")
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


@router.get("/{budgetid}/health", responses=error_responses(404))
def get_budget_health(budgetid: int, db: DbSession):
    """Budget Health endpoint powered by the Health Engine.

    Returns a health payload computed by the configurable engine.
    """
    payload = evaluate_budget_health(db, budgetid)
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
    data = payload.model_dump(exclude_unset=True)
    # Handle AI API key encryption
    if "ai_api_key" in data:
        if not encryption_ready():
            raise HTTPException(503, "DOSH_ENCRYPTION_SECRET is not configured on the server. AI features cannot be used.")
        api_key = data.pop("ai_api_key")
        if api_key:
            budget.ai_api_key_encrypted = encrypt_value(api_key)
        else:
            budget.ai_api_key_encrypted = None
    for field, value in data.items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    logger.info("update_budget completed")
    return budget


@router.delete("/{budgetid}", status_code=204, responses=error_responses(404))
def delete_budget(budgetid: int, db: DbSession):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()
    logger.info("delete_budget completed", extra={"budget_id": budgetid})


# ── Backup / Restore ─────────────────────────────────────────────────────────

@router.post("/backup", responses=error_responses(422))
def backup_budgets(
    db: DbSession,
    budgetid: Annotated[int | None, Form()] = None,
):
    """Download a JSON backup of one or all budgets."""
    if budgetid is not None:
        budget = db.get(Budget, budgetid)
        if not budget:
            raise HTTPException(404, "Budget not found")
        budgets = [budget]
        filename = f"dosh-backup-budget-{budgetid}.json"
    else:
        budgets = db.query(Budget).all()
        filename = "dosh-backup-all.json"

    payload = build_backup_payload(budgets, db)
    content = json.dumps(payload, indent=2)
    logger.info("backup_budgets completed")
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore/inspect", responses=error_responses(400, 422))
async def restore_inspect(file: Annotated[UploadFile, File()]):
    """Inspect a backup file without applying it."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(422, "Backup file must be a JSON file.")
    try:
        raw = await file.read()
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"Invalid JSON: {exc}") from exc

    try:
        result = inspect_backup(payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    return result


@router.post("/restore/apply", responses=error_responses(400, 409, 422))
def restore_apply(
    db: DbSession,
    file: Annotated[UploadFile, File()],
    selected_indices: Annotated[str, Form()] = "",
    allow_overwrite: Annotated[bool, Form()] = False,
):
    """Apply a backup file to restore budgets."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(422, "Backup file must be a JSON file.")
    try:
        raw = file.file.read()
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"Invalid JSON: {exc}") from exc

    indices: list[int] | None = None
    if selected_indices.strip():
        try:
            indices = [int(x.strip()) for x in selected_indices.split(",") if x.strip() != ""]
        except ValueError as exc:
            raise HTTPException(422, "selected_indices must be a comma-separated list of integers.") from exc

    # Block newer backups
    from ..restore_service import compute_compatibility
    compatibility = compute_compatibility(payload.get("app_version", "unknown"))
    if compatibility == "newer_backup":
        raise HTTPException(
            409,
            "This backup was created with a newer app version. Please upgrade the app before restoring.",
        )

    try:
        result = restore_budgets(db, payload, selected_indices=indices, allow_overwrite=allow_overwrite)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    logger.info("restore_apply completed")
    return result
