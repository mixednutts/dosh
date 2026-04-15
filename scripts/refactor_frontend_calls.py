from pathlib import Path
import re

BASE = Path("/home/ubuntu/dosh/frontend/src")

replacements = [
    # PeriodDetailPage.jsx and similar pages
    (r'queryFn:\s*\(\)\s*=>\s*getPeriodDetail\(([^)]+)\)', r'queryFn: () => getPeriodDetail(budgetid, \1)'),
    (r'queryFn:\s*\(\)\s*=>\s*getPeriodBalances\(([^)]+)\)', r'queryFn: () => getPeriodBalances(budgetid, \1)'),
    (r'mutationFn:\s*islocked\s*=>\s*setPeriodLock\(([^,]+),\s*islocked\)', r'mutationFn: islocked => setPeriodLock(budgetid, \1, islocked)'),
    (r'mutationFn:\s*\(\{\s*desc,\s*status,\s*revisionComment\s*=\s*null\s*\}\)\s*=>\s*setPeriodExpenseStatus\(([^,]+),', r'mutationFn: ({ desc, status, revisionComment = null }) => setPeriodExpenseStatus(budgetid, \1,'),
    (r'mutationFn:\s*\(\{\s*desc,\s*paytype\s*\}\)\s*=>\s*updatePeriodExpensePayType\(([^,]+),', r'mutationFn: ({ desc, paytype }) => updatePeriodExpensePayType(budgetid, \1,'),
    (r'mutationFn:\s*\(\)\s*=>\s*runPeriodAutoExpenses\(([^)]+)\)', r'mutationFn: () => runPeriodAutoExpenses(budgetid, \1)'),
    (r'mutationFn:\s*\(\{\s*desc,\s*status,\s*revisionComment\s*=\s*null\s*\}\)\s*=>\s*setPeriodInvestmentStatus\(([^,]+),', r'mutationFn: ({ desc, status, revisionComment = null }) => setPeriodInvestmentStatus(budgetid, \1,'),
    (r'mutationFn:\s*\(\{\s*desc,\s*status,\s*revisionComment\s*=\s*null\s*\}\)\s*=>\s*setPeriodIncomeStatus\(([^,]+),', r'mutationFn: ({ desc, status, revisionComment = null }) => setPeriodIncomeStatus(budgetid, \1,'),
    (r'mutationFn:\s*\(\{\s*desc,\s*data\s*\}\)\s*=>\s*updatePeriodIncomeBudget\(([^,]+),', r'mutationFn: ({ desc, data }) => updatePeriodIncomeBudget(budgetid, \1,'),
    (r'mutationFn:\s*\(\{\s*desc,\s*data\s*\}\)\s*=>\s*updatePeriodExpenseBudget\(([^,]+),', r'mutationFn: ({ desc, data }) => updatePeriodExpenseBudget(budgetid, \1,'),
    (r'mutationFn:\s*desc\s*=>\s*removePeriodExpense\(([^,]+),', r'mutationFn: desc => removePeriodExpense(budgetid, \1,'),
    (r'mutationFn:\s*desc\s*=>\s*removePeriodIncome\(([^,]+),', r'mutationFn: desc => removePeriodIncome(budgetid, \1,'),
    (r'mutationFn:\s*\(\{\s*desc,\s*data\s*\}\)\s*=>\s*updatePeriodInvestmentBudget\(([^,]+),', r'mutationFn: ({ desc, data }) => updatePeriodInvestmentBudget(budgetid, \1,'),
    (r'reorderPeriodExpenses\(([^,]+),', r'reorderPeriodExpenses(budgetid, \1,'),
    # CloseoutModal
    (r'queryFn:\s*\(\)\s*=>\s*getPeriodCloseoutPreview\(([^)]+)\)', r'queryFn: () => getPeriodCloseoutPreview(budgetid, \1)'),
    (r'mutationFn:\s*\(\)\s*=>\s*closeOutPeriod\(([^,]+),', r'mutationFn: () => closeOutPeriod(budgetid, \1,'),
    # ExportCycleModal
    (r'mutationFn:\s*selectedFormat\s*=>\s*exportPeriod\(([^,]+),', r'mutationFn: selectedFormat => exportPeriod(budgetid, \1,'),
    # BalanceTransactionsModal
    (r'queryFn:\s*\(\)\s*=>\s*getBalanceTransactions\(([^,]+),', r'queryFn: () => getBalanceTransactions(budgetid, \1,'),
    # Transaction modals
    (r'queryFn:\s*\(\)\s*=>\s*getIncomeTransactions\(([^,]+),', r'queryFn: () => getIncomeTransactions(budgetid, \1,'),
    (r'mutationFn:\s*data\s*=>\s*addIncomeTransaction\(([^,]+),', r'mutationFn: data => addIncomeTransaction(budgetid, \1,'),
    (r'mutationFn:\s*txId\s*=>\s*deleteIncomeTransaction\(([^,]+),', r'mutationFn: txId => deleteIncomeTransaction(budgetid, \1,'),
    (r'queryFn:\s*\(\)\s*=>\s*getExpenseEntries\(([^,]+),', r'queryFn: () => getExpenseEntries(budgetid, \1,'),
    (r'mutationFn:\s*data\s*=>\s*addExpenseEntry\(([^,]+),', r'mutationFn: data => addExpenseEntry(budgetid, \1,'),
    (r'mutationFn:\s*entryId\s*=>\s*deleteExpenseEntry\(([^,]+),', r'mutationFn: entryId => deleteExpenseEntry(budgetid, \1,'),
    (r'queryFn:\s*\(\)\s*=>\s*getInvestmentTransactions\(([^,]+),', r'queryFn: () => getInvestmentTransactions(budgetid, \1,'),
    (r'mutationFn:\s*data\s*=>\s*addInvestmentTransaction\(([^,]+),', r'mutationFn: data => addInvestmentTransaction(budgetid, \1,'),
    (r'mutationFn:\s*txId\s*=>\s*deleteInvestmentTransaction\(([^,]+),', r'mutationFn: txId => deleteInvestmentTransaction(budgetid, \1,'),
    # Period-lines modals
    (r'mutationFn:\s*data\s*=>\s*addExpenseToPeriod\(([^,]+),', r'mutationFn: data => addExpenseToPeriod(budgetId, \1,'),
    (r'mutationFn:\s*data\s*=>\s*addIncomeToPeriod\(([^,]+),', r'mutationFn: data => addIncomeToPeriod(budgetId, \1,'),
    (r'mutationFn:\s*data\s*=>\s*accountTransfer\(([^,]+),', r'mutationFn: data => accountTransfer(budgetId, \1,'),
    # Layout.jsx
    (r'queryFn:\s*\(\)\s*=>\s*getPeriodDetail\(activePeriodId\)', r'queryFn: () => getPeriodDetail(budget.budgetid, activePeriodId)'),
]

files = list(BASE.rglob("*.jsx"))
for p in files:
    txt = p.read_text()
    original = txt
    for pat, repl in replacements:
        txt = re.sub(pat, repl, txt)
    if txt != original:
        p.write_text(txt)
        print(f"Updated {p.relative_to(BASE)}")

# PeriodDetailPage.jsx specific prev/next links
pdp = BASE / "pages" / "PeriodDetailPage.jsx"
txt = pdp.read_text()
txt = txt.replace('to={prevPeriod ? `/periods/${prevPeriod.finperiodid}`', 'to={prevPeriod ? `/budgets/${budgetid}/periods/${prevPeriod.finperiodid}`')
txt = txt.replace('to={nextPeriod ? `/periods/${nextPeriod.finperiodid}`', 'to={nextPeriod ? `/budgets/${budgetid}/periods/${nextPeriod.finperiodid}`')
pdp.write_text(txt)
print("Updated PeriodDetailPage.jsx links")

print("Done")
