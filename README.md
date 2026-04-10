# Dosh

Dosh is a workflow-driven personal finance application with a FastAPI backend and a Vite-powered React frontend.

The current product supports guided budget setup, budget-cycle planning, income and expense tracking, optional scheduled Auto Expense automation, transaction-backed balance movement, savings and investment planning, close-out workflows, app-wide regional formatting with localized amount entry and operator-triggered calculator input, a budget-overview calendar with bounded upcoming-cycle visibility, and a meaningful automated regression baseline.

## Start Here

This README is the top-level orientation document for the project.

Use it to understand:

- what Dosh is
- the current technical shape of the repository
- where to go next in the documentation set

For new AI or agent sessions:

1. read this file first
2. then read [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
3. then read [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) to identify the release-stage scope
4. then follow the links from there into the relevant activity, plan, history, or testing documents

## Project Snapshot

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React 18, Vite, React Query, React Router
- Testing: `pytest`, Jest with React Testing Library, Playwright
- Deployment path: Docker Compose
- Docker Compose note: when working on Docker-related deployment or runtime setup, always check for [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) and apply it when present in the development environment
- Core product shape: guided budgeting, explicit budget-cycle lifecycle, ledger-backed transaction movement, close-out flow, setup assessment, budget health, app-wide localisation for regional display, date handling, amount input, and calendar-based timing visibility on the budget overview

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
- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md): the source of truth for semantic versioning, Alembic migrations, and release sequencing
- [GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md): the high-level operator guide for GitHub-managed releases, private-repo token setup, and the current manual deployment handoff
- [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md): app-facing release notes shown in Dosh and maintained in the repo
- [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md): the map of project documents, ownership boundaries, and source-of-truth scope
- [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md): the generic documentation structure and governance framework

### Roadmap and Active Work

- [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md): the release-shaped roadmap across beta, Phase 2, and longer-view opportunities
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md): roadmap areas, activity groups, active work, and near-term backlog

### History and Decisions

- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md): implementation history, major decisions, and changes that should not be accidentally undone

### Plans

- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md): lifecycle, close-out, carry-forward, and continuity rules
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md): setup validity, readiness, and downstream protection rules
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md): budget health direction and staged health design
- [INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md](/home/ubuntu/dosh/docs/plans/INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md): transaction unification and ledger cleanup planning
- [INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md](/home/ubuntu/dosh/docs/plans/INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md): implemented inline arithmetic amount-entry scope, parsing boundaries, and modal UX decisions
- [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md): implemented regional formatting, numeric masked amount input, operator-triggered calculator behavior, and budget preference resolution boundaries
- [AI_INSIGHT_ON_CLOSEOUT_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHT_ON_CLOSEOUT_PLAN.md): supporting close-out planning insight
- [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md): GitHub-managed release-tagging, release publishing, and in-app release-info workflow
- [AUTO_EXPENSE_PLAN.md](/home/ubuntu/dosh/docs/plans/AUTO_EXPENSE_PLAN.md): budget-level Auto Expense rules, AUTO/MANUAL eligibility, scheduler behavior, and migration expectations

### Testing

- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md): testing posture, priorities, and coverage intent
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md): planned test expansion and next coverage slices
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md): recent verification outcomes and recorded results

## Development Notes

- `Budget Cycle` is the preferred user-facing wording where it improves clarity, while backend naming may still use `period` for stability.
- The product direction is practical, supportive, and workflow-driven rather than accounting-heavy.
- The current release baseline is `0.3.1-alpha`, displayed in the UI as `v0.3.1-alpha`.
- Versioning, migration naming, and release-step expectations are defined in [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md).
- Published GitHub Releases are now the app-facing source for in-app release information, while [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) remains the repo-managed source used to generate those release bodies.
- Detailed roadmap, plan, and testing content should live in the next-layer documents above rather than growing this README.

## SonarQube

The repository includes a GitHub Actions workflow at [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml) and scanner settings in [sonar-project.properties](/home/ubuntu/dosh/sonar-project.properties).

To enable analysis in your GitHub repository:

1. create the project in SonarQube
2. add a repository variable named `SONAR_HOST_URL`
3. add a repository variable named `SONAR_PROJECT_KEY`
4. add a repository secret named `SONAR_TOKEN`

The workflow generates:

- Python coverage at `backend/coverage.xml`
- JavaScript coverage at `frontend/coverage/lcov.info`

Those reports are then consumed by SonarQube during the scan step.
