from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cycle_management import assign_period_lifecycle_states
from .database import Base, engine
from .models import PayType  # noqa: F401 — ensure model is registered
from .routers import budgets, periods, income_types, expense_items, investments, expense_entries, balance_types, investment_transactions, period_transactions

# Create all tables on startup
Base.metadata.create_all(bind=engine)

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
app.include_router(balance_types.router, prefix="/api")
app.include_router(balance_types.period_router, prefix="/api")
app.include_router(investment_transactions.router, prefix="/api")
app.include_router(period_transactions.router, prefix="/api")


@app.on_event("startup")
def seed_reference_data():
    from sqlalchemy import inspect, text
    from sqlalchemy.orm import Session
    from .database import SessionLocal

    def add_column_if_missing(table_name: str, column_name: str, sql_definition: str):
        inspector = inspect(engine)
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        if column_name not in existing_columns:
            db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sql_definition}"))
            db.commit()

    db: Session = SessionLocal()
    try:
        add_column_if_missing("budgets", "allow_cycle_lock", "INTEGER NOT NULL DEFAULT 1")
        add_column_if_missing("financialperiods", "cycle_status", "VARCHAR NOT NULL DEFAULT 'PLANNED'")
        add_column_if_missing("financialperiods", "closed_at", "DATETIME")
        add_column_if_missing("periodincome", "is_system", "INTEGER NOT NULL DEFAULT 0")
        add_column_if_missing("periodincome", "system_key", "VARCHAR")
        add_column_if_missing("periodinvestments", "status", "VARCHAR NOT NULL DEFAULT 'Current'")
        add_column_if_missing("periodinvestments", "revision_comment", "VARCHAR")

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
