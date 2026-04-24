# Mobile Presentation Layer Improvement Plan for Dosh

**Status:** Completed | **Created:** 2026-04-24 | **Replaces:** PWA Plan

This plan has been fully implemented. See the session wrap-up and `docs/DEVELOPMENT_ACTIVITIES.md` for completion status.

---

## 1. Current State Assessment

The Dosh frontend is **usable but painful on mobile**. Key findings from the audit:

| Category | Score | Notes |
|----------|-------|-------|
| Navigation | 7/10 | Hamburger menu + sidebar overlay work well |
| Typography | 8/10 | Responsive font sizing with `sm:` prefixes |
| Modals | 7/10 | Scrollable, but some are too wide (`size="lg"`) |
| Forms | 6/10 | Basic grids OK, complex layouts struggle |
| **Tables** | **3/10** | **All major tables require horizontal scroll** |
| **Touch Targets** | **4/10** | **Many buttons below 44×44px minimum** |
| **Overall** | **5.5/10** | **Functional but frustrating on small screens** |

**Critical pain points:**
- **BudgetPeriodsPage** table: fixed column widths totaling ~1,140px
- **PeriodDetailPage** tables (Income, Expense, Investment, Balance): all use fixed colgroup widths
- **Dashboard** table: 10 columns with no mobile adaptation
- **iconButtons.jsx**: `w-7 h-7` (28px) — 16px below accessible minimum
- **ExpenseItemsTab** reorder chevrons: `w-3.5 h-3.5` (14px) with `p-0.5`
- **ProgressStatusPill**: ~26px height

---

## 2. Scope

Three workstreams, in priority order:

### Workstream A — Touch Target Accessibility (Highest Impact / Lowest Effort)
Increase all interactive elements to meet WCAG 2.5.5 minimum (44×44px). This is a pure CSS/Tailwind change.

### Workstream B — Table Mobile Experience (High Impact / Medium Effort)
Make every table usable on mobile without horizontal scrolling as the primary interaction. Two sub-options per table:
- **B1 — Scrollable Tables**: Wrap tables in `overflow-x-auto` containers with visual scroll hints. Keep current layout.
- **B2 — Card-Based Mobile Views**: Render rows as stacked cards on mobile (`hidden md:table` / `md:hidden`), showing only key columns.

### Workstream C — Layout & Polish (Medium Impact / Medium Effort)
- Responsive modal sizing
- Mobile-optimized form grids
- Sticky nav button overflow on BudgetDetailPage

---

## 3. Implementation Steps

### Workstream A — Touch Targets

**File:** `frontend/src/components/iconButtons.jsx`
```jsx
// Change w-7 h-7 (28px) → w-11 h-11 (44px)
export function iconButtonClassName(disabled, tone) {
  return `flex items-center justify-center w-11 h-11 rounded-full ...`
}
```
- Audit every call site — ensure surrounding layout doesn't break
- If 44px causes overflow in dense table rows, use `min-w-11 min-h-11` with internal icon at original size

**File:** `frontend/src/components/ProgressStatusPill.jsx`
- Increase vertical padding to reach 44px minimum height
- Or wrap in a `min-h-11` container with centered content

**File:** `frontend/src/components/ExpenseItemsTab.jsx` (lines 318–325)
- Reorder chevrons: `w-3.5 h-3.5` → minimum tap target of `w-11 h-11`

**File:** `frontend/src/components/BalanceTypesTab.jsx` (lines 365–370)
- Delete/edit buttons: increase to 44px minimum

### Workstream B — Tables

| Table | Pages | Records per view | Approach |
|-------|-------|------------------|----------|
| Period Summary | BudgetPeriodsPage | Typically 12–24 | B1 (scrollable) — too many columns for cards |
| Income / Expense / Investment / Balance | PeriodDetailPage | 5–20 per section | B2 (cards on mobile) — manageable row counts |
| Budget List | BudgetsPage | 1–10 | Already card-based (calendar grid), no change |
| Setup Tables | BudgetDetailPage | 5–20 per tab | B2 (cards on mobile) |
| Dashboard | Dashboard.jsx | Variable | B1 (scrollable) — many columns |

**B1 Pattern — Scrollable Table Container:**
```jsx
<div className="overflow-x-auto -mx-4 px-4">
  <div className="min-w-[1020px]"> {/* or appropriate min-width */}
    <table>...</table>
  </div>
</div>
```
- Add subtle scroll shadow indicator (optional polish)
- Keep existing `colgroup` widths

**B2 Pattern — Card-Based Mobile View (all columns stacked vertically):**

Each card shows **all columns stacked vertically** with `label: value` pairs, not a subset. This avoids hiding data and keeps the component simple — no expand/collapse needed.

