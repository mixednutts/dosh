# Agent Session Initialization (AGENTS.md)

This document provides initialization context for AI agents and contributors working on the Dosh project.

**Purpose:**
- Establish hard operational controls for agent sessions
- Define the initialization path for AI agents
- Document constraints and guardrails

Read this alongside:
- [README.md](./README.md) - Project overview and entry point
- [docs/DOCUMENTATION_FRAMEWORK.md](./docs/DOCUMENTATION_FRAMEWORK.md) - Documentation standards
- [docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md) - Current operational state

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
3. **Read PROJECT_CONTEXT.md** - Current state and active focus

For document changes, follow [DOCUMENTATION_FRAMEWORK.md](./docs/DOCUMENTATION_FRAMEWORK.md).

---

## Current Project State (Snapshot)

**Version:** 0.3.1-alpha
**Schema Revision:** b71415822583 (adds status change history setting)

**Recent Work:**
- **PeriodDetailPage Modularization (COMPLETED):** Reduced from 2,911 lines to 642 lines (78% reduction)
  - Phase 1A: Extracted transaction modals to `components/transaction/` (7 components)
  - Phase 1B: Extracted action modals to `components/modals/` (4 components)
  - Phase 2: Extracted utility functions to `utils/` (3 modules)
  - Phase 3: Extracted section components to `components/period-sections/` (4 components)
  - Post-deploy fix: Removed legacy `isfixed` column from database (pre-baseline schema artifact)
- Transaction entry date/time simplified: now read-only with current datetime, removed editable calendar picker
- UI layout refinements: widened Add Remaining/Full button to match amount field width
- UTC datetime migration completed: all backend datetime storage now uses UTC with proper timezone handling
- Fixed 14 backend test failures from datetime comparison issues after UTC migration
- Status Change History feature: optional non-financial transaction records for Paid/Revised status changes
- Income status workflow (Paid/Revised matching Expense/Investment behavior)
- Date format consistency across frontend (user preference driven)
- Release management automation (recovery workflows, version bump script)

**Active Focus Areas:**
- Testing infrastructure hardening (all 121 backend tests passing, 164 frontend tests passing)
- Documentation framework compliance
- Release process reliability

**Guardrails in Effect:**
- Test-by-change discipline (tests with behavior changes)
- SonarQube quality gates required for merge
- Branch protection on main
- Migration independence from APP_VERSION (enforced by CI)
- Hard Control #7: Production data protection (verified after data loss incident)

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
