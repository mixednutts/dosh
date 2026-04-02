# Dosh

Dosh is a personal finance application with a FastAPI backend and a Create React App frontend. The current codebase supports budget setup, period generation, income and expense tracking, account balance tracking, and investment tracking.

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
- Income type CRUD
- Expense item CRUD and reordering
- Investment item CRUD
- Balance/account type CRUD
- Financial period generation, listing, detail view, locking, and deletion
- Period income updates
- Period expense updates
- Expense transaction entries per period expense
- Period balance viewing and movement updates
- Period investment budget updates
- Investment transactions per period investment
- Savings transfer support via period income records

The API is mounted under `/api`, with a health endpoint at `/api/health`.

### Frontend

The frontend is a React single-page app under `frontend/src`, currently built with Create React App (`react-scripts`).

Visible pages and flows:

- Dashboard
- Budgets list/create/edit/delete
- Budget detail page with tabs for:
- Periods
- Income Types
- Expense Items
- Investments
- Accounts
- Settings
- Period detail page for working with:
- Income actuals
- Expense actuals and notes
- Expense transactions
- Account balances
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
- `PayType`
- `AppInfo`

Notes on the model:

- Period records are generated from budget configuration.
- Expense actuals can be tracked either directly or through child transaction entries.
- Balance movements can be updated manually and are also adjusted by some income, expense, and investment actions.
- Investment periods track opening value, closing value, budgeted amount, and actual transaction totals.

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

## Accounts and Investments

The current implementation goes beyond simple budgeting:

- A balance type can be marked as the primary account.
- Expense updates and expense entries can reduce the primary account balance.
- Income types can optionally credit a linked account.
- Savings transfers create special period income lines and move value between accounts.
- Investment items can optionally link to an account balance.
- Investment transactions update both investment totals and, when linked, account balances.

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
- The README should not assume production readiness without first fixing and validating the container build/runtime path.

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

## To Do

- Evaluate user-facing terminology shift from `Budget` -> `Book` and `Period` -> `Chapter`.
- Preferred direction: use `Book` and `Chapter` in frontend labels/navigation while keeping core finance terms such as `budget`, `actual`, `surplus`, `income`, and `expense` for clarity.
- If adopted, keep backend/API/database naming unchanged initially and treat this as a frontend/content relabel pass first.

## Summary

Dosh is currently a budget-and-period based personal finance app with:

- a substantial FastAPI backend
- a working Create React App frontend structure
- SQLite persistence
- support for budgets, periods, income, expenses, accounts, and investments

The product code is broader than a minimal budgeting tracker, but the repo still has some packaging and deployment inconsistencies that should be resolved before treating the Docker setup as production-ready.