Card structure per row:
```
┌─────────────────────────────────────┐
│ [Status Pill]                    [⋮] │  ← top row: status + actions
├─────────────────────────────────────┤
│ Description        My Groceries      │
│ Budget             $500.00           │
│ Actual             $423.50           │
│ Difference         $76.50            │
│ Schedule           Weekly (Mon)      │
│ Default Account    NAB Everyday      │
│ Payment Type       MANUAL            │
│ Notes              ...               │
└─────────────────────────────────────┘
```

Create reusable component:
```jsx
// frontend/src/components/MobileTableCards.jsx
// Props:
//   columns: Array<{ key, label, render?(value, row), className? }>
//   rows: Array<Record>
//   keyExtractor: (row) => string
//   actions?: (row) => ReactNode   // rendered top-right of each card
//   status?: (row) => ReactNode    // rendered top-left of each card
//
// Desktop: returns null (consumer renders their own <table>)
// Mobile (<768px): renders stacked cards
```

Tables to convert to B2:
- `IncomeSection.jsx`
- `ExpenseSection.jsx`
- `InvestmentSection.jsx`
- `BalanceSection.jsx`
- `ExpenseItemsTab.jsx`
- `IncomeTypesTab.jsx`
- `InvestmentItemsTab.jsx`
- `BalanceTypesTab.jsx`

### Workstream C — Layout & Polish

**Full-Screen Modals on Mobile:**
- `Modal.jsx`: add a `fullScreen` prop or auto-detect mobile viewport
- On screens `<640px` (`sm` breakpoint): modals render full-screen with a close button in the header
  - `fixed inset-0 z-50` positioning
  - Rounded corners only on top (`rounded-t-xl`) for sheet-like feel, or fully rounded with safe-area padding
  - Header with title + close (X) button always visible
  - Body scrolls independently (`overflow-y-auto`)
  - Footer actions stick to bottom
- On desktop: existing `size` prop behavior unchanged
- Audit all `size="lg"` modal usages — `lg` is acceptable on desktop but should still render full-screen on mobile

**BudgetDetailPage Sticky Nav:**
- File: `frontend/src/pages/BudgetDetailPage.jsx` (lines 352–368)
- Current: `flex flex-wrap gap-2` — buttons wrap but consume vertical space
- Mobile: convert to horizontal scroll container (`overflow-x-auto flex-nowrap`) with fade indicators
  - Hide scrollbars with `scrollbar-hide` utility or `-webkit-scrollbar: none`
  - Buttons remain single-line, user swipes horizontally

**TransactionEntryForm Grid:**
- File: `frontend/src/components/TransactionEntryForm.jsx` (line 130)
- Current: `grid-cols-[0.5fr_0.5fr_1fr]` — may squash on mobile
- Mobile: stack to single column (`grid-cols-1 sm:grid-cols-[0.5fr_0.5fr_1fr]`)

---

## 4. File Inventory

### Modified Files
| File | Workstream | Changes |
|------|------------|---------|
| `frontend/src/components/iconButtons.jsx` | A | Increase button size to 44px |
| `frontend/src/components/ProgressStatusPill.jsx` | A | Increase touch target height |
| `frontend/src/components/ExpenseItemsTab.jsx` | A, B2 | Larger chevrons; card-based mobile view |
| `frontend/src/components/BalanceTypesTab.jsx` | A, B2 | Larger buttons; card-based mobile view |
| `frontend/src/components/IncomeSection.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/ExpenseSection.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/InvestmentSection.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/BalanceSection.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/IncomeTypesTab.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/InvestmentItemsTab.jsx` | B2 | Card-based mobile view |
| `frontend/src/components/Modal.jsx` | C | Responsive sizing, mobile margins |
| `frontend/src/pages/BudgetDetailPage.jsx` | C | Mobile sticky nav (scroll or collapse) |
| `frontend/src/components/TransactionEntryForm.jsx` | C | Responsive grid stacking |
| `frontend/src/pages/BudgetPeriodsPage.jsx` | B1 | Scrollable table container |
| `frontend/src/pages/Dashboard.jsx` | B1 | Scrollable table container |

### New Files
| File | Workstream | Purpose |
|------|------------|---------|
| `frontend/src/components/MobileTableCards.jsx` | B2 | Reusable card-based table renderer for mobile |
| `frontend/src/__tests__/MobileTableCards.test.jsx` | B2 | Component tests |

---

## 5. Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Card-based vs scrollable for detail tables | B2 (cards) for detail/setup tables with <20 rows; B1 (scrollable) for summary/dashboard |
| 2 | Columns per mobile card | **All columns stacked vertically** with `label: value` pairs — no expand/collapse |
| 3 | Modal sizing on mobile | **Full-screen mode** on screens <640px; desktop sizes unchanged |
| 4 | Desktop table column widths | **Unchanged** — preserve existing layout, add mobile overlay only |
| 5 | Execution scope | **All three workstreams** (A, B, C) |

