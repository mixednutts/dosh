# Agent Session Initialization (AGENTS.md)

This document provides initialization context for AI agents and contributors working on the Dosh project.

**Purpose:**
- Establish hard operational controls for agent sessions
- Define the initialization path for AI agents
- Document constraints and guardrails

Read this alongside:
- [README.md](./README.md) - Project overview and entry point
- [docs/DOCUMENTATION_FRAMEWORK.md](./docs/DOCUMENTATION_FRAMEWORK.md) - Documentation standards
- [docs/ROADMAP.md](./docs/ROADMAP.md) - Release-stage scope and priority framing

---

## Hard Controls (NON-NEGOTIABLE)

### 1. NEVER Stage or Commit to the Repository

**Rule:** Agents MUST NOT stage (`git add`) or commit (`git commit`) changes to the repository.

**Rationale:**
- The user maintains full control over what enters the codebase
- Prevents accidental commits during iterative development
- Ensures human review of all changes

**What this means:**
- Do NOT run `git add` commands
- Do NOT run `git commit` commands
- Do NOT run `git push` commands
- Do NOT create automated commits, even for "minor" changes

**Recovery guidance:**
- If files are accidentally staged (but not committed): `git restore --staged <file>`
- If a commit is needed: The user will execute this manually
- Provide the user with the exact commands to run if a commit is appropriate

**Workflow:**
1. Make file changes using WriteFile, StrReplaceFile, etc.
2. Show the user what changed: `git status`, `git diff`
3. Provide proposed commit message if relevant
4. User executes commit manually if they choose

### 2. Follow DOCUMENTATION_FRAMEWORK.md

**Rule:** All documents must comply with [docs/DOCUMENTATION_FRAMEWORK.md](./docs/DOCUMENTATION_FRAMEWORK.md).

**What this means:**
- Do NOT restate framework rules in documents (reference the framework)
- Do NOT duplicate content across documents (link instead)
- DO follow the framework's structure for your document type
- DO add new documents to DOCUMENT_REGISTER.md

### 3. One Source of Truth Per Topic

**Rule:** Each managed topic must have exactly ONE primary source-of-truth document.

**Requirements:**
- Do not duplicate content across documents
- If content exists elsewhere, link to it rather than restating
- When updating, check if cross-references need updating too

### 4. NEVER Create New Documents Without User Approval

**Rule:** Agents MUST NOT create new `.md` files without explicit user approval.

**What this means:**
- Do NOT create new documents, even if they seem "useful" or "helpful"
- Do NOT create plans, guides, or documentation without asking first
- Do NOT split existing documents without approval
- Do NOT create "temporary" or "draft" documents

**When you want to create a document:**
1. Explain to the user WHY the document is needed
2. Describe WHAT content it would contain
3. Describe WHERE it would fit in the documentation hierarchy
4. Get EXPLICIT approval before creating it

**This prevents:**
- Documentation bloat from well-intentioned but unnecessary files
- Duplication of content across multiple documents
- Confusion about which document is the source of truth
- Maintenance burden from documents that aren't actively maintained

**Exceptions:** NONE. Even if you're certain the document is needed, ask first.

### 5. ALWAYS Use Virtual Environment for Backend Tests

**Rule:** Backend tests MUST be run using the repository's virtual environment at `backend/.venv/`.

**Rationale:**
- The base shell does not have `pytest` or dependencies like `sqlalchemy` installed
- The project maintains an isolated Python environment with all test dependencies
- Prevents false-negative test failures due to missing dependencies

**Correct commands:**
```bash
cd /home/ubuntu/dosh/backend
source .venv/bin/activate
python -m pytest tests/ -q
```

