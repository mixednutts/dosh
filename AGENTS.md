# Dosh Agent Notes

## Session Start (Read in Order)

1. **README.md** → Project overview and entry point
2. **PROJECT_CONTEXT.md** → Working handoff document (primary source for current state)
3. **ROADMAP.md** → Release-stage scope and priority framing
4. **CHANGES.md** → Product decisions that should not be accidentally undone

## Agent-Specific Workflows

### Database Migrations

**Critical:** Migration files are created **inside the Docker container** by default. You MUST persist them to the host filesystem.

Use the helper script:
```bash
./scripts/db-migrate.sh "description_of_changes"
```

Or manually:
```bash
# 1. Generate migration (creates file in container)
docker compose exec backend alembic revision -m "add_new_column" --autogenerate

# 2. Copy to host (CRITICAL STEP)
LATEST=$(docker compose exec backend sh -c "ls -t /app/alembic/versions/*.py | head -1")
docker compose cp "backend:$LATEST" "./backend/alembic/versions/"

# 3. Run migration
docker compose exec backend alembic upgrade head
```

See [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md) and [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md) for full migration rules.

### Date Format Consistency

When displaying dates, **do not use hardcoded presets**. Call format functions without preset parameter to respect user's date format setting:

```javascript
// DO: Uses user's date format preference
formatDate(date)
formatDateRange(start, end)

// DON'T: Ignores user setting
formatDate(date, 'short')
formatDate(date, 'compact')
formatDate(date, 'medium')
```

See [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md) for full localisation architecture.

### High-Risk Areas (Extra Care Required)

From [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md) — treat changes that touch these areas with extra care:
- Lifecycle transitions and close-out
- Carry-forward and opening rebasing
- Delete continuity
- Transaction-backed balances and ledger trust
- Budget-adjustment history and revision-state capture
- Setup-revision history and revision numbering
- Expense and investment paid/revised behavior

### SonarQube Workflow

Inspect latest analysis before planning cleanup:
```bash
./scripts/fetch_latest_sonar_artifact.sh [branch-name]
```

Artifacts include: `sonar-summary.md`, `sonar-issues-full.json`, `sonar-component-metrics.json`

See [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md) CI Operational Notes section for full details.

### Testing (Test-by-Change Discipline)

Dosh requires **test-by-change**: meaningful workflow changes must include tests.

**Quick test commands:**

```bash
# Backend (using venv pytest)
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/test_status_workflows.py -v
.venv/bin/pytest tests/test_auto_expense_migration.py -v
.venv/bin/pytest tests/ -v  # Full suite

# Frontend
npm test -- PeriodDetailPage.test.jsx
npm test
```

**When tests are required:**
- New features → Add regression tests
- Bug fixes → Add test that would have caught the bug  
- Behavior changes → Update/add tests
- Refactors → Ensure existing tests pass

See [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) for full testing guidance.

## Quick Reference Links

| Topic | Canonical Document |
|-------|-------------------|
| Lifecycle and close-out rules | [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) |
| Migration and versioning | [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md) + [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md) |
| Localisation and formatting | [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md) |
| Testing posture | [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) |
| Setup assessment and protection | [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) |
| Budget health | [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md) |
| Active roadmap | [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) |

## Documentation Rules (From [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md))

- One document = one primary source of truth
- Cross-link rather than duplicate maintained content
- Update [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md) when documents are added/moved/renamed
- Keep headings stable — other documents may refer to them
