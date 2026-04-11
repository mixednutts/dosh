# Frontend Modularisation Plan

This document defines the systematic extraction strategy for improving frontend code modularity, reducing file complexity, and addressing SonarQube maintainability hotspots.

It exists as a dedicated implementation reference for the Quality > Consistency roadmap area.

Read this alongside:
- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)

## Summary

Implement phased modularisation of oversized frontend page components, extracting reusable modal components, utility functions, and business logic into focused modules.

Target files (in priority order):
1. PeriodDetailPage.jsx (2,911 lines) -> ~900 lines
2. BudgetsPage.jsx (1,408 lines) -> ~730 lines
3. BudgetPeriodsPage.jsx (604 lines) -> ~350 lines
4. BalanceTypesTab.jsx (431 lines) -> ~180 lines
5. ExpenseItemsTab.jsx (373 lines) -> ~220 lines

## Phase 1: PeriodDetailPage.jsx Extraction

### 1.1 Transaction Modal Components

Extract to `components/transaction/`:

| Component | Source Lines | Description |
|-----------|--------------|-------------|
| TransactionWorkflowModal.jsx | ~650-800 | Main transaction workflow wrapper |
| TransactionEntryForm.jsx | ~550-630 | Entry form with quick-fill logic |
| TransactionListPanel.jsx | ~442-487 | Transaction list display |
| IncomeTransactionsModal.jsx | ~798-878 | Income-specific modal |
| ExpenseEntriesModal.jsx | ~950-1042 | Expense entry modal |
| InvestmentTxModal.jsx | ~1044-1136 | Investment transaction modal |

### 1.2 Status and Action Components

Extract to `components/status/`:

| Component | Source Lines | Description |
|-----------|--------------|-------------|
| ProgressStatusPill.jsx | ~726-775 | Status pill with progress bar |
| ConfirmPaidModal.jsx | ~777-796 | Confirmation modal for paid status |

### 1.3 Budget Adjustment Components

Extract to `components/budget/`:

| Component | Source Lines | Description |
|-----------|--------------|-------------|
| BudgetAdjustmentModal.jsx | ~1137-1199 | Budget adjustment workflow |

### 1.4 Balance Components

Extract to `components/balance/`:

| Component | Source Lines | Description |
|-----------|--------------|-------------|
| BalanceTransactionsModal.jsx | ~880-947 | Balance transaction details |

### 1.5 Close-Out Components

Extract to `components/closeout/`:

| Component | Source Lines | Description |
|-----------|--------------|-------------|
| CloseoutModal.jsx | ~2000+ | Close-out workflow modal |

### 1.6 Add Line Modals

Extract to `components/period-lines/`:

| Component | Target Directory | Description |
|-----------|------------------|-------------|
| AddIncomeLineModal.jsx | components/period-lines/ | Add income line to budget cycle |
| AddExpenseLineModal.jsx | components/period-lines/ | Add expense line to budget cycle |

**Rationale:** These modals share a common purpose - adding new line items to an existing budget cycle (period) rather than managing setup items. Grouping by function (period line entry) rather than by type (income/expense) provides clearer domain boundaries. If future requirements allow ad-hoc investment line addition, it would fit naturally here.

### 1.7 Utility Extractions

Extract to `utils/`:

| Module | Functions | Target Lines |
|--------|-----------|--------------|
| transactionHelpers.js | balanceTransactionDelta, balanceTransactionLabel, getTransactionModalConfig, buildTransactionDisplayResolver | ~150 |
| periodCalculations.js | calcNextDue, freqLabel, isScheduledExpense, getPositiveRemainingValue, getIncomeSurplusContribution, getOutflowSurplusContribution | ~120 |
| iconButtons.js | iconButtonClassName, ActionIconButton, DeleteActionButton, EmptyActionSlot, BudgetAmountCell | ~80 |

## Phase 2: BudgetsPage.jsx Extraction

### 2.1 Utility Extractions

| Module | Functions | Target Lines |
|--------|-----------|--------------|
| healthDisplay.js | healthDotClass, healthToneClass, healthCircleClass, momentumToneClass, MomentumIcon, formatMomentumDelta, healthStatusLabel | ~80 |
| calendarBuilder.js | buildCalendarEvents, expenseOccurrencesInRange, buildMonthGrid | ~150 |
| periodGroupings.js | groupPeriods, formatPeriodRange | ~50 |

### 2.2 Component Extractions

| Component | Target Directory | Description |
|-----------|------------------|-------------|
| BudgetCalendar.jsx | components/calendar/ | Calendar grid with events |
| PeriodSummaryCard.jsx | components/period/ | Period summary display |

## Phase 3: BudgetPeriodsPage.jsx Extraction

| Component | Target Directory | Description |
|-----------|------------------|-------------|
| PeriodGenerateForm.jsx | components/period/ | Cycle generation form |
| PeriodSummaryRow.jsx | components/period/ | Individual period row |
| PeriodSummaryGroup.jsx | components/period/ | Grouped period section |

## Phase 4: Tab Component Extractions

### BalanceTypesTab.jsx

| Module/Component | Target | Description |
|------------------|--------|-------------|
| accountSimulation.js | utils/ | Account state simulation helpers |
| accountPermissions.js | utils/ | Delete permission logic |
| BalanceTypeForm.jsx | components/account/ | Account form component |

### ExpenseItemsTab.jsx

