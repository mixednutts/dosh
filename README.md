# Dosh

Dosh is a personal finance application with a FastAPI backend and a Create React App frontend. The current codebase supports guided budget setup, period planning, income and expense tracking, account balance tracking, savings/investment planning, and transaction-backed reconciliation.

This README reflects the repository as it exists now, not the originally intended design.

## Purpose

This document is the main current-state overview for Dosh.

Its purpose is to give future sessions and contributors a reliable snapshot of:

- what the app currently is
- what features already exist
- what technical shape the codebase currently has
- what broader roadmap areas are visible from the repo today

For budget health scoring and roadmap context, also read [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md).

For a focused view of current and near-term work, read [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md).

For the detailed budget-cycle lifecycle and close-out workflow plan that now informs period management, read [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md).

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
- Budget health metrics Phase 1 endpoint with explainable evidence payload
- Budget-level health personalisation values that tune thresholds and weighting
- Income type CRUD
- Expense item CRUD and reordering
- Investment item CRUD with primary-line support
- Balance/account type CRUD
- Financial period generation, listing, detail view, locking, and deletion
- Explicit budget cycle lifecycle management with `PLANNED`, `ACTIVE`, and `CLOSED` states
- Period close-out preview and close-out completion workflow
- Close-out snapshot storage for historical health and totals
- Period income updates
- Period expense updates
- Expense transaction entries per period expense
- Centralized period transaction ledger and migration/backfill for active periods
- Period balance viewing and transaction-backed movement details
- Period investment budget updates
- Investment transactions per period investment
- Investment status workflow matching expenses with `Current`, `Paid`, and `Revised`
- Savings transfer support via period income records
- Period summary endpoint with cumulative projected savings
- Guided period deletion options including `delete this and all upcoming cycles`

The API is mounted under `/api`, with a health endpoint at `/api/health`.

### Frontend

The frontend is a React single-page app under `frontend/src`, currently built with Create React App (`react-scripts`).

Visible pages and flows:

- Budgets list/create/edit/delete
- Budgets page as the main landing page and primary overview surface
- budget-level summary cards including:
- current period range
- days remaining in the active period
- current balance summary showing each active-period account closing balance and total
- historical period counts
- budget health score and momentum indicator
- current-period health check with traffic-light status and detail modal
- budget health details modal with evidence breakdown
- inline edit and delete actions without duplicate setup links
- Budget periods page for:
- viewing existing periods
- viewing period-level financial summaries
- viewing cumulative projected savings
- deleting eligible planned or active periods through guided delete options
- generating new periods
- showing period ranges in a fixed two-line format for consistent scanning
- showing budget-cycle lifecycle state and linking directly to the cycle details from the period column
- using `Details` rather than `Open` for the primary period action
- Budget setup page with scrollable sections for:
- Budget Info
- Accounts
- Income Types
- Expense Items
- Investments
- Personalisation
- Settings
- including auto-allocation of surplus budget into a primary investment line
- with quiet autosave for Budget Info and Personalisation updates
- Period detail page for working with:
- Income actuals
- Expense actuals and notes
- Expense transactions
- Account balances
- Balance movement transaction details
- Investment budgets
- Investment transactions
- investment paid and revised status controls
- active-cycle close-out preview and completion
- historical close-out snapshot review for closed cycles

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
- Budgets now also store health personalisation values including expense tolerance, deficit thresholds, revision sensitivity, savings priority, and period criticality preference.
- Budgets now also store whether manual budget-cycle locking is enabled for structural budget edits.
- Expense actuals can be tracked either directly or through child transaction entries.
- A centralized period transaction ledger now exists to support reconciliation and reporting.
- Budget health is currently computed from existing budget, period, and expense data, and closed cycles now also persist a point-in-time close-out health snapshot.
- The overall budget health score now includes the dedicated current-period assessment as an explicit weighted input.
- Balance movement is intended to be explained through transactions rather than edited directly.
- Financial periods now persist explicit cycle state and closed timestamp.
- Investment periods track opening value, closing value, budgeted amount, actual transaction totals, and lifecycle status matching expense workflow.
- Period income rows can now include protected system-managed lines such as `Carried Forward`.
- A dedicated close-out snapshot table stores comments, goals, carry-forward result, health snapshot data, and totals snapshot data for each closed cycle.
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
- User-facing terminology is now trending toward `budget cycle` while backend naming still uses `period` for stability.
- The app now treats lifecycle state as explicit persisted data rather than deriving everything from dates alone.
- There should only ever be one `ACTIVE` cycle for a budget.
- `CLOSED` cycles are intended to be read-only from normal workflow paths.
- Closing a cycle can create or update a protected `Carried Forward` income line in the next cycle using budget-side values only.
- Guided deletion can require deleting a selected cycle and all upcoming cycles in order to preserve continuity.
- Period status and budget health evaluation now use the app timezone rather than UTC-only runtime defaults.
- There should only ever be one user-facing current cycle for a budget; overflow handling is only relevant to future and historical groupings.

## Current Navigation And Visual Direction