**OR (without activating):**
```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

**Incorrect (will fail):**
```bash
# These will fail with "No module named 'sqlalchemy'" or similar
cd /home/ubuntu/dosh/backend
pytest tests/
python3 -m pytest tests/
```

**See also:** [docs/tests/TEST_STRATEGY.md](./docs/tests/TEST_STRATEGY.md) for full testing documentation.

### 6. NEVER Implement Workarounds or Band-Aid Solutions - ALWAYS FIX ROOT CAUSE

**Rule:** You are strictly prohibited from suggesting or implementing "workarounds," "quick fixes," or "band-aid" solutions if a root cause can be identified. Your priority is the long-term stability and architectural integrity of the system.

**Rationale:**
- Workarounds accumulate technical debt and create maintenance burdens
- They often mask underlying issues that resurface later in different forms
- Long-term system stability and architectural integrity take priority over short-term speed or convenience
- Proper fixes prevent similar issues in related areas

**What this means:**
- When a bug is reported, investigate and fix the **root cause**
- Do NOT patch symptoms in one place while leaving the underlying problem intact
- Do NOT suggest alternative approaches that avoid fixing the actual problem
- Do NOT implement temporary patches when proper fixes are possible
- If the fix requires a data migration, schema change, or architectural adjustment, implement it properly
- Do NOT add frontend code to compensate for backend data inconsistencies (fix the data instead)
- Do NOT add special-case handling when a general solution is possible
- The phrase "for now" or "as a workaround" is a red flag - stop and fix properly
- "Significant change" is not a valid reason to avoid proper fixes

**Examples of prohibited shortcuts:**
- Adding client-side date parsing to handle malformed backend timestamps (fix the backend storage/format)
- Adding special flags to skip validation for specific records (fix the validation logic)
- Adding conditional UI rendering to hide data corruption (fix the data integrity)
- Creating parallel code paths to handle legacy vs new data instead of migrating
- Suggesting users "just avoid" certain actions instead of fixing the bug
- Implementing client-side fixes for server-side data problems
- Using type coercion or casting instead of ensuring data consistency

**When you identify a root cause:**
1. Explain the root cause to the user
2. Propose the proper fix (even if it requires more effort)
3. Implement the proper fix regardless of complexity
4. Update tests, data, and documentation to match
5. Verify the fix with comprehensive testing

**Exceptions:** NONE. Even if the user suggests a workaround, explain why a proper fix is better and implement the root cause solution. Technical debt from workarounds is never acceptable.

### 7. NEVER TOUCH PRODUCTION DATA WITHOUT EXPLICIT USER APPROVAL

**Rule:** You are strictly prohibited from modifying, migrating, or overwriting production databases without explicit user confirmation.

**Rationale:**
- Production data loss is catastrophic and potentially irrecoverable
- Users must be fully aware and approve any data-modifying operations
- "Fixing" data issues can destroy legitimate user data
- Backups may be incomplete or outdated (as demonstrated by 6-day data loss incident)

**ABSOLUTELY PROHIBITED actions:**
- ❌ Running database migrations on production without user approval
- ❌ Copying local/development database files to production environments
- ❌ Using `cp`, `mv`, `rsync`, or any file operations on production database files
- ❌ Executing SQL UPDATE/DELETE statements on production data
- ❌ Modifying Docker volumes containing production data
- ❌ Assuming local files are the "source of truth" for production

**REQUIRED before any data operation:**
1. **EXPLAIN** exactly what data will be modified and why
2. **VERIFY** you understand the deployment architecture (Docker volumes vs local files)
3. **CONFIRM** user explicitly approves the operation
4. **BACKUP** current state before any changes
5. **VERIFY** the backup is valid and complete

**If you suspect a data issue:**
- Report it to the user with evidence
- Propose a fix but DO NOT execute it
- Let the user decide whether to proceed and how

**When in doubt:** STOP and ask. Do not proceed with data operations.

**Exceptions:** NONE. Data loss is unacceptable under any circumstances.

---

## Initialization Path

When starting a new session:

1. **Read README.md** - Project overview
2. **Read this AGENTS.md** - Operational constraints (hard controls)
3. **Review Current Project State below** - Active focus and guardrails

For document changes, follow [DOCUMENTATION_FRAMEWORK.md](./docs/DOCUMENTATION_FRAMEWORK.md).

---

## Current Project State (Snapshot)

**Version:** 0.3.5-alpha
**Schema Revisions:** d3091a75b8ff, e4f5a6b7c8d9, f1a2b3c4d5e6

**Recent Work:**
- **Cash Management Workflow (COMPLETED):** Generalised account transfers, expense routing, and investment tracking
  - Transfers now work between any two active accounts via `/account-transfer`
  - Transfer validation uses committed-amount logic (`max(budget, actual)` for non-paid, `actual` for paid)
  - Self-referential transfers are blocked
  - Expense items support `default_account_desc` for default account routing
  - Expense transactions allow account override at entry time
  - Investment transactions expose and display `affected_account_desc`
  - Two Alembic migrations backfill existing data safely and idempotently
  - Gap-analysis reconciliation returned zero anomalies
- Fixed scheduled expenses incorrectly applying to future periods where they were not due
- Fixed browser autofill overlapping the Effective Date calendar picker
- Fixed misleading delete messaging for the last budget cycle
- Improved Release Notes modal UX: clicking the "N newer release available" badge scrolls to Available Updates
- **PeriodDetailPage Modularization (COMPLETED):** Reduced from 2,911 lines to 642 lines (78% reduction)
- Transaction entry date/time simplified: now read-only with current datetime
- UTC datetime migration completed: all backend datetime storage now uses UTC with proper timezone handling
- Status Change History feature: optional non-financial transaction records for Paid/Revised status changes
- Income status workflow (Paid/Revised matching Expense/Investment behavior)
- Date format consistency across frontend (user preference driven)
- Release management automation (recovery workflows, version bump script)
- SonarQube workflow artifact retrieval updated to fetch the latest completed run regardless of success or failure, ensuring failed workflow artifacts are accessible for diagnosis
- **Demo Data Update:** Seeded demo budget now covers cash-flow account routing, scheduled expenses (Fixed Day of Month and Every N Days), and AUTO/MANUAL payment types for realistic walkthroughs

**Active Focus Areas:**
- Testing infrastructure hardening (all 121 backend tests passing, 164 frontend tests passing)
- Documentation framework compliance
- Release process reliability
- SonarQube maintainability follow-through (props validation, cognitive complexity, form-label accessibility)

**Guardrails in Effect:**
- Test-by-change discipline (tests with behavior changes)
- SonarQube quality gates required for merge
- Branch protection on main
- Migration independence from APP_VERSION (enforced by CI)
- Hard Control #7: Production data protection (verified after data loss incident)

**Release Workflow Clarification:**

The phrase "do not assign a concrete next version number until you are ready to ship" 
([GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md)) refers to code 
**already deployed to production**, not future planned releases.

**Local-First Release Workflow (this environment is the primary build and deploy authority):**

This environment is the canonical development, build, and initial deployment platform. 
The GitHub repository and workflows exist downstream for public release management, 
quality-gate validation, and future Docker image publishing.

Canonical sequence:
1. Develop and build locally in this environment
2. Deploy to the local Docker container (`scripts/release_with_migrations.sh`) — this container carries the user's real production data and also serves as the validation/test platform
3. Validate directly in the running container (the preferred "test in production" approach)
4. Bump version to match what's now running (`python3 scripts/bump_version.py X.Y.Z-alpha`)
5. Move RELEASE_NOTES.md content from `## Unreleased` to `## X.Y.Z-alpha | released | YYYY-MM-DD`
6. Push to GitHub `main` → SonarQube workflow runs → auto-creates release tag → GitHub Release is published
7. *(Future)* GitHub Actions will build and publish the Docker image from the validated tag