| Module/Component | Target | Description |
|------------------|--------|-------------|
| expenseScheduling.js | utils/ | Next due calculation |
| ExpenseItemForm.jsx | components/expense/ | Expense item form |

## Directory Structure (Implemented)

```
frontend/src/
├── components/
│   ├── transaction/           # ✅ Phase 1A Complete
│   │   ├── TransactionWorkflowModal.jsx
│   │   ├── TransactionEntryForm.jsx
│   │   ├── TransactionListPanel.jsx
│   │   ├── IncomeTransactionsModal.jsx
│   │   ├── ExpenseEntriesModal.jsx
│   │   ├── InvestmentTxModal.jsx
│   │   └── AmountSummaryGrid.jsx
│   ├── status/                # ✅ Phase 1A Complete
│   │   ├── ProgressStatusPill.jsx
│   │   └── ConfirmPaidModal.jsx
│   ├── modals/                # ✅ Phase 1B Complete (consolidated location)
│   │   ├── BudgetAdjustmentModal.jsx
│   │   ├── BalanceTransactionsModal.jsx
│   │   ├── CloseoutModal.jsx
│   │   └── ExportCycleModal.jsx
│   ├── period-lines/          # ✅ Phase 1A Complete
│   │   ├── AddIncomeLineModal.jsx
│   │   └── AddExpenseLineModal.jsx
│   └── period-sections/       # ✅ Phase 3 Complete (Activity 1)
│       ├── IncomeSection.jsx
│       ├── ExpenseSection.jsx
│       ├── InvestmentSection.jsx
│       ├── BalanceSection.jsx
│       └── index.js
└── utils/                     # ✅ Phase 2 Complete
    ├── transactionHelpers.js
    ├── periodCalculations.jsx  # Note: .jsx extension (contains JSX)
    └── iconButtons.jsx         # Note: .jsx extension (contains JSX)
```

### Notes on Structure Changes

1. **Consolidated modals into `components/modals/`** instead of separate `budget/`, `balance/`, `closeout/` directories for better maintainability
2. **Added `components/period-sections/`** for Activity 1 (table section components) - not in original plan
3. **Files renamed to `.jsx`** when they contain JSX to comply with Vite build requirements

## Implementation Rules

### Extraction Pattern
1. Move component to new file
2. Update imports in source file
3. Add PropTypes to extracted component
4. Move corresponding test coverage or add new test file
5. Verify no regression in functionality

### Import Path Convention
Use relative imports within feature directories:
```javascript
// Preferred
import { TransactionEntryForm } from './TransactionEntryForm'

// For cross-feature imports
import { ProgressStatusPill } from '../status/ProgressStatusPill'
```

### Test Coverage Requirements
Each extraction must:
- Maintain existing test coverage
- Add dedicated test file for extracted component if >100 lines
- Verify PropTypes validation exists

## Implementation Status

### Phase 1: PeriodDetailPage.jsx - COMPLETED ✅

**Date Completed:** 2026-04-11

**Results:**
| Metric | Original | Target | Achieved |
|--------|----------|--------|----------|
| Lines of Code | 2,911 | ~900 | **642** (78% reduction) |
| Test Pass Rate | 164/164 | 164/164 | **164/164 (100%)** |
| Build Status | Pass | Pass | **Pass** |

**Components Extracted:**
- ✅ `components/transaction/` - 7 components (TransactionWorkflowModal, TransactionEntryForm, TransactionListPanel, IncomeTransactionsModal, ExpenseEntriesModal, InvestmentTxModal, AmountSummaryGrid)
- ✅ `components/status/` - 2 components (ProgressStatusPill, ConfirmPaidModal)
- ✅ `components/modals/` - 4 components (BalanceTransactionsModal, BudgetAdjustmentModal, CloseoutModal, ExportCycleModal)
- ✅ `components/period-lines/` - 2 components (AddIncomeLineModal, AddExpenseLineModal)
- ✅ `components/period-sections/` - 4 components (IncomeSection, ExpenseSection, InvestmentSection, BalanceSection)
- ✅ `utils/` - 3 modules (transactionHelpers.js, periodCalculations.jsx, iconButtons.jsx)

**Build Fixes Applied:**
- Renamed `iconButtons.js` → `iconButtons.jsx` (contains JSX)
- Renamed `periodCalculations.js` → `periodCalculations.jsx` (contains JSX)
- Fixed PropTypes warning: made `status` optional in ProgressStatusPill

**Post-Deployment Fix:**
- Removed legacy `isfixed` column from `incometypes` table (pre-baseline schema artifact)
- Verified demo budget creation works correctly after column removal

## Verification Checklist

### Per-Phase Verification
- [x] All existing tests pass (164/164)
- [ ] SonarQube quality gate passes
- [ ] Manual smoke test of affected workflows
- [x] Bundle size compared (104.66 kB gzipped for PeriodDetailPage)

### Final Verification
- [x] Target file sizes achieved (642 lines vs 900 target)
- [x] No circular dependencies introduced
- [x] Component reusability demonstrated
- [ ] Documentation updated in COMPONENT_CATALOG.md (if created)

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Move tests with components; maintain coverage |
| Prop-drilling complexity | Use composition patterns; avoid deep nesting |
| Import path churn | Update Jest moduleNameMapper if needed |
| Merge conflicts | Coordinate with active roadmap work |

## Related Documents

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md) - Current state and SonarQube context
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) - Roadmap alignment (Quality > Consistency)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) - Testing requirements during refactor
