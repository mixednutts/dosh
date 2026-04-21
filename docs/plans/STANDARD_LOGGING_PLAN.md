# Standard Logging Framework Implementation Plan

> **Note:** This plan was implemented in `0.6.9-alpha` and then superseded in `0.6.10-alpha`. The backend now uses plain-text ISO-8601 logging instead of JSON. See [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for the latest logging implementation details.

## Scope

Backend only (FastAPI + Alembic + scripts). Frontend console logging is out of scope.

## Goals

1. Replace all ad-hoc `print()` statements with structured logging
2. Emit JSON-structured log records to stdout for Docker/container compatibility
3. Use syslog-style severity naming (`DEBUG`, `INFO`, `NOTICE`, `WARNING`, `ERROR`, `CRITICAL`)
4. Make log level configurable per environment via `LOG_LEVEL`
5. Reduce noise from third-party loggers (uvicorn.access, SQLAlchemy engine)
6. Add lightweight mutation/query logs to all API routers
7. Maintain backward compatibility with existing pytest `caplog` tests

## Default Log Level

**`INFO`** is the recommended default for `.env.example` and production.

Rationale:
- `DEBUG` would emit every SQL statement and query parameter, overwhelming Docker logs
- `INFO` captures application lifecycle events, mutations, and warnings without noise
- `WARNING` is too quiet — you would miss useful startup and request-summary logs
- Developers can override to `DEBUG` locally when needed

## Files to Create

### 1. `backend/app/logging_config.py`

Responsibilities:
- Read `LOG_LEVEL` from environment (default `INFO`)
- Configure a root logger with a `jsonlogger.JsonFormatter`
- Tune third-party logger levels:
  - `uvicorn.access` → `WARNING` (suppresses per-request access logs in production)
  - `sqlalchemy.engine` → `WARNING` (suppresses SQL echo)
  - `alembic` → `INFO` (keep migration progress visible)
- Expose `configure_logging()` callable
- Ensure the formatter outputs these fields:
  - `timestamp` (ISO 8601 UTC)
  - `level` (uppercase syslog name)
  - `logger` (fully qualified module name)
  - `message`
  - `pathname` and `lineno` (optional, for dev mode)

Format (single line JSON):
```json
{"timestamp": "2026-04-21T22:30:00Z", "level": "INFO", "logger": "app.routers.budgets", "message": "Budget created", "budget_id": 42}
```

### 2. `backend/tests/test_logging_config.py`

Tests:
- `configure_logging()` does not raise
- `INFO` level log emits valid JSON to a captured stream
- JSON contains required keys: `timestamp`, `level`, `logger`, `message`
- `LOG_LEVEL=DEBUG` sets root logger to `DEBUG`
- `LOG_LEVEL=invalid` falls back to `INFO` with a warning log

## Files to Modify

### 3. `backend/requirements.txt`

Add:
```
python-json-logger
```

### 4. `backend/app/main.py`

- Import `configure_logging` from `.logging_config`
- Call `configure_logging()` at module level **before** `app = FastAPI(...)`
- Add startup log after app creation:
  ```python
  logger.info("Dosh API starting", extra={"version": APP_VERSION, "schema_revision": get_schema_revision()})
  ```

### 5. `.env.example`

Add:
```bash
# Log level for structured JSON logging: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_LEVEL=INFO
```

### 6. `backend/entrypoint.sh` (or `entrypoint.sh` at repo root)

No changes required. Uvicorn stdout/stderr continue to flow into Docker logs.
Optionally pass `--log-level` if uvicorn's own startup logs need suppression, but `logging_config.py` should handle this via logger level tuning.

### 7. `backend/scripts/cutover_unified_transactions.py`

Replace all `print(...)` with:
```python
import logging
logger = logging.getLogger(__name__)
```
And `logger.info(...)` calls.

### 8. `backend/scripts/delete_invalid_investment_transactions.py`

Same pattern — replace `print()` with `logger.info()` / `logger.warning()`.

### 9. `backend/alembic/versions/d3091a75b8ff_add_utc_timezone_to_existing_datetimes.py`

Replace `print()` with `logger.info()`.

Note: Alembic migrations run inside the Alembic CLI context. Use stdlib `logging.getLogger(__name__)` directly; the Alembic `fileConfig` in `alembic.ini` already attaches handlers. However, since `logging_config.py` configures the root logger, it may double-handle if not careful. **Decision:** Use `logger.info()` in migrations and rely on the existing Alembic handler config. Do NOT import `logging_config` in migration files to avoid side effects.

### 10. All Router Modules (`backend/app/routers/*.py`)

Add to the top of each file:
```python
import logging
logger = logging.getLogger(__name__)
```

Logging guidelines per endpoint type:

| Endpoint Type | Level | Example |
|---------------|-------|---------|
| POST create | INFO | `logger.info("Budget created", extra={"budget_id": budget.budgetid})` |
| PUT update | INFO | `logger.info("Budget updated", extra={"budget_id": budget_id})` |
| DELETE | INFO | `logger.info("Budget deleted", extra={"budget_id": budget_id})` |
| GET list | DEBUG | `logger.debug("Listing budgets", extra={"count": len(budgets)})` |
| GET detail | DEBUG | `logger.debug("Budget detail fetched", extra={"budget_id": budget_id})` |
| Validation failure | WARNING | `logger.warning("Invalid request", extra={"errors": e.errors()})` |
| Unexpected error | ERROR | `logger.exception("Unhandled error")` |

Router files to update:
- `budgets.py`
- `periods.py`
- `income_types.py`
- `expense_items.py`
- `investments.py`
- `expense_entries.py`
- `income_transactions.py`
- `balance_types.py`
- `investment_transactions.py`
- `period_transactions.py`
- `health_matrices.py`

### 11. `backend/app/auto_expense.py`

This background scheduler has no logging today. Add `INFO` logs for:
- Scheduler start/stop
- Auto-expense creation counts
- Skipped reasons (at `DEBUG`)

### 12. `backend/app/release_notes.py`

Already has `logger = logging.getLogger(__name__)`. No changes needed except verify it continues to work under the new config.

## Implementation Sequence

1. Add dependency (`requirements.txt`)
2. Create `logging_config.py` + unit tests
3. Wire into `main.py`
4. Add `LOG_LEVEL` to `.env.example`
5. Convert scripts and migration prints
6. Add loggers to all router modules with minimal log lines
7. Add logging to `auto_expense.py`
8. Run backend test suite
9. Build and run Docker Compose locally
10. Verify JSON log output via `docker logs`

## Testing Strategy

- Unit: `test_logging_config.py` validates JSON structure and level behavior
- Regression: Run full `pytest` suite — no test should fail due to logging changes
- Integration: Start container, hit `/api/health`, inspect `docker logs` for JSON output
- Manual: Temporarily set `LOG_LEVEL=DEBUG`, verify router debug lines appear

## Acceptance Criteria

- [ ] `docker logs <container>` shows only JSON log lines (no raw `print` output)
- [ ] Every router module has a module-level `logger`
- [ ] `LOG_LEVEL=INFO` suppresses SQL query echo and per-request access logs
- [ ] `LOG_LEVEL=DEBUG` enables SQL query echo and router debug lines
- [ ] All backend tests pass (226+ tests)
- [ ] No `print()` statements remain in `backend/app/` or `backend/scripts/`
- [ ] Alembic migrations still emit progress info via their existing logger

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Double logging in Alembic | Do not import `logging_config` inside migration files; use stdlib logger directly |
| Uvicorn access log suppression too aggressive | Only suppress `uvicorn.access`; keep `uvicorn.error` at `INFO` for startup errors |
| pytest `caplog` fixture broken | `JsonFormatter` does not affect `caplog` — it captures LogRecord objects, not formatted strings |
| Docker log volume growth | This plan uses stdout only; log rotation is the host/container orchestrator's responsibility |

## Notes

- `python-json-logger` is the only new dependency. It is actively maintained and has no transitive dependencies.
- The existing `alembic.ini` logging configuration is left untouched. Alembic's `fileConfig` will continue to manage its own handlers for migration runs.
- `uvicorn` is started via `entrypoint.sh` outside of Python's `__main__`, so module-level logging configuration in `main.py` executes before any request handling begins.
