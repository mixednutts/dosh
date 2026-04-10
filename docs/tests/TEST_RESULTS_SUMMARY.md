# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

## Latest Session: Status Change History Feature And UTC Datetime Test Fixes

Session outcomes verified in this run:

### Status Change History Feature (Implemented)

- Implemented budget-level `record_line_status_changes` setting (default: false)
- Created `build_status_change_tx()` in transaction_ledger.py following budget adjustment pattern
- Modified status endpoints (expense, income, investment) to create history records when setting enabled
- Added database migration `b71415822583` for new column
- Frontend displays status changes with "Status" badge in transaction details
- Records are non-financial (amount = 0), excluded from totals, cannot be deleted

**Files changed:**
- [models.py](/home/ubuntu/dosh/backend/app/models.py): Added `record_line_status_changes` column to Budget
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py): Added setting to BudgetOut, BudgetUpdate schemas  
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py): Added `TX_TYPE_STATUS_CHANGE`, `build_status_change_tx()` function
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py): Modified status endpoints to create history records when setting enabled
- [alembic/versions/b71415822583_add_record_line_status_changes_setting.py](/home/ubuntu/dosh/backend/alembic/versions/b71415822583_add_record_line_status_changes_setting.py): Database migration

### UTC Datetime Migration Test Fixes

- Fixed 14 remaining backend test failures caused by offset-naive vs offset-aware datetime comparisons after UTC migration
- Updated `cycle_management.py` to use `utc_now()` instead of `utc_now_naive()` for `period.closed_at`
- Updated `auto_expense.py` to use `app_now()` and handle naive datetime parameter conversion
- Updated `period_logic.py` with `_ensure_utc()` helper to normalize all datetime inputs for comparison
- Cleaned up `models.py` by removing redundant `_ensure_utc()` function and SQLAlchemy event listeners (now handled by `UTCDateTime` type decorator)
- Created production database backup before deployment: `backups/dosh_backup_pre_utc_fix_20260411_084801.db`
- Successfully deployed fixes to running container

### Backend Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Result:

- Full backend suite: **121 passed** (previously 107 passed, 14 failed)
- All datetime comparison failures resolved
- No regressions introduced

Files with meaningful backend updates:

- [models.py](/home/ubuntu/dosh/backend/app/models.py): Removed `_ensure_utc()` and event listeners; cleaned up imports; added `record_line_status_changes` column
- [cycle_management.py](/home/ubuntu/dosh/backend/app/cycle_management.py): Fixed `period.closed_at` to use `utc_now()`
- [auto_expense.py](/home/ubuntu/dosh/backend/app/auto_expense.py): Fixed scheduler and `run_date` timezone handling
- [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py): Added `_ensure_utc()` helper for datetime normalization
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py): Added `build_status_change_tx()` for status change history
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py): Modified status endpoints to create history records when setting enabled

### Deployment Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
docker compose up -d --build backend
docker compose ps
curl -s http://localhost:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- API requests serving correctly (200 OK responses)
- Production database integrity verified after deployment

### Failures and Resolutions

Observed issues during the session:

- 14 backend tests were failing with `TypeError: can't compare offset-naive and offset-aware datetimes`
- Root cause: Some code paths still used `utc_now_naive()` or `app_now_naive()` which returned naive datetimes
- SQLite stores datetimes without timezone info, but validators ensure timezone-aware objects on load

Resolution:

- Changed all datetime comparisons to use timezone-aware objects
- Added `_ensure_utc()` helper in `period_logic.py` to normalize naive datetimes
- Updated `auto_expense.py` to handle naive `run_date` parameters from tests
- Removed redundant event listeners from `models.py` (functionality covered by `UTCDateTime` type)

Final result:

- All 121 backend tests passing
- UTC datetime migration now fully complete and deployed
- Database backup created before deployment for rollback safety
- Status Change History feature fully implemented

---

## Previous Sessions

*[Previous session entries remain below - truncated for brevity]*