## 6. Desktop Impact Analysis

Every change is gated behind Tailwind responsive breakpoints. The desktop view (`≥1024px`, and in most cases `≥768px`) is explicitly protected:

| Workstream | Change | Desktop Impact | Protection |
|------------|--------|----------------|------------|
| A — Touch targets | `iconButtons` size increase | **Zero if done correctly** | Use `min-w-11 min-h-11` (not `w-11 h-11`) inside flex containers; the icon stays visually small, tap target expands invisibly. Existing table row heights unchanged. |
| A — Touch targets | `ProgressStatusPill` height | **Zero** | Wrap in `min-h-11` container; pill text stays same size, vertical centering adds invisible padding. |
| A — Touch targets | ExpenseItemsTab chevrons | **Zero** | Same `min-w-11 min-h-11` pattern inside table cell flex. |
| B1 — Scrollable tables | `overflow-x-auto` wrapper | **Zero** | Wrapper uses `-mx-4 px-4` only; at desktop widths the container is wider than its content so no scrollbars appear. |
| B2 — Card views | `MobileTableCards` component | **Zero** | Component renders `null` on desktop (`md:hidden` on card container, `hidden md:block` on existing table). Desktop tables untouched. |
| C — Modals | Full-screen mode | **Zero** | Full-screen styles apply only below `sm` breakpoint (`sm:max-w-md sm:rounded-lg` etc.). Desktop modals keep existing `size` behavior. |
| C — Sticky nav | Horizontal scroll | **Zero** | `overflow-x-auto` with `flex-nowrap` only active on mobile; at desktop width the container has room so no scrollbar appears. Buttons still wrap with `flex-wrap` on desktop if needed. |
| C — TransactionEntryForm | Grid stacking | **Zero** | `grid-cols-1 sm:grid-cols-[...]` — desktop uses exact same grid as before. |

**Bottom line**: With proper use of `min-*` utilities and Tailwind breakpoints, the desktop experience should be visually identical. The acceptance criteria include "No visual regressions on desktop (≥1024px)" as a hard gate.

---

## 7. Risk Considerations

1. **Touch target increase in dense table rows**: The risk of row height expansion is real if `w-11 h-11` (fixed size) is used instead of `min-w-11 min-h-11`. Every table cell that contains icon buttons must use flex centering so the visual size stays ~28px while the tap target expands to 44px.

2. **Card component API surface**: `MobileTableCards` needs to accept varying column shapes (some with `render` functions, some plain values). The component must handle React nodes in cell values gracefully.

3. **Full-screen modal accessibility**: Ensure focus trapping and `Escape` key close still work. The close button must be visible and large enough (44px+) on mobile.

4. **Horizontal scroll on BudgetDetailPage sticky nav**: `overflow-x-auto` with hidden scrollbars is a common pattern but may not be discoverable. Consider a subtle fade gradient on the right edge to indicate more content.

5. **Test coverage for responsive behavior**: Jest/jsdom does not render layout, so responsive CSS (Tailwind breakpoints) cannot be directly tested. Focus on component prop logic tests and snapshot tests for card rendering.

---

## 7. Acceptance Criteria

- [ ] All interactive elements meet 44×44px minimum touch target
- [ ] Period detail tables (Income, Expense, Investment, Balance) render as stacked cards on screens < 768px, showing all columns as `label: value` pairs
- [ ] Setup tables (IncomeTypesTab, ExpenseItemsTab, InvestmentItemsTab, BalanceTypesTab) render as stacked cards on screens < 768px
- [ ] BudgetPeriodsPage and Dashboard tables scroll horizontally with visual containment on mobile
- [ ] Modals render full-screen on screens < 640px with fixed header (title + close), scrollable body, and sticky footer
- [ ] BudgetDetailPage sticky nav scrolls horizontally on mobile without wrapping
- [ ] TransactionEntryForm stacks vertically on narrow screens
- [ ] No visual regressions on desktop (≥1024px)
- [ ] `MobileTableCards` component has unit tests covering column rendering, actions, and status slots
- [ ] All 226 existing frontend tests pass
- [ ] All 193 existing backend tests pass
- [ ] Docker build succeeds and app is manually verified on mobile viewport (Chrome DevTools device emulation)

---

## 8. Suggested Execution Order

1. **Workstream A** — Touch targets (pure CSS, quick wins, no test logic changes)
2. **Workstream C (partial)** — Modal full-screen mode + TransactionEntryForm grid
3. **Workstream B1** — Scrollable containers for summary tables (BudgetPeriodsPage, Dashboard)
4. **Workstream B2** — Card-based mobile views for detail tables (new component + conversions)
5. **Workstream C (remaining)** — BudgetDetailPage sticky nav
6. **Testing & verification** — Full test suite + manual mobile viewport check
