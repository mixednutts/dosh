# Dosh

Dosh is a personal finance application with a FastAPI backend and a Create React App frontend. The current codebase supports guided budget setup, period planning, income and expense tracking, account balance tracking, savings/investment planning, and transaction-backed reconciliation.

This README reflects the repository as it exists now, not the originally intended design.

## Current Repository Layout

```text
dosh/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── period_logic.py
│       └── routers/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── nginx.conf
│   └── src/
└── docker-compose.yml
```

## What Exists Today

### Backend

The backend is a FastAPI app under `backend/app`.

Implemented areas:

- Budget CRUD
- Budget settings for period-generation behavior
- Income type CRUD
- Expense item CRUD and reordering
- Investment item CRUD with primary-line support
- Balance/account type CRUD
- Financial period generation, listing, detail view, locking, and deletion
- Period income updates
- Period expense updates
- Expense transaction entries per period expense
- Centralized period transaction ledger and migration/backfill for active periods
- Period balance viewing and transaction-backed movement details
- Period investment budget updates
- Investment transactions per period investment
- Savings transfer support via period income records
- Period summary endpoint with cumulative projected savings

The API is mounted under `/api`, with a health endpoint at `/api/health`.

### Frontend

The frontend is a React single-page app under `frontend/src`, currently built with Create React App (`react-scripts`).

Visible pages and flows:

- Dashboard
- Budgets list/create/edit/delete
- Budget periods page for:
- viewing existing periods
- viewing period-level financial summaries
- viewing cumulative projected savings
- deleting eligible future periods
- generating new periods
- jumping to budget setup
- Budget setup page with scrollable sections for:
- Budget Info
- Accounts
- Income Types
- Expense Items
- Investments
- Settings
- including auto-allocation of surplus budget into a primary investment line
- Period detail page for working with:
- Income actuals
- Expense actuals and notes
- Expense transactions
- Account balances
- Balance movement transaction details
- Investment budgets
- Investment transactions

The frontend talks to the backend through `/api` using Axios.

## Actual Tech Stack

Based on the checked-in code, the project currently uses:

- FastAPI
- SQLAlchemy ORM
- SQLite
- React 18
- Create React App (`react-scripts`)
- React Query
- React Router
- Axios
- Tailwind CSS
- Docker Compose
- Traefik labels on the frontend service

## Data Model

The main SQLAlchemy models currently present are:

- `Budget`
- `FinancialPeriod`
- `IncomeType`
- `PeriodIncome`
- `ExpenseItem`
- `PeriodExpense`
- `PeriodExpenseEntry`
- `BalanceType`
- `PeriodBalance`
- `InvestmentItem`
- `PeriodInvestment`
- `PeriodInvestmentTransaction`
- `PeriodTransaction`
- `PayType`
- `AppInfo`

Notes on the model:

- Period records are generated from budget configuration.
- Budgets can opt into automatically allocating new-period surplus to a primary investment line.
- Expense actuals can be tracked either directly or through child transaction entries.
- A centralized period transaction ledger now exists to support reconciliation and reporting.
- Balance movement is intended to be explained through transactions rather than edited directly.
- Investment periods track opening value, closing value, budgeted amount, and actual transaction totals.
- Investment items can be marked as the single active primary line for automatic savings allocation.
- Existing active periods are backfilled where possible so they can reconcile through transactions.

## Budgeting and Period Logic

Budget frequencies supported by validation and period generation are:

- `Weekly`
- `Fortnightly`
- `Monthly`

Expense scheduling currently supports:

- `Always`
- `Fixed Day of Month`
- `Every N Days`

Period generation currently requires:

- At least one income type
- At least one active expense item

When a period is generated, the backend creates:

- `PeriodIncome` rows for auto-included income types
- `PeriodExpense` rows for active expense items that occur in that period
- `PeriodBalance` rows for active balance types
- `PeriodInvestment` rows for active investment items

Additional current generation rules:

- If enabled in budget settings, positive starting surplus budget is automatically allocated to the active primary investment line.
- Period generation now normalizes incoming start dates to avoid timezone-related overlap bugs.
- Future period deletion is allowed only for unlocked future periods with no recorded actuals.

## Accounts and Investments

The current implementation goes beyond simple budgeting:

- A balance type can be marked as the primary account.
- Expense updates and expense entries can reduce the primary account balance.
- Income types can optionally credit a linked account.
- Savings transfers create special period income lines and move value between accounts.
- Investment items can optionally link to an account balance.
- Investment items can be designated as the primary savings destination for automatic surplus allocation.
- Investment transactions update both investment totals and, when linked, account balances.
- Account balance movement can be inspected from the period page through supporting transaction details.

Current terminology guidance:

- Use `Savings` for the user-facing idea of setting money aside.
- Use `Investment` for the technical record type and setup area already established in the codebase.
- Use `Primary investment line` when referring to the destination for automatic surplus allocation.

## Deployment Files Present

The repo includes:

- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`

`docker-compose.yml` defines:

- `backend`
- `frontend`
- a SQLite-backed named volume for backend data
- a local `dosh-net` network
- an external `frontend` network for Traefik

The frontend service includes Traefik labels for TLS and basic auth.

## Known State and Gaps

The repository is not fully polished from an operations perspective. These are important current-state notes:

- The frontend uses Create React App via `react-scripts`.
- The frontend Dockerfile builds `/app/build`, which matches Create React App rather than Vite.
- The frontend Dockerfile runs `npm install`, so it depends on `package-lock.json` behavior not being pinned in the repo.
- The frontend Docker build context is larger than necessary because the repo does not yet use a focused `.dockerignore`.
- Frontend builds currently pass with non-blocking lint warnings in `Dashboard.jsx` and `PeriodDetailPage.jsx`.
- Existing future periods created before the corrected surplus-allocation fix may still need data cleanup if their investment budgets were overstated.

## API Surface Overview

Current backend routers are implemented for:

- `budgets`
- `periods`
- `income_types`
- `expense_items`
- `investments`
- `expense_entries`
- `balance_types`
- `investment_transactions`
- `period_transactions`

## To Do

- Evaluate user-facing terminology shift from `Budget` -> `Book` and `Period` -> `Chapter`.
- Preferred direction: use `Book` and `Chapter` in frontend labels/navigation while keeping core finance terms such as `budget`, `actual`, `surplus`, `income`, and `expense` for clarity.
- If adopted, keep backend/API/database naming unchanged initially and treat this as a frontend/content relabel pass first.
- Consider a cleanup pass for already-generated future periods that were created before the corrected auto-surplus allocation logic.
- Add a `.dockerignore` so deploys do not send unnecessary frontend build context.
- Decide whether projected savings should stay investment-based everywhere or become a broader combined savings/planned-investment concept.
- Continue normalizing user-facing language around `Savings`, `Investment`, and `Primary investment line`.

## Summary

Dosh is currently a budget-and-period based personal finance app with:

- a substantial FastAPI backend
- a working Create React App frontend structure
- SQLite persistence
- support for budgets, periods, income, expenses, accounts, investments, and transaction-backed balance reconciliation

The product code is broader than a minimal budgeting tracker, but the repo still has some packaging and deployment inconsistencies that should be resolved before treating the Docker setup as production-ready.
