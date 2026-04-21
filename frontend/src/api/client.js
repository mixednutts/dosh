import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export default api

function getAttachmentFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1])
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1] || fallback
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = globalThis.URL.createObjectURL(blob)
  const link = globalThis.document.createElement('a')
  link.href = objectUrl
  link.download = filename
  globalThis.document.body.appendChild(link)
  link.click()
  link.remove()
  globalThis.URL.revokeObjectURL(objectUrl)
}

export const getAppInfo = () => api.get('/info').then(r => r.data)
export const getReleaseNotes = () => api.get('/release-notes').then(r => r.data)

// ── Budgets ──────────────────────────────────────────────────────────────────
export const getBudgets = () => api.get('/budgets/').then(r => r.data)
export const getBudget = id => api.get(`/budgets/${id}`).then(r => r.data)
export const getBudgetHealth = id => api.get(`/budgets/${id}/health`).then(r => r.data)
export const getBudgetHealthMatrix = id => api.get(`/budgets/${id}/health-matrix/`).then(r => r.data)
export const updateMatrixItem = (id, metricKey, data) => api.patch(`/budgets/${id}/health-matrix/items/${metricKey}`, data).then(r => r.data)
export const getBudgetSetupAssessment = id => api.get(`/budgets/${id}/setup-assessment`).then(r => r.data)
export const getLocalisationOptions = () => api.get('/budgets/localisation-options').then(r => r.data)
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
  api.get(`/budgets/${budgetId}/periods`).then(r => r.data)
export const getPeriodSummariesForBudget = budgetId =>
  api.get(`/budgets/${budgetId}/periods/summary`).then(r => r.data)
export const getPeriodDetail = (budgetId, periodId) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}`).then(r => r.data)
export const getPeriodDeleteOptions = (budgetId, periodId) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/delete-options`).then(r => r.data)
export const getPeriodCloseoutPreview = (budgetId, periodId) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/closeout-preview`).then(r => r.data)
export const exportPeriod = async (budgetId, periodId, format) => {
  const response = await api.get(`/budgets/${budgetId}/periods/${periodId}/export`, {
    params: { format },
    responseType: 'blob',
  })
  const filename = getAttachmentFilename(
    response.headers?.['content-disposition'],
    `dosh-budget-cycle-export.${format}`
  )
  triggerBrowserDownload(response.data, filename)
  return filename
}
export const generatePeriod = data => api.post(`/budgets/${data.budgetid}/periods/generate`, data).then(r => r.data)
export const setPeriodLock = (budgetId, periodId, islocked) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/lock`, { islocked }).then(r => r.data)
export const closeOutPeriod = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/closeout`, data).then(r => r.data)
export const deletePeriod = (budgetId, periodId, deleteMode = 'single') =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}?delete_mode=${deleteMode}`)

export const updateIncomeActual = (budgetId, periodId, desc, actualamount) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}`, { actualamount }).then(r => r.data)
export const addToIncomeActual = (budgetId, periodId, desc, amount) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/add`, { amount }).then(r => r.data)
export const getIncomeTransactions = (budgetId, periodId, desc) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/`).then(r => r.data)
export const addIncomeTransaction = (budgetId, periodId, desc, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/`, data).then(r => r.data)
export const deleteIncomeTransaction = (budgetId, periodId, desc, txId) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/transactions/${txId}`)
export const updateExpenseActual = (budgetId, periodId, desc, actualamount) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}`, { actualamount }).then(r => r.data)
export const addToExpenseActual = (budgetId, periodId, desc, amount) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}/add`, { amount }).then(r => r.data)
export const addExpenseToPeriod = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/add-expense`, data).then(r => r.data)
export const addIncomeToPeriod = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/add-income`, data).then(r => r.data)
export const accountTransfer = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/account-transfer`, data).then(r => r.data)
export const deletePeriodForce = (budgetId, periodId, force = false) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}?force=${force}`)
export const reorderPeriodExpenses = (budgetId, periodId, items) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/expenses/reorder`, { items })

// ── Expense Entries ───────────────────────────────────────────────────────────
export const getExpenseEntries = (budgetId, periodId, desc) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/`).then(r => r.data)
export const addExpenseEntry = (budgetId, periodId, desc, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/`, data).then(r => r.data)
export const deleteExpenseEntry = (budgetId, periodId, desc, entryId) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}/expenses/${encodeURIComponent(desc)}/entries/${entryId}`)

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
export const getPeriodBalances = (budgetId, periodId) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/balances`).then(r => r.data)
export const getBalanceTransactions = (budgetId, periodId, balancedesc) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/balances/${encodeURIComponent(balancedesc)}/transactions`).then(r => r.data)

export const setPeriodExpenseStatus = (budgetId, periodId, desc, status, revision_comment = null) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}/status`, { status, revision_comment }).then(r => r.data)
export const updatePeriodExpensePayType = (budgetId, periodId, desc, paytype) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}/paytype`, { paytype }).then(r => r.data)
export const runPeriodAutoExpenses = (budgetId, periodId) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/run-auto-expenses`).then(r => r.data)

export const updatePeriodExpenseBudget = (budgetId, periodId, desc, data) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)

export const updatePeriodIncomeBudget = (budgetId, periodId, desc, data) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)

export const removePeriodExpense = (budgetId, periodId, desc) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}/expense/${encodeURIComponent(desc)}`)
export const removePeriodIncome = (budgetId, periodId, desc) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}`)
export const setPeriodIncomeStatus = (budgetId, periodId, desc, status, revision_comment = null) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/income/${encodeURIComponent(desc)}/status`, { status, revision_comment }).then(r => r.data)

export const updatePeriodInvestmentBudget = (budgetId, periodId, desc, data) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/investment/${encodeURIComponent(desc)}/budget`, data).then(r => r.data)
export const setPeriodInvestmentStatus = (budgetId, periodId, desc, status, revision_comment = null) =>
  api.patch(`/budgets/${budgetId}/periods/${periodId}/investment/${encodeURIComponent(desc)}/status`, { status, revision_comment }).then(r => r.data)

// ── Investment Transactions ───────────────────────────────────────────────────
export const getInvestmentTransactions = (budgetId, periodId, desc) =>
  api.get(`/budgets/${budgetId}/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/`).then(r => r.data)
export const addInvestmentTransaction = (budgetId, periodId, desc, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/`, data).then(r => r.data)
export const deleteInvestmentTransaction = (budgetId, periodId, desc, txId) =>
  api.delete(`/budgets/${budgetId}/periods/${periodId}/investments/${encodeURIComponent(desc)}/transactions/${txId}`)

// ── Backup / Restore ─────────────────────────────────────────────────────────
export const backupBudget = async (budgetId = null) => {
  const formData = new FormData()
  if (budgetId !== null) {
    formData.append('budgetid', budgetId)
  }
  const response = await api.post('/budgets/backup', formData, {
    responseType: 'blob',
  })
  const filename = getAttachmentFilename(
    response.headers?.['content-disposition'],
    budgetId !== null ? `dosh-backup-budget-${budgetId}.json` : 'dosh-backup-all.json'
  )
  triggerBrowserDownload(response.data, filename)
  return filename
}

export const inspectRestoreFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/budgets/restore/inspect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const applyRestore = (file, selectedIndices = [], allowOverwrite = false) => {
  const formData = new FormData()
  formData.append('file', file)
  if (selectedIndices.length > 0) {
    formData.append('selected_indices', selectedIndices.join(','))
  }
  formData.append('allow_overwrite', allowOverwrite ? 'true' : 'false')
  return api.post('/budgets/restore/apply', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
