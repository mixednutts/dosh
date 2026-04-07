import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export default api

export const getAppInfo = () => api.get('/info').then(r => r.data)
export const getReleaseNotes = () => api.get('/release-notes').then(r => r.data)

// ── Budgets ──────────────────────────────────────────────────────────────────
export const getBudgets = () => api.get('/budgets/').then(r => r.data)
export const getBudget = id => api.get(`/budgets/${id}`).then(r => r.data)
export const getBudgetHealth = id => api.get(`/budgets/${id}/health`).then(r => r.data)
export const getBudgetSetupAssessment = id => api.get(`/budgets/${id}/setup-assessment`).then(r => r.data)
export const createBudget = data => api.post('/budgets/', data).then(r => r.data)
export const createDemoBudget = () => api.post('/budgets/demo').then(r => r.data)
export const updateBudget = (id, data) => api.patch(`/budgets/${id}`, data).then(r => r.data)
export const deleteBudget = id => api.delete(`/budgets/${id}`)

// ── Income Types ──────────────────────────────────────────────────────────────
export const getIncomeTypes = budgetId =>
  api.get(`/budgets/${budgetId}/income-types/`).then(r => r.data)
export const createIncomeType = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/income-types/`, data).then(r => r.data)
export const updateIncomeType = (budgetId, desc, data) =>
  api.patch(`/budgets/${budgetId}/income-types/${encodeURIComponent(desc)}`, data).then(r => r.data)
export const deleteIncomeType = (budgetId, desc) =>
  api.delete(`/budgets/${budgetId}/income-types/${encodeURIComponent(desc)}`)
export const getIncomeTypeHistory = (budgetId, desc) =>
  api.get(`/budgets/${budgetId}/income-types/${encodeURIComponent(desc)}/history`).then(r => r.data)

// ── Expense Items ─────────────────────────────────────────────────────────────
export const getExpenseItems = (budgetId, activeOnly = false) =>
  api.get(`/budgets/${budgetId}/expense-items/`, { params: { active_only: activeOnly } }).then(r => r.data)
export const createExpenseItem = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/expense-items/`, data).then(r => r.data)
export const updateExpenseItem = (budgetId, desc, data) =>
  api.patch(`/budgets/${budgetId}/expense-items/${encodeURIComponent(desc)}`, data).then(r => r.data)
export const deleteExpenseItem = (budgetId, desc) =>
  api.delete(`/budgets/${budgetId}/expense-items/${encodeURIComponent(desc)}`)
export const reorderExpenseItems = (budgetId, items) =>
  api.patch(`/budgets/${budgetId}/expense-items/reorder`, { items })
export const getExpenseItemHistory = (budgetId, desc) =>
  api.get(`/budgets/${budgetId}/expense-items/${encodeURIComponent(desc)}/history`).then(r => r.data)

// ── Investment Items ──────────────────────────────────────────────────────────
export const getInvestmentItems = budgetId =>
  api.get(`/budgets/${budgetId}/investment-items/`).then(r => r.data)
