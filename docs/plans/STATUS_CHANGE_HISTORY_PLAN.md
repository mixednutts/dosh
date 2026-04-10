# Plan: Status Change History (Paid/Revised) as Non-Financial Transactions

## Overview
Currently, marking a line as Paid or Revised only updates the `status` field on the period line (PeriodIncome/PeriodExpense/PeriodInvestment). There is no persistent history record of when these status changes occurred or why. This plan proposes creating non-financial transaction records (similar to budget adjustments) to capture status change events for auditability and future budget health analysis.

**This feature is gated by a user-controllable budget setting.**

## Current State Analysis

### Budget Adjustments (Existing Pattern)
- Creates `PeriodTransaction` with `entry_kind = "budget_adjustment"`, `tx_type = "BUDGETADJ"`
- Stores `budget_before_amount` and `budget_after_amount`
- Displays with "Adj" badge and change summary in transaction modal
- Excluded from actual/balance calculations via `entry_kind !== 'budget_adjustment'` filter
- Created via `build_budget_adjustment_tx()` in `transaction_ledger.py`

### Status Changes (Current Gap)
- `set_expense_status()`, `set_income_status()`, `set_investment_status()` in `periods.py`
- Only updates `status` and `revision_comment` fields on the line
- No transaction record created
- No visibility in transaction history modal
- Revision comment is stored but not tied to a point-in-time event

## Proposed Design

### 1. Budget-Level Feature Setting

#### A. New Database Column
```python
# models.py - Budget table
record_line_status_changes = Column(Boolean, nullable=False, default=False)
```

#### B. Schema Updates
```python
# schemas.py
class BudgetOut(BaseModel):
    ...
    record_line_status_changes: bool

class BudgetUpdate(BaseModel):
    ...
    record_line_status_changes: bool | None = None
```

#### C. Settings Tab UI
Add to `SettingsTab.jsx` with question mark helper:

```jsx
<label className="flex items-start gap-3 text-sm cursor-pointer">
  <input 
    type="checkbox" 
    checked={recordStatusChanges}
    onChange={e => setRecordStatusChanges(e.target.checked)}
  />
  <span className="space-y-0.5">
    <span className="flex items-center gap-1.5">
      <span className="font-medium">Record budget line Paid/Revised status changes as non-financial transactions</span>
      <span 
        className="text-gray-400 hover:text-gray-600 cursor-help"
        title="When enabled, marking items as Paid or Revised will create a history record visible in the transaction details. This helps track planning changes over time and feeds into budget health analysis."
      >
        <QuestionMarkCircleIcon className="w-4 h-4" />
      </span>
    </span>
    <span className="block text-xs text-gray-500">
      Creates an audit trail when you mark income, expense, or investment lines as Paid or Revised.
    </span>
  </span>
</label>
```

### 2. Alignment with Budget Adjustment Pattern

Status changes follow the **same pattern as budget adjustments**:

| Aspect | Budget Adjustment | Status Change |
|--------|------------------|---------------|
| `entry_kind` | `"budget_adjustment"` | `"status_change"` |
| `tx_type` | `"BUDGETADJ"` | `"STATUS"` |
| `amount` | `0` (non-financial) | `0` (non-financial) |
| `is_system` | `true` | `true` |
| Display | "Adj" badge + change text | "Status" badge + change text |
| Financial totals | Excluded | Excluded |
| Delete allowed | No | No |

**Key insight**: `item.entry_kind` is the discriminator used throughout the codebase:
- Backend: `entry_kind == "budget_adjustment"` filters in queries
- Frontend: `item.entry_kind !== 'budget_adjustment'` excludes from totals
- Frontend: `item.entry_kind === 'budget_adjustment'` shows special UI

Status changes use the same `entry_kind` discriminator pattern.

### 3. Data Model Extension

`PeriodTransaction` table already has supporting fields:
- `entry_kind` (existing) - add "status_change" as valid value
- `line_status` (existing) - store the new status ("Paid", "Revised", "Current")
- `note` (existing) - store revision_comment or user-provided note
- `amount = 0` (non-financial)

### 4. Backend Implementation

#### A. Migration Required
```python
# alembic migration
op.add_column('budgets', sa.Column('record_line_status_changes', sa.Boolean(), nullable=False, server_default='0'))
```

#### B. Add Transaction Type Constant
```python
# transaction_ledger.py
TX_TYPE_STATUS_CHANGE = "STATUS"
ENTRY_KIND_STATUS_CHANGE = "status_change"
```

#### C. New Builder Function
```python
def build_status_change_tx(
    db: Session,
    finperiodid: int,
    budgetid: int,
    source: str,  # "income" | "expense" | "investment"
    source_key: str,  # line description
    old_status: str,
    new_status: str,
    note: str | None,
    line_status: str | None = None,  # revision comment context
):
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source=source,
            tx_type=TX_TYPE_STATUS_CHANGE,
            source_key=source_key,
            line_status=line_status,
        ),
        amount=0,
        note=f"Status: {old_status} → {new_status}" + (f" | {note}" if note else ""),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        is_system=True,
        system_reason=f"Line marked {new_status}",
    )
```