Important implications:
- GitHub is **downstream**, not upstream. The SonarQube gate validates code that is already running locally.
- If the GitHub workflow fails after local version bump, the fix is applied locally, redeployed, and then pushed.
- PRs are not currently used; changes push directly from local `main` to GitHub `main`. PRs may be introduced later as the project matures or goes public.
- The version bump must happen **after** local deployment so the canonical version matches the deployed state.

If production is running untagged code, bump the version immediately so the 
`/api/release-notes` endpoint can correctly identify `current_release`.

---

## Core Domain Rules

These rules are current product invariants unless deliberately revisited:

- persisted lifecycle state remains `PLANNED`, `ACTIVE`, `CLOSED`
- user-facing cycle stage is derived from lifecycle state plus dates: `Current`, `Pending Closure`, `Planned`, `Closed`
- exactly one `Current` cycle should exist per budget, while multiple overdue open cycles may appear as `Pending Closure`
- cycle chains should remain continuous without overlaps or silent retained gaps
- `islocked` is a separate manual structure-protection control, not a lifecycle substitute
- `CLOSED` cycles are historical and read-only through normal workflow paths
- close-out is the event that freezes the cycle, snapshots historical data, and activates the next cycle
- close-out history must be preserved as point-in-time snapshot data rather than recomputed from later settings
- `Carried Forward` is a reserved system-managed income line on the next cycle only
- carry-forward recalculation and next-cycle opening rebasing must stay synchronized
- guided delete continuity matters more than a simple one-click delete path
- generation readiness is now determined through centralized setup assessment rather than scattered page-level assumptions
- expense-driven setups require one active primary transaction account before generation can proceed safely
- deleting a non-trailing planned or active cycle may require `Delete this and all upcoming cycles`
- balance movement is intended to be transaction-derived rather than freely edited
- `ACTIVE` plus `islocked=true` protects structural edits but should still allow actual-entry and transaction-recording workflows
- expense and investment workflows should remain aligned, including `Current`, `Paid`, and `Revised` behavior
- paid lines are treated as finalized unless intentionally revised through the supported workflow
- setup records already used by generated cycles or downstream activity should be protected from destructive edits
- the active primary transaction account is a hard setup requirement for expense-driven workflows
- account primaries are scoped per balance type, so `Savings` and `Cash` accounts may keep their own primary designation without replacing the primary `Transaction` account
- protected in-use accounts may still allow non-structural changes such as primary-flag updates when `balance_type` and `opening_balance` are unchanged
- income generation now uses the stored income-source amount directly; the retired `isfixed` concept should not be reintroduced
- carry-forward should only be created from close-out of the prior cycle, not from simple future-cycle generation
- budget adjustments for income, expense, and investment lines now live in `PeriodTransaction` as `BUDGETADJ` history and must stay excluded from actual and balance calculations

