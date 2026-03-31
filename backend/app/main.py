from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .models import PayType  # noqa: F401 — ensure model is registered
from .routers import budgets, periods, income_types, expense_items, investments

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
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Dosh"}
