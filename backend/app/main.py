from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .cycle_management import assign_period_lifecycle_states
from .database import Base, engine
from . import models as _models  # noqa: F401 - ensure all models are registered
from .models import PayType
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
)

# Create all tables on startup
Base.metadata.create_all(bind=engine)


def _cleanup_legacy_income_type_columns():
    with engine.begin() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(incometypes)")).fetchall()}
        if "isfixed" in columns:
            connection.execute(text("ALTER TABLE incometypes DROP COLUMN isfixed"))


_cleanup_legacy_income_type_columns()

app = FastAPI(title="Dosh API", version="1.0.0")

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

        # Seed app info
        from .models import AppInfo
        if not db.query(AppInfo).first():
            db.add(AppInfo(versionnum="1.0.0"))

        db.commit()

        from .models import Budget
        budget_ids = [budget_id for (budget_id,) in db.query(Budget.budgetid).all()]
        for budget_id in budget_ids:
            assign_period_lifecycle_states(budget_id, db)
        db.commit()

    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Dosh"}
