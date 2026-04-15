from pathlib import Path
import re

TEST_DIR = Path("/home/ubuntu/dosh/frontend/src/__tests__")

# ── client.test.js ───────────────────────────────────────────────────────────
client_test = TEST_DIR / "client.test.js"
content = client_test.read_text()

# exportPeriod
content = content.replace(
    "const filename = await exportPeriod(12, format)",
    "const filename = await exportPeriod(1, 12, format)"
)
content = content.replace(
    "expect(mockInstance.get).toHaveBeenCalledWith('/periods/12/export',",
    "expect(mockInstance.get).toHaveBeenCalledWith('/budgets/1/periods/12/export',"
)

# generatePeriod / closeOutPeriod
content = content.replace(
    "expect(mockInstance.post).toHaveBeenCalledWith('/periods/generate', payload)",
    "expect(mockInstance.post).toHaveBeenCalledWith('/budgets/1/periods/generate', payload)"
)
content = content.replace(
    "await closeOutPeriod(4, { rollover: true })",
    "await closeOutPeriod(1, 4, { rollover: true })"
)
content = content.replace(
    "expect(mockInstance.post).toHaveBeenCalledWith('/periods/4/closeout', { rollover: true })",
    "expect(mockInstance.post).toHaveBeenCalledWith('/budgets/1/periods/4/closeout', { rollover: true })"
)

# accountTransfer
content = content.replace(
    "await accountTransfer(1, payload)",
    "await accountTransfer(1, 1, payload)"
)
content = content.replace(
    "expect(mockInstance.post).toHaveBeenCalledWith('/periods/1/account-transfer', payload)",
    "expect(mockInstance.post).toHaveBeenCalledWith('/budgets/1/periods/1/account-transfer', payload)"
)

# updatePeriodExpenseBudget
content = content.replace(
    "await updatePeriodExpenseBudget(1, 'Rent', { budgetamount: '1300.00' })",
    "await updatePeriodExpenseBudget(1, 1, 'Rent', { budgetamount: '1300.00' })"
)
content = content.replace(
    "expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/expense/Rent/budget', { budgetamount: '1300.00' })",
    "expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/periods/1/expense/Rent/budget', { budgetamount: '1300.00' })"
)

# updatePeriodInvestmentBudget
content = content.replace(
    "await updatePeriodInvestmentBudget(1, 'ETF', { budgetamount: '500.00' })",
    "await updatePeriodInvestmentBudget(1, 1, 'ETF', { budgetamount: '500.00' })"
)
content = content.replace(
    "expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/investment/ETF/budget', { budgetamount: '500.00' })",
    "expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/periods/1/investment/ETF/budget', { budgetamount: '500.00' })"
)

# setPeriodExpenseStatus
content = content.replace(
    "await setPeriodExpenseStatus(1, 'Rent', 'PAID', 'all good')",
    "await setPeriodExpenseStatus(1, 1, 'Rent', 'PAID', 'all good')"
)
content = content.replace(
    "expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/expense/Rent/status', { status: 'PAID', revision_comment: 'all good' })",
    "expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/periods/1/expense/Rent/status', { status: 'PAID', revision_comment: 'all good' })"
)

# setPeriodInvestmentStatus
content = content.replace(
    "await setPeriodInvestmentStatus(1, 'ETF', 'EXECUTED', 'done')",
    "await setPeriodInvestmentStatus(1, 1, 'ETF', 'EXECUTED', 'done')"
)
content = content.replace(
    "expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/investment/ETF/status', { status: 'EXECUTED', revision_comment: 'done' })",
    "expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/periods/1/investment/ETF/status', { status: 'EXECUTED', revision_comment: 'done' })"
)

# getIncomeTransactions
content = content.replace(
    "await getIncomeTransactions(1, 'Salary')",
    "await getIncomeTransactions(1, 1, 'Salary')"
)
content = content.replace(
    "expect(mockInstance.get).toHaveBeenCalledWith('/periods/1/income/Salary/transactions/')",
    "expect(mockInstance.get).toHaveBeenCalledWith('/budgets/1/periods/1/income/Salary/transactions/')"
)

# deleteIncomeTransaction
content = content.replace(
    "await deleteIncomeTransaction(1, 'Salary', 5)",
    "await deleteIncomeTransaction(1, 1, 'Salary', 5)"
)
content = content.replace(
    "expect(mockInstance.delete).toHaveBeenCalledWith('/periods/1/income/Salary/transactions/5')",
    "expect(mockInstance.delete).toHaveBeenCalledWith('/budgets/1/periods/1/income/Salary/transactions/5')"
)

# addExpenseEntry
content = content.replace(
    "await addExpenseEntry(1, 'Rent', { amount: 50 })",
    "await addExpenseEntry(1, 1, 'Rent', { amount: 50 })"
)
content = content.replace(
    "expect(mockInstance.post).toHaveBeenCalledWith('/periods/1/expenses/Rent/entries/', { amount: 50 })",
    "expect(mockInstance.post).toHaveBeenCalledWith('/budgets/1/periods/1/expenses/Rent/entries/', { amount: 50 })"
)

