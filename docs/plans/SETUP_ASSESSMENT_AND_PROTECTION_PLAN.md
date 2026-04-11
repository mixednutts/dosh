# Setup Assessment And Protection Plan

This document captures the setup-validity and downstream-protection plan that was shaped and implemented during the current session.

It exists separately so future sessions can understand the intended model without overloading the broader project overview documents.

Read this alongside:

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- [README.md](/home/ubuntu/dosh/README.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)

## Purpose

This plan defines how Dosh should assess whether budget setup is safe to use for downstream workflows, especially budget-cycle generation and later transactional activity.

It also records the decision that Dosh should not attempt to support every technically possible setup permutation. The goal is to support deliberate setup shapes while preventing downstream breakage.

## Core Direction

The key product decision from this session is:

- budget setup should remain editable
- budget-cycle generation should depend on a centralized setup assessment
- the app should explicitly identify blocking issues, warnings, and downstream-protected setup items
- once setup entities are in downstream use, destructive or structurally unsafe edits should be blocked

This is not a shift toward validating everything inside setup creation itself.

Instead, Dosh now treats setup assessment as a gate between configuration and downstream workflow use.

## Supported Model

The intended model is:

1. users configure budget setup sections
2. Dosh assesses whether the current setup shape is valid for the next workflow
3. Dosh blocks budget-cycle generation if required structural setup is missing
4. once periods or transactions depend on setup records, those records become protected according to their downstream role

## Current Central Assessment Contract

The backend now exposes a centralized setup assessment endpoint:

- `GET /api/budgets/{budgetid}/setup-assessment`

Current assessment output includes:

- `can_generate`
- `blocking_issues`
- `warnings`
- per-section setup state for:
- accounts
- income types
- expense items
- investment items

Per-item assessment now describes:

- whether the item is `in_use`
- why it is protected
- whether it can be deleted
- whether it can be deactivated
- whether its structure can still be edited safely

## Current Blocking Rule

The most important current generation rule hardened in this session is:

- if expense-driven workflows exist, one active account must be designated as the primary account before budget cycles can be generated

This same rule now protects later expense activity as well as generation.

## Current Protection Rules

### Accounts

- accounts in downstream use are protected from unsafe delete, deactivate, or structural changes
- setup-linked references such as linked income or investment accounts also prevent destructive account changes
- account usage should be surfaced clearly in setup rather than discovered only after a later failure

### Income Types

- income types used in generated cycles or recorded downstream activity are protected from destructive edits and deletion

### Expense Items

- expense items in downstream use are protected from delete and deactivation
- revision-style edits remain a supported workflow and should not be blocked unnecessarily

### Investment Lines

- investment lines used by generated cycles or later downstream activity are protected from destructive edits and deletion

## Current Frontend Direction

The setup assessment is now surfaced in multiple places:

- the budget setup page shows setup assessment state and section-level badges
- the budget-cycles generation page uses the centralized assessment rather than local assumptions
- setup tabs show protected or in-use state where relevant

Current section-level status intent:

- `Needs Attention` when generation blockers exist
- `Ready` when no blockers or downstream protections are present
- `N Protected` when setup is valid but some records are already in downstream use

## Guiding Constraints

These constraints should continue guiding future work:

- do not try to support every possible setup permutation if it creates downstream ambiguity
- do not rely on frontend-only warnings for setup states that can break backend workflows
- do not scatter one-off readiness checks across pages when one centralized setup assessment can answer the question
- do not allow destructive edits to setup records that would silently invalidate generated cycles or recorded activity
- do not treat budget-health personalisation as part of setup protection scope

## Remaining Extension Areas

The current pass established the basic pattern. Future work can extend it in these directions:

- richer consequence explanations for protected setup items
- stronger setup-summary visibility before users reach cycle generation
- reconciliation-aware messaging when setup changes are blocked after downstream activity
- more explicit distinction between harmless edits, revision-style edits, and structural edits

## Related Implementation Outcome

This plan is no longer just a proposal.

The central setup-assessment path, setup protection rules, setup-page assessment UI, and related tests were implemented during this session and should now be treated as the current product baseline.