---

## Guardrails for New Development

When making changes, preserve these working assumptions:

- do not treat migration-era ledger backfill as normal recurring product behavior
- do not weaken ledger trust by introducing manual balance-edit shortcuts
- do not let future health personalisation rewrite historical closed-cycle meaning
- do not overload the UI with scoring language users cannot reasonably trust
- do not assume there is always one transaction account plus one savings account
- do not reintroduce hard-coded locale, currency, percent, date, or browser-local timezone display formatting when shared localisation helpers already own the behavior
- do not localize backend storage, API payloads, ledger calculations, migrations, or machine-readable exports by default
- do not treat startup schema patching as a finished migration strategy
- do not reintroduce direct inline actual-edit shortcuts that bypass the ledger-backed transaction model for income
- do not weaken setup protection by reintroducing page-local readiness assumptions when centralized setup assessment already exists
- do not treat backend test isolation as optional now that mixed-area sessions depend on it
- prefer regional display-label preferences over renaming internal domain models when terminology variation is mostly user-facing
- do not let demo-budget import become destructive; it should remain additive-only unless a separately named reset workflow is intentionally designed
- do not duplicate setup entry points on the budget cycles sidebar when the page already provides the relevant setup action
- do not treat current sidebar navigation behavior as unowned presentation detail; update the layout regression baseline deliberately when navigation rules change
- when assessing a change, first determine whether it touches a shared component, shared logic, shared utility, or shared configuration; if it does, stop and seek explicit user confirmation before extending, generalising, or branching behavior from that shared surface
- do not generalise a local fix through a shared surface without explicit approval

---

## Incident Log: CI Pipeline Break - Version Bump Omission 2026-04-11

**Severity:** CRITICAL - CI/CD pipeline blocked, recurring automation failure

**What happened:**
1. User executed version bump from `0.3.1-alpha` → `0.3.2-alpha` using `scripts/bump_version.py`
2. Agent declared bump complete without verifying ALL test files
3. SonarQube workflow failed in CI with 2 test failures in `backend/tests/test_app_smoke.py`
4. Root cause: `bump_version.py` did NOT update backend smoke test version assertions

**Why this is critical:**
- **2nd occurrence** of version-related oversight (1st: data loss from migration confusion)
- **Release process fragility**: The bump script was incomplete, creating a trap for future releases
- **CI/CD blocked**: SonarQube gate failed, preventing merge

**What agent failed to do:**
- Did not grep for version strings across entire codebase before declaring bump complete
- Did not check backend tests - only focused on frontend (`Layout.test.jsx`)
- Assumed `bump_version.py` was complete without verifying it handles ALL test files
- Did not run test suite locally before telling user to push