# deleteExpenseEntry
content = content.replace(
    "await deleteExpenseEntry(1, 'Rent', 3)",
    "await deleteExpenseEntry(1, 1, 'Rent', 3)"
)
content = content.replace(
    "expect(mockInstance.delete).toHaveBeenCalledWith('/periods/1/expenses/Rent/entries/3')",
    "expect(mockInstance.delete).toHaveBeenCalledWith('/budgets/1/periods/1/expenses/Rent/entries/3')"
)

client_test.write_text(content)
print("Updated client.test.js")

# ── PeriodDetailPage.test.jsx ────────────────────────────────────────────────
pdp = TEST_DIR / "PeriodDetailPage.test.jsx"
content = pdp.read_text()
content = content.replace("route: '/periods/", "route: '/budgets/1/periods/")
content = content.replace("path: '/periods/:periodId'", "path: '/budgets/:budgetId/periods/:periodId'")
content = content.replace('a[href^="/periods/"]', 'a[href^="/budgets/1/periods/"]')

# assertion updates (budgetId = 1 for all these tests)
replacements = [
    ("expect(client.exportPeriod).toHaveBeenCalledWith(45, 'json')", "expect(client.exportPeriod).toHaveBeenCalledWith(1, 45, 'json')"),
    ("expect(client.runPeriodAutoExpenses).toHaveBeenCalledWith(47)", "expect(client.runPeriodAutoExpenses).toHaveBeenCalledWith(1, 47)"),
    ("expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(56, 'Groceries', 'Paid', null)", "expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(1, 56, 'Groceries', 'Paid', null)"),
    ("expect(client.addIncomeTransaction).toHaveBeenCalledWith(61, 'Salary', {", "expect(client.addIncomeTransaction).toHaveBeenCalledWith(1, 61, 'Salary', {"),
    ("expect(client.addExpenseEntry).toHaveBeenCalledWith(65, 'Rent', {", "expect(client.addExpenseEntry).toHaveBeenCalledWith(1, 65, 'Rent', {"),
    ("expect(client.addInvestmentTransaction).toHaveBeenCalledWith(66, 'Emergency Fund', {", "expect(client.addInvestmentTransaction).toHaveBeenCalledWith(1, 66, 'Emergency Fund', {"),
    ("expect(client.updatePeriodIncomeBudget).toHaveBeenCalledWith(67, 'Salary', {", "expect(client.updatePeriodIncomeBudget).toHaveBeenCalledWith(1, 67, 'Salary', {"),
    ("expect(client.addIncomeToPeriod).toHaveBeenCalledWith(63, {", "expect(client.addIncomeToPeriod).toHaveBeenCalledWith(1, 63, {"),
    ("expect(client.addIncomeToPeriod).toHaveBeenCalledWith(68, {", "expect(client.addIncomeToPeriod).toHaveBeenCalledWith(1, 68, {"),
    ("expect(client.addExpenseToPeriod).toHaveBeenCalledWith(69, {", "expect(client.addExpenseToPeriod).toHaveBeenCalledWith(1, 69, {"),
    ("expect(client.addIncomeTransaction).toHaveBeenCalledWith(70, 'Salary', {", "expect(client.addIncomeTransaction).toHaveBeenCalledWith(1, 70, 'Salary', {"),
    ("expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(58, 'Emergency Fund', 'Paid', null)", "expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(1, 58, 'Emergency Fund', 'Paid', null)"),
    ("expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(59, 'Utilities', 'Revised', null)", "expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(1, 59, 'Utilities', 'Revised', null)"),
    ("expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(60, 'Brokerage', 'Revised', null)", "expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(1, 60, 'Brokerage', 'Revised', null)"),
]
for old, new in replacements:
    content = content.replace(old, new)

pdp.write_text(content)
print("Updated PeriodDetailPage.test.jsx")

# ── BudgetPeriodsPage.test.jsx ───────────────────────────────────────────────
bpp = TEST_DIR / "BudgetPeriodsPage.test.jsx"
content = bpp.read_text()
content = content.replace(
    "expect(client.deletePeriod).toHaveBeenCalledWith(51, 'future_chain')",
    "expect(client.deletePeriod).toHaveBeenCalledWith(1, 51, 'future_chain')"
)
bpp.write_text(content)
print("Updated BudgetPeriodsPage.test.jsx")

# ── Dashboard.test.jsx ───────────────────────────────────────────────────────
dash = TEST_DIR / "Dashboard.test.jsx"
content = dash.read_text()
content = content.replace("toBe('/periods/99')", "toBe('/budgets/1/periods/99')")
dash.write_text(content)
print("Updated Dashboard.test.jsx")