#### D. Modify Status Endpoints
Update `set_expense_status()`, `set_income_status()`, `set_investment_status()` in `periods.py`:

```python
def set_expense_status(...):
    # ... existing validation ...
    old_status = pe.status
    pe.status = payload.status
    if payload.status == REVISED:
        pe.revision_comment = (payload.revision_comment or "").strip() or None
    
    # NEW: Conditionally create history record based on budget setting
    budget = db.get(Budget, period.budgetid)
    if budget and budget.record_line_status_changes:
        build_status_change_tx(
            db,
            finperiodid=finperiodid,
            budgetid=period.budgetid,
            source="expense",
            source_key=expensedesc,
            old_status=old_status,
            new_status=payload.status,
            note=payload.revision_comment if payload.status == REVISED else None,
            line_status=pe.revision_comment if payload.status == REVISED else None,
        )
    
    db.commit()
```

### 5. Frontend Implementation

#### A. Settings Tab Update (`SettingsTab.jsx`)
- Add checkbox for `record_line_status_changes`
- Include question mark icon with hover tooltip
- Add to budget update payload

#### B. Display Logic in `buildTransactionDisplayResolver`
```javascript
if (item.entry_kind === 'status_change') {
  return {
    amountClassName: 'text-gray-600 dark:text-gray-400',
    badgeClassName: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    badgeLabel: 'Status',
    primaryText: item.note || `Status changed to ${item.line_status || 'Paid'}`,
  }
}
```

#### C. Exclude from Financial Totals
```javascript
const runningTotal = transactions
  .filter(tx => 
    tx.entry_kind !== 'budget_adjustment' && 
    tx.entry_kind !== 'status_change'
  )
  .reduce((s, tx) => s + Number(tx.amount), 0)
```

#### D. Delete Handling
```javascript
{!locked && 
  item.entry_kind !== 'budget_adjustment' && 
  item.entry_kind !== 'status_change' && (
  <button onClick={() => onDelete(item.id)}>...</button>
)}
```

### 6. Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models.py` | Add `record_line_status_changes` column to Budget |
| `backend/app/schemas.py` | Add to BudgetOut, BudgetUpdate, BudgetCreate schemas |
| `backend/alembic/versions/` | Migration for new column |
| `backend/app/transaction_ledger.py` | Add constants, `build_status_change_tx()` function |
| `backend/app/routers/periods.py` | Check setting, call builder in status endpoints |
| `backend/app/routers/budgets.py` | Include in budget update/create handling |
| `frontend/src/pages/tabs/SettingsTab.jsx` | Add checkbox with question mark helper |
| `frontend/src/pages/PeriodDetailPage.jsx` | Display logic, delete guards |
| `backend/tests/test_status_workflows.py` | Add history record tests |
| `frontend/src/__tests__/SettingsTab.test.jsx` | Add setting UI tests |
| `frontend/src/__tests__/PeriodDetailPage.test.jsx` | Add display tests |

### 7. Testing Strategy

#### Backend Tests
1. Test status change creates transaction record when setting enabled
2. Test status change does NOT create record when setting disabled
3. Test transaction appears in getExpenseEntries/getIncomeTransactions
4. Test amount = 0 doesn't affect balance calculations

#### Frontend Tests
1. Test setting checkbox displays with correct tooltip
2. Test setting persists on save
3. Test status change displays with correct badge/text when enabled
4. Test status change transactions cannot be deleted

### 8. Future Budget Health Integration

Status change history enables (when setting enabled):
1. **Revision frequency scoring** - how often does a line get revised
2. **Planning accuracy** - ratio of Paid without revision vs with revision
3. **Timeliness analysis** - time between Revised and final Paid
4. **Health trend indicators** - frequent revisions suggest unstable planning

### 9. Decisions

| Question | Decision |
|----------|----------|
| Default value | `false` (opt-in) - users must explicitly enable |
| Backfill existing changes | NO - history starts from when setting is enabled |
| Include in budget-cycle export | YES - status changes appear in export |
| User attribution (WHO) | NO - not tracked for this iteration |

## Implementation Order

1. **Database**: Migration for `record_line_status_changes` column
2. **Backend**: Add setting to schemas and models
3. **Backend**: Add `build_status_change_tx()` and constants
4. **Backend**: Modify status endpoints to check setting and create records
5. **Backend**: Tests
6. **Frontend**: SettingsTab UI with question mark helper
7. **Frontend**: PeriodDetailPage display logic
8. **Frontend**: Tests
9. **Integration**: End-to-end verification