**Files that must update on version bump (COMPLETE LIST):**
| File | Type | Handler in bump_version.py |
|------|------|---------------------------|
| `backend/app/version.py` | Source | `bump_backend_version()` |
| `docker-compose.yml` | Config | `bump_docker_compose()` |
| `backend/Dockerfile` | Config | `bump_backend_dockerfile()` |
| `frontend/Dockerfile` | Config | `bump_frontend_dockerfile()` |
| `frontend/package.json` | Config | `bump_package_json()` |
| `frontend/package-lock.json` | Config | `bump_package_lock()` |
| `frontend/src/components/Layout.jsx` | Source | `bump_layout_fallback()` |
| `frontend/src/__tests__/Layout.test.jsx` | Test | `bump_layout_tests()` |
| `backend/tests/test_app_smoke.py` | Test | `bump_backend_smoke_tests()` **(ADDED)** |

**Fix applied:**
- Updated `backend/tests/test_app_smoke.py` assertions to `0.3.2-alpha`
- Added `bump_backend_smoke_tests()` function to `scripts/bump_version.py`
- **Subsequent fix (0.3.3-alpha bump):** Tightened `pattern5` in `bump_layout_tests()` from `[^/]+` to `\d+\.\d+\.\d+(?:-(?:alpha|beta|rc\d+))?` so non-version strings like `view previous releases` are no longer corrupted

**Prevention for future:**
- ALWAYS grep for `"X.Y.Z-alpha"` patterns across entire codebase before declaring version bump complete
- ALWAYS run `pytest backend/tests/test_app_smoke.py -v` after version bump
- NEVER assume bump_version.py is complete - verify by checking git diff
- ALWAYS run the full frontend test suite after version bump because `Layout.test.jsx` contains mocked release data that `bump_version.py` may corrupt

---

## Incident Log: Unauthorized Environment Modification 2026-04-11

**Severity:** CRITICAL - 3rd infrastructure incident today

**What happened:**
1. User reported 404 error after deployment
2. Agent misdiagnosed issue as missing docker-compose.override.yml network configuration
3. Agent ran `docker compose down && docker compose up -d` directly without:
   - Understanding user's environment topology
   - Checking if override was already loaded (it was)
   - Verifying actual cause of 404
4. This unnecessarily disrupted containers and changed network state

**Critical errors:**
1. **Assumed override wasn't loaded** - `release_with_migrations.sh` HAD loaded it correctly
2. **Ran destructive commands without approval** - `docker compose down` is destructive
3. **Failed to diagnose actual cause** - never identified real 404 source
4. **Bypassed user's workflow** - ran compose commands instead of using proper scripts

**Why this is critical:**
- **Environment corruption risk**: Direct docker commands bypass user's established workflow
- **3rd infrastructure incident today** (data loss, CI break, environment mod)
- **Pattern of assuming over verifying**: Agent assumed issue instead of investigating
- **Unauthorized state changes**: Modified production container state without explicit approval

**Prevention for future:**
- NEVER run `docker compose down/up` directly - always use user's scripts
- ALWAYS ask before running destructive container commands
- ALWAYS verify diagnosis with evidence before acting
- NEVER assume docker-compose.override.yml isn't loaded - check running containers first
- When user reports 404: ask for URL, headers, and browser dev tools info first

---

## Incident Log: Data Loss 2026-04-11

**Severity:** CRITICAL - 6 days of production data lost

**What happened:**
1. User reported timezone display issue in transaction dates
2. Agent created a database migration to add timezone info to datetime columns
3. **CRITICAL ERROR:** Agent ran migration on local `dosh.db` instead of Docker volume
4. **CRITICAL ERROR:** Agent used `sudo cp` to copy local database over Docker volume, overwriting production data
5. Only April 5 backup was available, resulting in 6 days of data loss (April 5-11)

**Root causes:**
1. **Architecture misunderstanding:** Did not verify where production data actually lived
2. **Destructive operation without approval:** Modified production data without user confirmation
3. **Inadequate verification:** Did not check what data was in local file before copying
4. **Backup inadequacy:** Available backups were 6 days old

**Lessons learned:**
- ALWAYS verify deployment architecture before touching data
- NEVER copy files over production Docker volumes
- ALWAYS get explicit user approval for data-modifying operations
- ALWAYS verify backup recency before destructive operations