The current sidebar is no longer an all-budgets drilldown tree. It now follows a focused workflow pattern:

- a single global `Budgets` entry
- a compact budget chooser
- a `Current Budget` context panel when working inside a budget
- period shortcuts for `Current`, `Upcoming`, and `Recent`
- a desktop collapse mode to reclaim screen width

Important current interaction rules:

- the sidebar should emphasize the budget the user is actively working in rather than expanding every budget at once
- the `More` affordance for hidden period shortcuts is contextual and should be muted when the user is already on that budget's period listing page
- duplicate setup or edit affordances on the same screen should be avoided when one clear path already exists

The current visual system has also shifted away from all-purpose green branding:

- muted teal is now the primary navigation and brand accent
- green is reserved for positive or success meaning
- dark mode uses slate and ink surfaces rather than dark emerald fills

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
- Use `Budget Cycle` in the UI where that wording makes the workflow clearer, while preserving backend `period` naming unless a stronger reason emerges.
- Use `Primary investment line` when referring to the destination for automatic surplus allocation.
- In budget health wording, be explicit when the value being assessed is deficit rather than positive surplus.

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
- `TZ=Australia/Sydney` on both services so visible app time aligns with the expected local timezone

The frontend service includes Traefik labels for TLS and basic auth.

## Known State and Gaps

The repository is not fully polished from an operations perspective. These are important current-state notes:

- The frontend uses Create React App via `react-scripts`.
- The frontend Dockerfile builds `/app/build`, which matches Create React App rather than Vite.
- The frontend Dockerfile runs `npm install`, so it depends on `package-lock.json` behavior not being pinned in the repo.
- Focused `.dockerignore` files now exist for both frontend and backend build contexts.
- Frontend builds currently pass cleanly without the earlier lint warnings.
- Budget health is a Phase 1 implementation and should be treated as an explainable first slice rather than a finished scoring system.
- The user-facing budget health presentation should stay free of internal development terminology such as phase labels.
- Budget health personalisation exists today, but the wording and explanation of threshold interaction should keep being refined from real usage.

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

Additional budget route surface now includes:

- budget health summary/detail via `/budgets/{budgetid}/health`

## To Do

- Evaluate user-facing terminology shift from `Budget` -> `Book` and `Period` -> `Chapter`.
- Preferred direction: use `Book` and `Chapter` in frontend labels/navigation while keeping core finance terms such as `budget`, `actual`, `surplus`, `income`, and `expense` for clarity.
- If adopted, keep backend/API/database naming unchanged initially and treat this as a frontend/content relabel pass first.
- Decide whether projected savings should stay investment-based everywhere or become a broader combined savings/planned-investment concept.
- Continue normalizing user-facing language around `Savings`, `Investment`, and `Primary investment line`.
- Continue refining budget health scoring semantics, weighting, and evidence language from real usage feedback.
- Continue refining health personalisation wording so each control clearly names the exact financial value being assessed.
- Decide whether the deficit concern controls need an even clearer combined explanation when both percentage and dollar thresholds are set.
- Decide whether app timezone should remain deployment-driven through `TZ` or eventually become a user-configurable setting.
- Extend the budget health momentum model so corrective action in future periods can influence the visible trend more directly.
- Assess a revision reason code pick list when revising an expense item, especially if revision reporting becomes more structured later.

## Development Roadmap

The next larger product milestones currently identified for Dosh are:

- Reporting & Analysis
- Reconciliation
- Period Close Out

Budget health metrics work is staged separately in [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md) so future sessions can distinguish the current Phase 1 implementation from later close-out and configuration work.

Current status:

- `Budget Health Metrics` exists today as a roadmap item with an implemented `Phase 1` slice.
- Phase 1 should be treated as the initial explainable metrics release, not the finished end-state.
- The shipped UI should present budget health as a normal product feature, while phase terminology stays in development documentation only.

### Reporting & Analysis

This milestone should deepen the app's ability to explain financial activity and trends over time.

Likely focus areas:

- ledger-backed reporting views across periods
- richer period and dashboard summaries
- clearer surplus, savings, and investment trend analysis
- reporting that helps users understand what changed and why

### Reconciliation

This milestone should build on the centralized ledger and balance movement detail work so reconciliation becomes a first-class workflow.

Likely focus areas:

- stronger account-by-account reconciliation views
- clearer audit trails with filtering and source grouping
- running totals and discrepancy detection
- possible bank statement import and OCR-assisted matching, if that proves practical and reliable

### Period Close Out

This milestone should support end-of-period review and make each period feel complete before moving on.

Likely focus areas:

- close-out performance metrics
- end-of-period review flow
- commentary and notes on what happened during the period
- use of revision comments and final-state indicators in later reporting

## Summary

Dosh is currently a budget-and-period based personal finance app with:

- a substantial FastAPI backend
- a working Create React App frontend structure
- SQLite persistence
- support for budgets, periods, income, expenses, accounts, investments, and transaction-backed balance reconciliation

The product code is broader than a minimal budgeting tracker, but the repo still has some packaging and deployment inconsistencies that should be resolved before treating the Docker setup as production-ready.
