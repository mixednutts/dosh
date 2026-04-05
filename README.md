# Dosh

Dosh is a workflow-driven personal finance application with a FastAPI backend and a Vite-powered React frontend.

The current product supports guided budget setup, budget-cycle planning, income and expense tracking, transaction-backed balance movement, savings and investment planning, close-out workflows, a budget-overview calendar with bounded upcoming-cycle visibility, and a meaningful automated regression baseline.

## Start Here

This README is the top-level orientation document for the project.

Use it to understand:

- what Dosh is
- the current technical shape of the repository
- where to go next in the documentation set

For new AI or agent sessions:

1. read this file first
2. then read [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
3. then follow the links from there into the relevant roadmap, plan, history, or testing documents

## Project Snapshot

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React 18, Vite, React Query, React Router
- Testing: `pytest`, Jest with React Testing Library, Playwright
- Deployment path: Docker Compose
- Core product shape: guided budgeting, explicit budget-cycle lifecycle, ledger-backed transaction movement, close-out flow, setup assessment, budget health, and calendar-based timing visibility on the budget overview

## Repository Layout

```text
dosh/
├── README.md
├── backend/
├── frontend/
├── docker-compose.yml
└── docs/
    ├── DOCUMENTATION_FRAMEWORK.md
    ├── DOCUMENT_REGISTER.md
    ├── DEVELOPMENT_ACTIVITIES.md
    ├── CHANGES.md
    ├── PROJECT_CONTEXT.md
    ├── plans/
    └── tests/
```

## Documentation Map

### Start and Orientation

- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md): the working handoff document for future AI sessions and new development starts
- [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md): the map of project documents, ownership boundaries, and source-of-truth scope
- [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md): the generic documentation structure and governance framework

### Roadmap and Active Work

- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md): roadmap areas, activity groups, active work, and near-term backlog

### History and Decisions

- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md): implementation history, major decisions, and changes that should not be accidentally undone

### Plans

- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md): lifecycle, close-out, carry-forward, and continuity rules
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md): setup validity, readiness, and downstream protection rules
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md): budget health direction and staged health design
- [INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md](/home/ubuntu/dosh/docs/plans/INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md): transaction unification and ledger cleanup planning
- [AI_INSIGHT_ON_CLOSEOUT_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHT_ON_CLOSEOUT_PLAN.md): supporting close-out planning insight

### Testing

- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md): testing posture, priorities, and coverage intent
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md): planned test expansion and next coverage slices
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md): recent verification outcomes and recorded results

## Development Notes

- `Budget Cycle` is the preferred user-facing wording where it improves clarity, while backend naming may still use `period` for stability.
- The product direction is practical, supportive, and workflow-driven rather than accounting-heavy.
- Detailed roadmap, plan, and testing content should live in the next-layer documents above rather than growing this README.