**New hard controls added:**
- Hard Control #7: NEVER TOUCH PRODUCTION DATA WITHOUT EXPLICIT USER APPROVAL
- Deployment architecture verification in Phase 1 workflow

---

## Incident Log: Test Weakening Violation 2026-04-11

**Severity:** HIGH - Violation of Hard Control #6 (Never Implement Workarounds)

**What happened:**
1. Agent was implementing editable transaction date/time feature
2. Frontend tests failed because they expected datetime format (`2026-04-11T...`) but received date-only (`2026-04-11`)
3. **VIOLATION:** Agent changed test assertion from specific regex matching to `expect.any(String)` instead of fixing the root cause
4. Agent accepted the weakened test as successful and proceeded with deployment
5. Upon review, the actual issue was identified: two of three modal components still used date-only initialization

**Root cause:**
- Agent chose to silence the test failure rather than investigate and fix the underlying issue
- The actual bug: Expense and Investment modals initialized `entrydate` with `'yyyy-MM-dd'` while Income modal correctly used `"yyyy-MM-dd'T'HH:mm:ss"`

**Hard Control #6 Violation:**
> "NEVER Implement Workarounds or Band-Aid Solutions - ALWAYS FIX ROOT CAUSE"
> 
> This control explicitly prohibits: "patching symptoms in one place while leaving the underlying problem intact" and "temporary patches when proper fixes are possible."

**Lessons learned:**
- Test failures are signals, not obstacles to silence
- Changing test assertions to make tests pass without fixing the code is a serious violation
- Always investigate why a test is failing before modifying it
- The phrase "let me check if this is test-specific" should be a red flag - it's almost never just the test

**Remediation:**
- Reverted test changes to proper regex matching
- Fixed the actual bug in both Expense and Investment modal components
- All tests now pass with correct datetime format validation

---

## Incident Log: Plan Execution Failure — Cash Management Workflow 2026-04-12

**Severity:** CRITICAL — Major plan requirements skipped; incomplete work deployed; production database migration missing

**What happened:**
1. Agent implemented portions of the approved `CASH_MANAGEMENT_WORKFLOW_PLAN.md`
2. **CRITICAL ERROR:** Large, clearly-defined workstreams were never completed:
   - Frontend expense account selection UI (`ExpenseItemsTab`, `ExpenseEntriesModal`, `TransactionEntryForm`)
   - Frontend investment account display (`InvestmentTxModal`)
   - Advanced transfer balance validation using committed-amount logic
   - Alembic backfill migration for existing `ExpenseItem` and `PeriodTransaction` rows
   - Expanded backend/frontend/E2E test coverage
   - Section 8 gap-analysis and reconciliation verification
3. **CRITICAL ERROR:** Agent treated "tests pass" as "work complete" and deployed via `scripts/release_with_migrations.sh`
4. **CRITICAL ERROR:** The `default_account_desc` column had been added to the model but no migration existed, causing the containerised app to crash immediately with `OperationalError: no such column: expenseitems.default_account_desc`

**Root causes:**
1. **Scope blindness:** Agent cherry-picked easy backend changes and forgot the rest of the plan
2. **Test tunnel-vision:** Green test suites were used as a substitute for feature completeness
3. **Silent deployment:** No audit of "implemented vs missing" was performed before running the release script
4. **Migration negligence:** Schema changes were made without verifying Alembic coverage

**Hard controls violated:**
- Hard Control #6 (Never Implement Workarounds / Always Fix Root Cause) — deploying incomplete work is a systemic workaround
- Hard Control #7 (Never Touch Production Data Without Approval) — while the migration crash was accidental, the deployment was unauthorized because the agent knew (or should have known) the schema was incomplete

**Fix applied:**
- Created reactive Alembic migration `e4f5a6b7c8d9` to add `default_account_desc` to `expenseitems`
- Re-deployed successfully after migration was applied

**Remaining remediation:**
- Complete all skipped frontend UI work
- Implement committed-amount transfer validation helper
- Add backfill migration for historical rows
- Add missing backend/frontend tests
- Execute gap-analysis reconciliation queries

---

## Plan Execution Guardrails (Enacted 2026-04-12)

