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
**Schema Revision:** 32e38f31a3bd (adds income status columns)

**Recent Work:**
- Income status workflow (Paid/Revised matching Expense/Investment behavior)
- Date format consistency across frontend (user preference driven)
- Release management automation (recovery workflows, version bump script)
- Migration safety validation (prevents version-dependent migrations)

**Active Focus Areas:**
- Testing infrastructure hardening
- Documentation framework compliance
- Release process reliability

**Guardrails in Effect:**
- Test-by-change discipline (tests with behavior changes)
- SonarQube quality gates required for merge
- Branch protection on main
- Migration independence from APP_VERSION (enforced by CI)

---

## Agent Workflow Guidelines

### Phase 1: Active Work (No Overhead)

**Just work normally:**
1. Read relevant existing documents
2. Make file modifications (WriteFile, StrReplaceFile)
3. Run tests if applicable (pytest, npm test)
4. Iterate freely

**The only rule during work:** NEVER commit (hard control #1)

### Phase 2: Wrap-Up (User Requested)

**When user triggers wrap-up:** "wrap up this session", "git commit summary", etc.

1. **Verify hard controls:**
   - Confirm NO commits were made during session
   - Confirm NO new documents created without approval

2. **Provide user with:**
   - Summary of files modified
   - Proposed commit commands
   - Explicit statement: "NO commits made by agent"

3. **User reviews and commits manually**

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

**Last Updated:** 2026-04-10
**Framework Version:** 1.0 (per DOCUMENTATION_FRAMEWORK.md)