export const createInvestmentItem = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/investment-items/`, data).then(r => r.data)
export const updateInvestmentItem = (budgetId, desc, data) =>
  api.patch(`/budgets/${budgetId}/investment-items/${encodeURIComponent(desc)}`, data).then(r => r.data)
export const deleteInvestmentItem = (budgetId, desc) =>
  api.delete(`/budgets/${budgetId}/investment-items/${encodeURIComponent(desc)}`)
export const getInvestmentItemHistory = (budgetId, desc) =>
  api.get(`/budgets/${budgetId}/investment-items/${encodeURIComponent(desc)}/history`).then(r => r.data)

// ── Periods ───────────────────────────────────────────────────────────────────
export const getPeriodsForBudget = budgetId =>
  api.get(`/periods/budget/${budgetId}`).then(r => r.data)
export const getPeriodSummariesForBudget = budgetId =>
  api.get(`/periods/budget/${budgetId}/summary`).then(r => r.data)
export const getPeriodDetail = periodId =>
  api.get(`/periods/${periodId}`).then(r => r.data)
export const getPeriodDeleteOptions = periodId =>
  api.get(`/periods/${periodId}/delete-options`).then(r => r.data)
export const getPeriodCloseoutPreview = periodId =>
  api.get(`/periods/${periodId}/closeout-preview`).then(r => r.data)
export const generatePeriod = data => api.post('/periods/generate', data).then(r => r.data)
export const setPeriodLock = (periodId, islocked) =>
  api.patch(`/periods/${periodId}/lock`, { islocked }).then(r => r.data)
export const closeOutPeriod = (periodId, data) =>
  api.post(`/periods/${periodId}/closeout`, data).then(r => r.data)
export const deletePeriod = (periodId, deleteMode = 'single') =>
  api.delete(`/periods/${periodId}?delete_mode=${deleteMode}`)

export const updateIncomeActual = (periodId, desc, actualamount) =>
  api.patch(`/periods/${periodId}/income/${encodeURIComponent(desc)}`, { actualamount }).then(r => r.data)
export const addToIncomeActual = (periodId, desc, amount) =>
  api.post(`/periods/${periodId}/income/${encodeURIComponent(desc)}/add`, { amount }).then(r => r.data)
export const getIncomeTransactions = (periodId, desc) =>
  api.get(`/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/`).then(r => r.data)
export const addIncomeTransaction = (periodId, desc, data) =>
  api.post(`/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/`, data).then(r => r.data)
export const deleteIncomeTransaction = (periodId, desc, txId) =>
  api.delete(`/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/${txId}`)
export const updateExpenseActual = (periodId, desc, actualamount) =>
  api.patch(`/periods/${periodId}/expense/${encodeURIComponent(desc)}`, { actualamount }).then(r => r.data)
export const addToExpenseActual = (periodId, desc, amount) =>
  api.post(`/periods/${periodId}/expense/${encodeURIComponent(desc)}/add`, { amount }).then(r => r.data)
export const addExpenseToPeriod = (periodId, data) =>
  api.post(`/periods/${periodId}/add-expense`, data).then(r => r.data)
export const addIncomeToPeriod = (periodId, data) =>
  api.post(`/periods/${periodId}/add-income`, data).then(r => r.data)
export const savingsTransfer = (periodId, data) =>
  api.post(`/periods/${periodId}/savings-transfer`, data).then(r => r.data)
export const deletePeriodForce = (periodId, force = false) =>
  api.delete(`/periods/${periodId}?force=${force}`)
export const reorderPeriodExpenses = (periodId, items) =>
  api.patch(`/periods/${periodId}/expenses/reorder`, { items })

// ── Expense Entries ───────────────────────────────────────────────────────────
export const getExpenseEntries = (periodId, desc) =>
  api.get(`/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/`).then(r => r.data)
export const addExpenseEntry = (periodId, desc, data) =>
  api.post(`/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/`, data).then(r => r.data)
export const deleteExpenseEntry = (periodId, desc, entryId) =>
  api.delete(`/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/${entryId}`)

// ── Balance Types ─────────────────────────────────────────────────────────────
export const getBalanceTypes = budgetId =>
  api.get(`/budgets/${budgetId}/balance-types/`).then(r => r.data)
export const createBalanceType = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/balance-types/`, data).then(r => r.data)
export const updateBalanceType = (budgetId, desc, data) =>
  api.patch(`/budgets/${budgetId}/balance-types/${encodeURIComponent(desc)}`, data).then(r => r.data)
export const deleteBalanceType = (budgetId, desc) =>
  api.delete(`/budgets/${budgetId}/balance-types/${encodeURIComponent(desc)}`)

// ── Period Balances ───────────────────────────────────────────────────────────
export const getPeriodBalances = periodId =>
  api.get(`/periods/${periodId}/balances`).then(r => r.data)
export const getBalanceTransactions = (periodId, balancedesc) =>
  api.get(`/periods/${periodId}/balances/${encodeURIComponent(balancedesc)}/transactions`).then(r => r.data)

export const setPeriodExpenseStatus = (periodId, desc, status, revision_comment = null) =>
  api.patch(`/periods/${periodId}/expense/${encodeURIComponent(desc)}/status`, { status, revision_comment }).then(r => r.data)

export const updatePeriodExpenseBudget = (periodId, desc, data) =>
  api.patch(`/periods/${periodId}/expense/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)

export const updatePeriodIncomeBudget = (periodId, desc, data) =>
  api.patch(`/periods/${periodId}/income/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)

export const removePeriodExpense = (periodId, desc) =>
  api.delete(`/periods/${periodId}/expense/${encodeURIComponent(desc)}`)
export const removePeriodIncome = (periodId, desc) =>
  api.delete(`/periods/${periodId}/income/${encodeURIComponent(desc)}`)

export const updatePeriodInvestmentBudget = (periodId, desc, data) =>
  api.patch(`/periods/${periodId}/investment/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)
export const setPeriodInvestmentStatus = (periodId, desc, status, revision_comment = null) =>
  api.patch(`/periods/${periodId}/investment/${encodeURIComponent(desc)}/status`, { status, revision_comment }).then(r => r.data)

// ── Investment Transactions ───────────────────────────────────────────────────
export const getInvestmentTransactions = (periodId, desc) =>
  api.get(`/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/`).then(r => r.data)
export const addInvestmentTransaction = (periodId, desc, data) =>
  api.post(`/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/`, data).then(r => r.data)
export const deleteInvestmentTransaction = (periodId, desc, txId) =>
  api.delete(`/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/${txId}`)