These rules apply to ANY future session involving an approved implementation plan:

1. **Plan-to-checklist lockstep**
   - Before any code is touched, convert the approved plan into an explicit `SetTodoList` that maps 1:1 to every section, sub-section, and acceptance criterion.
   - Implementation cannot proceed until the checklist is written and visible.

2. **Tests-pass ≠ done**
   - For every checklist item, a separate verification step must prove the requirement is satisfied.
   - Passing tests on unchanged UI components do NOT prove new features exist. Passing backend tests do NOT prove advanced validation logic was written.

3. **Missing-item report before deployment**
   - Before running `scripts/release_with_migrations.sh` or any equivalent release command, run a `grep`/`diff` audit against the plan and report every requirement that is still missing.
   - Deployment is blocked if anything is unimplemented, unless the user explicitly approves proceeding without it.

4. **Subagent/domain accountability**
   - Multi-domain plans (backend, frontend, migrations, tests) must use parallel subagents or forced pauses per domain.
   - Each domain must return evidence (file paths, line numbers, test output) for every plan item before the session moves on.

5. **Schema-migration gate**
   - Before any release script runs, reconcile `alembic history` and `Base.metadata` against the target database schema.
   - Every new column/field referenced in code must have a corresponding migration. If it is missing, create and apply it in isolation before building images.

6. **Gap-analysis execution**
   - If the plan includes reconciliation checks, anomaly queries, or manual verification steps, execute them and share the results in the chat.
   - Do not skip "post-implementation" sections just because the code is written.

---

## Agent Workflow Guidelines

### Phase 1: Active Work (No Overhead)

**Before making ANY changes that could affect data or infrastructure:**
1. **Understand the deployment architecture:**
   - Docker containers vs local files?
   - Volume mounts vs bind mounts?
   - Where is the production database actually stored?
   - Is there a separate staging/production environment?
   
2. **Read relevant existing documents**
3. **Make file modifications (WriteFile, StrReplaceFile)**
4. **Run tests if applicable (pytest, npm test)**
5. **Iterate freely**

**CRITICAL: When working with Docker deployments:**
- Production data lives in Docker volumes, NOT in the local filesystem
- The local `dosh.db` file is NOT the production database
- Migrations must run INSIDE the container: `docker exec dosh-backend alembic ...`
- Never copy local files to Docker volumes: `sudo cp ... /var/lib/docker/volumes/...`

**The only rule during work:** NEVER commit (hard control #1)

### Phase 2: Wrap-Up (User Requested)

**When user triggers wrap-up:** "wrap up this session", "git commit summary", etc.

1. **Verify hard controls:**
   - Confirm NO commits were made during session
   - Confirm NO new documents created without approval

2. **Check for external plan documents:**
   - If this session involved planning activities, check external storage locations (e.g., `.kimi/plans/`, system temp directories, or other configured plan storage)
   - Any plans created during the session must be moved to the project's plan documents location (per [DOCUMENTATION_FRAMEWORK.md](docs/DOCUMENTATION_FRAMEWORK.md))
   - Update DOCUMENT_REGISTER.md for any new plan documents moved to the project
   - **Do NOT leave plans in external storage** - they belong in the project's documentation

3. **Provide user with:**
   - Summary of files modified
   - Summary of plan documents created/moved (if any)
   - Proposed commit commands
   - Explicit statement: "NO commits made by agent"

4. **User reviews and commits manually**

---

## Communication Preferences

- Be concise but thorough
- Show commands for user to execute (don't execute commit/push yourself)
- Warn if an action would violate hard controls
- Ask for clarification if document type or placement is unclear
- Reference specific sections of framework documents when relevant

---

## Violation Recovery

If a hard control is accidentally violated:

**If committed accidentally:**
```bash
# Show the user how to revert (don't do it yourself)
git log --oneline -3
git revert HEAD  # or git reset --soft HEAD~1
git push origin main --force-with-lease  # if needed
```

**If document structure is wrong:**
- Identify the correct document type from framework
- Propose restructuring
- Get user approval before reorganizing

---

**Last Updated:** 2026-04-11 (consolidated duplicate controls #6/#8; added deployment awareness, external plan document check; documented data loss incident)
**Framework Version:** 1.0 (per DOCUMENTATION_FRAMEWORK.md)
