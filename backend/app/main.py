import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from .api_docs import error_responses
from .auto_expense import start_auto_expense_scheduler
from .cycle_management import assign_period_lifecycle_states
from .database import engine
from . import models as _models  # noqa: F401 - ensure all models are registered
from .models import PayType
from .release_notes import release_notes_payload
from .schemas import ReleaseNotesResponseOut
from .version import APP_VERSION, get_schema_revision
from .runtime_settings import dev_mode_enabled
from .routers import (
    budgets,
    periods,
    income_types,
    expense_items,
    investments,
    expense_entries,
    income_transactions,
    balance_types,
    investment_transactions,
    period_transactions,
    health_matrices,
)

app = FastAPI(title="Dosh API", version=APP_VERSION)

# CORS only needed in dev mode when frontend may be served separately
if dev_mode_enabled():
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(budgets.router, prefix="/api")
app.include_router(periods.router, prefix="/api")
app.include_router(income_types.router, prefix="/api")
app.include_router(expense_items.router, prefix="/api")
app.include_router(investments.router, prefix="/api")
app.include_router(expense_entries.router, prefix="/api")
app.include_router(income_transactions.router, prefix="/api")
app.include_router(balance_types.router, prefix="/api")
app.include_router(balance_types.period_router, prefix="/api")
app.include_router(investment_transactions.router, prefix="/api")
app.include_router(period_transactions.router, prefix="/api")
app.include_router(health_matrices.router, prefix="/api")


@app.on_event("startup")
def seed_reference_data():
    from sqlalchemy.orm import Session
    from .database import SessionLocal

    db: Session = SessionLocal()
    try:
        # Seed pay types
        for pt in ("AUTO", "MANUAL"):
            if not db.get(PayType, pt):
                db.add(PayType(paytype=pt))

        from .models import Budget
        budget_ids = [budget_id for (budget_id,) in db.query(Budget.budgetid).all()]
        for budget_id in budget_ids:
            assign_period_lifecycle_states(budget_id, db)
        db.commit()

    finally:
        db.close()

    start_auto_expense_scheduler()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Dosh"}


@app.get("/api/info")
def info():
    return {
        "app": "Dosh",
        "version": APP_VERSION,
        "schema_revision": get_schema_revision(),
        "dev_mode": dev_mode_enabled(),
    }


@app.get(
    "/api/release-notes",
    response_model=ReleaseNotesResponseOut,
    responses=error_responses(404),
)
def release_notes():
    return release_notes_payload(APP_VERSION)


class SPAStaticFiles(StaticFiles):
    """Static files that fall back to index.html for SPA routing."""

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 404 and not path.startswith("api/"):
            return await super().get_response("index.html", scope)
        return response


# Mount static files from built frontend
STATIC_DIR = "/app/frontend_dist"
if os.path.isdir(STATIC_DIR):
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="static")
