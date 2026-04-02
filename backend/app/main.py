from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .models import PayType  # noqa: F401 — ensure model is registered
from .routers import budgets, periods, income_types, expense_items, investments, expense_entries, balance_types, investment_transactions

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


@app.on_event("startup")
def seed_reference_data():
    from sqlalchemy.orm import Session
    from .database import SessionLocal
    from sqlalchemy import text

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

        # Schema migrations — SQLite doesn't support IF NOT EXISTS on ALTER TABLE,
        # so we catch OperationalError for "duplicate column name".
        migrations = [
            "ALTER TABLE periodexpenses ADD COLUMN status VARCHAR NOT NULL DEFAULT 'Current'",
            "ALTER TABLE periodexpenses ADD COLUMN revision_comment VARCHAR",
            "ALTER TABLE periodbalances ADD COLUMN movement_amount NUMERIC(10,2) DEFAULT 0",
            "ALTER TABLE periodinvestment_transactions ADD COLUMN linked_incomedesc VARCHAR",
            "ALTER TABLE periodinvestments ADD COLUMN budgeted_amount NUMERIC(10,2) DEFAULT 0",
            "ALTER TABLE periodinvestments ADD COLUMN actualamount NUMERIC(10,2) DEFAULT 0",
            "ALTER TABLE investmentitems ADD COLUMN linked_account_desc VARCHAR",
            "ALTER TABLE incometypes ADD COLUMN linked_account VARCHAR",
            "ALTER TABLE balancetypes ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE periodexpenses ADD COLUMN note VARCHAR",
        ]
        for sql in migrations:
            try:
                db.execute(text(sql))
                db.commit()
            except Exception:
                db.rollback()

        # Back-fill movement_amount = closing_amount - opening_amount for existing rows
        try:
            db.execute(text(
                "UPDATE periodbalances SET movement_amount = closing_amount - opening_amount "
                "WHERE movement_amount = 0 AND closing_amount != opening_amount"
            ))
            db.commit()
        except Exception:
            db.rollback()

    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Dosh"}
