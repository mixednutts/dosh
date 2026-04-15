from pathlib import Path
import re

BASE = Path("/home/ubuntu/dosh/frontend/src")

# Update App.jsx route
def update_app():
    p = BASE / "App.jsx"
    txt = p.read_text()
    txt = txt.replace('path="periods/:periodId"', 'path="budgets/:budgetId/periods/:periodId"')
    p.write_text(txt)
    print("Updated App.jsx")

# Update Layout.test.jsx route
def update_layout_test():
    p = BASE / "__tests__" / "Layout.test.jsx"
    txt = p.read_text()
    txt = txt.replace('path="periods/:periodId"', 'path="budgets/:budgetId/periods/:periodId"')
    p.write_text(txt)
    print("Updated Layout.test.jsx")

# Update Layout.jsx: pass budgetId to PeriodShortcutGroup and use in Links
def update_layout():
    p = BASE / "components" / "Layout.jsx"
    txt = p.read_text()
    # Add budgetId param to PeriodShortcutGroup
    txt = txt.replace(
        'function PeriodShortcutGroup({ title, periods, activePeriodId, onNav, emptyMessage = null, moreText = null, moreTo = null, moreSubtle = false }) {',
        'function PeriodShortcutGroup({ title, periods, activePeriodId, onNav, budgetId, emptyMessage = null, moreText = null, moreTo = null, moreSubtle = false }) {'
    )
    # Update Link inside PeriodShortcutGroup
    txt = txt.replace(
        'to={`/periods/${period.finperiodid}`}',
        'to={`/budgets/${budgetId}/periods/${period.finperiodid}`}'
    )
    # Update CompactCurrentBudgetContext Link
    txt = txt.replace(
        'to={`/periods/${activePeriodId}`}',
        'to={`/budgets/${budget.budgetid}/periods/${activePeriodId}`}'
    )
    # Pass budgetId into PeriodShortcutGroup calls inside CurrentBudgetPanel
    # CurrentBudgetPanel has budget in scope. We'll inject budgetId={budget.budgetid} before periods={...}
    # Use regex to catch varying whitespace
    txt = re.sub(
        r'(<PeriodShortcutGroup\s+title="Current"\s+)periods=\{currentPeriods\}',
        r'\1budgetId={budget.budgetid} periods={currentPeriods}',
        txt
    )
    txt = re.sub(
        r'(<PeriodShortcutGroup\s+title="Pending Closure"\s+)periods=\{visiblePendingClosurePeriods\}',
        r'\1budgetId={budget.budgetid} periods={visiblePendingClosurePeriods}',
        txt
    )
    txt = re.sub(
        r'(<PeriodShortcutGroup\s+title="Future"\s+)periods=\{futurePeriods\}',
        r'\1budgetId={budget.budgetid} periods={futurePeriods}',
        txt
    )
    txt = re.sub(
        r'(<PeriodShortcutGroup\s+title="Historical"\s+)periods=\{historicalPeriods\}',
        r'\1budgetId={budget.budgetid} periods={historicalPeriods}',
        txt
    )
    p.write_text(txt)
    print("Updated Layout.jsx")

# Update Dashboard.jsx
def update_dashboard():
    p = BASE / "pages" / "Dashboard.jsx"
    txt = p.read_text()
    txt = txt.replace(
        'queryFn: () => getPeriodDetail(period.finperiodid),',
        'queryFn: () => getPeriodDetail(budget.budgetid, period.finperiodid),'
    )
    txt = txt.replace(
        'to={`/periods/${period.finperiodid}`}',
        'to={`/budgets/${budget.budgetid}/periods/${period.finperiodid}`}'
    )
    p.write_text(txt)
    print("Updated Dashboard.jsx")

# Update BudgetPeriodsPage.jsx
def update_budget_periods_page():
    p = BASE / "pages" / "BudgetPeriodsPage.jsx"
    txt = p.read_text()
    # Link to period detail
    txt = txt.replace(
        'to={`/periods/${period.finperiodid}`}',
        'to={`/budgets/${id}/periods/${period.finperiodid}`}'
    )
    # deletePeriod call now needs budgetId first
    txt = txt.replace(
        'mutationFn: ({ periodId, mode }) => deletePeriod(periodId, mode),',
        'mutationFn: ({ periodId, mode }) => deletePeriod(id, periodId, mode),'
    )
    # getPeriodDeleteOptions call
    txt = txt.replace(
        "queryFn: () => getPeriodDeleteOptions(deleteTarget.period.finperiodid),",
        "queryFn: () => getPeriodDeleteOptions(id, deleteTarget.period.finperiodid),"
    )
    p.write_text(txt)
    print("Updated BudgetPeriodsPage.jsx")

# Update BudgetsPage.jsx
def update_budgets_page():
    p = BASE / "pages" / "BudgetsPage.jsx"
    txt = p.read_text()
    txt = txt.replace(
        'to={`/periods/${period.finperiodid}?closeout=1`}',
        'to={`/budgets/${budgetId}/periods/${period.finperiodid}?closeout=1`}'
    )
    txt = txt.replace(
        'to={`/periods/${currentPeriod.finperiodid}`}',
        'to={`/budgets/${budgetId}/periods/${currentPeriod.finperiodid}`}'
    )
    # getPeriodDetail in calendar query
    txt = txt.replace(
        'queryFn: () => getPeriodDetail(meta.finperiodid),',
        'queryFn: () => getPeriodDetail(meta.budgetid, meta.finperiodid),'
    )
    p.write_text(txt)
    print("Updated BudgetsPage.jsx")

if __name__ == "__main__":
    update_app()
    update_layout_test()
    update_layout()
    update_dashboard()
    update_budget_periods_page()
    update_budgets_page()
    print("Done")
