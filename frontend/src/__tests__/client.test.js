const mockInstance = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => mockInstance) },
  create: jest.fn(() => mockInstance),
}))

function resetMocks() {
  jest.resetModules()
  Object.keys(mockInstance).forEach(key => mockInstance[key].mockReset())
}

describe('exportPeriod', () => {
  beforeEach(resetMocks)

  async function runExport(headers, expectedFilename, format = 'csv') {
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    const createElementSpy = jest.spyOn(document, 'createElement')
    const click = jest.fn()
    const remove = jest.fn()
    createElementSpy.mockReturnValue({ click, remove })
    global.URL.createObjectURL = jest.fn(() => 'blob:download')
    global.URL.revokeObjectURL = jest.fn()

    const blob = new Blob(['data'], { type: 'text/plain' })
    mockInstance.get.mockResolvedValue({ data: blob, headers })

    const { exportPeriod } = require('../api/client')
    const filename = await exportPeriod(12, format)

    expect(mockInstance.get).toHaveBeenCalledWith('/periods/12/export', {
      params: { format },
      responseType: 'blob',
    })
    expect(filename).toBe(expectedFilename)
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:download')

    appendSpy.mockRestore()
    createElementSpy.mockRestore()
  }

  it('uses the plain filename from content-disposition', async () => {
    await runExport(
      { 'content-disposition': 'attachment; filename="cycle-export.csv"' },
      'cycle-export.csv'
    )
  })

  it('decodes a UTF-8 filename* from content-disposition', async () => {
    await runExport(
      { 'content-disposition': "filename*=UTF-8''my%20export.json" },
      'my export.json',
      'json'
    )
  })

  it('falls back to a default filename when content-disposition is missing', async () => {
    await runExport({}, 'dosh-budget-cycle-export.csv')
  })
})

describe('budget and health client helpers', () => {
  beforeEach(resetMocks)

  it('fetches budgets and individual budget health', async () => {
    mockInstance.get.mockResolvedValue({ data: { budgets: [] } })
    const { getBudgets, getBudgetHealth } = require('../api/client')

    await getBudgets()
    expect(mockInstance.get).toHaveBeenCalledWith('/budgets/')

    mockInstance.get.mockResolvedValue({ data: { score: 80 } })
    const result = await getBudgetHealth(1)
    expect(mockInstance.get).toHaveBeenCalledWith('/budgets/1/health')
    expect(result).toEqual({ score: 80 })
  })

  it('creates and updates a budget', async () => {
    mockInstance.post.mockResolvedValue({ data: { budgetid: 3 } })
    mockInstance.patch.mockResolvedValue({ data: { ok: true } })
    const { createBudget, updateBudget } = require('../api/client')

    const created = await createBudget({ owner: 'me' })
    expect(mockInstance.post).toHaveBeenCalledWith('/budgets/', { owner: 'me' })
    expect(created).toEqual({ budgetid: 3 })

    const updated = await updateBudget(4, { description: 'updated' })
    expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/4', { description: 'updated' })
    expect(updated).toEqual({ ok: true })
  })

  it('manages health matrix items and custom metrics', async () => {
    mockInstance.patch.mockResolvedValue({ data: { ok: true } })
    mockInstance.post.mockResolvedValue({ data: { metric_id: 5 } })
    mockInstance.delete.mockResolvedValue({ data: { ok: true } })
    mockInstance.get.mockResolvedValue({ data: [] })
    const {
      updateMatrixItem,
      createCustomMetric,
      removeMatrixItem,
      getHealthScales,
    } = require('../api/client')

    await updateMatrixItem(1, 2, { weight: 0.5 })
    expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/2', { weight: 0.5 })

    const metric = await createCustomMetric(1, { name: 'M' })
    expect(mockInstance.post).toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', { name: 'M' })
    expect(metric).toEqual({ metric_id: 5 })

    await removeMatrixItem(1, 2)
    expect(mockInstance.delete).toHaveBeenCalledWith('/budgets/1/health-matrix/items/2')

    const scales = await getHealthScales(1)
    expect(mockInstance.get).toHaveBeenCalledWith('/budgets/1/health-matrix/scales')
    expect(scales).toEqual([])
  })
})

describe('period-critical client helpers', () => {
  beforeEach(resetMocks)

  it('generates a period and closes it out', async () => {
    mockInstance.post.mockResolvedValue({ data: { finperiodid: 2 } })
    const { generatePeriod, closeOutPeriod } = require('../api/client')

    const payload = { budgetid: 1, startdate: '2026-01-01', count: 1 }
    await generatePeriod(payload)
    expect(mockInstance.post).toHaveBeenCalledWith('/periods/generate', payload)

    await closeOutPeriod(4, { rollover: true })
    expect(mockInstance.post).toHaveBeenCalledWith('/periods/4/closeout', { rollover: true })
  })

  it('records an account transfer between two accounts', async () => {
    mockInstance.post.mockResolvedValue({ data: { ok: true } })
    const { accountTransfer } = require('../api/client')

    const payload = { from: 'A', to: 'B', amount: 100 }
    await accountTransfer(1, payload)
    expect(mockInstance.post).toHaveBeenCalledWith('/periods/1/account-transfer', payload)
  })

  it('updates period expense and investment budgets', async () => {
    mockInstance.patch.mockResolvedValue({ data: { ok: true } })
    const { updatePeriodExpenseBudget, updatePeriodInvestmentBudget } = require('../api/client')

    await updatePeriodExpenseBudget(1, 'Rent', { budgetamount: '1300.00' })
    expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/expense/Rent/budget', { budgetamount: '1300.00' })

    await updatePeriodInvestmentBudget(1, 'ETF', { budgetamount: '500.00' })
    expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/investment/ETF/budget', { budgetamount: '500.00' })
  })

  it('sets period expense and investment statuses', async () => {
    mockInstance.patch.mockResolvedValue({ data: { ok: true } })
    const { setPeriodExpenseStatus, setPeriodInvestmentStatus } = require('../api/client')

    await setPeriodExpenseStatus(1, 'Rent', 'PAID', 'all good')
    expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/expense/Rent/status', { status: 'PAID', revision_comment: 'all good' })

    await setPeriodInvestmentStatus(1, 'ETF', 'EXECUTED', 'done')
    expect(mockInstance.patch).toHaveBeenCalledWith('/periods/1/investment/ETF/status', { status: 'EXECUTED', revision_comment: 'done' })
  })

  it('fetches and deletes income transactions', async () => {
    mockInstance.get.mockResolvedValue({ data: [] })
    mockInstance.delete.mockResolvedValue({})
    const { getIncomeTransactions, deleteIncomeTransaction } = require('../api/client')

    await getIncomeTransactions(1, 'Salary')
    expect(mockInstance.get).toHaveBeenCalledWith('/periods/1/income/Salary/transactions/')

    await deleteIncomeTransaction(1, 'Salary', 5)
    expect(mockInstance.delete).toHaveBeenCalledWith('/periods/1/income/Salary/transactions/5')
  })

  it('adds and deletes expense entries', async () => {
    mockInstance.post.mockResolvedValue({ data: { ok: true } })
    mockInstance.delete.mockResolvedValue({})
    const { addExpenseEntry, deleteExpenseEntry } = require('../api/client')

    await addExpenseEntry(1, 'Rent', { amount: 50 })
    expect(mockInstance.post).toHaveBeenCalledWith('/periods/1/expenses/Rent/entries/', { amount: 50 })

    await deleteExpenseEntry(1, 'Rent', 3)
    expect(mockInstance.delete).toHaveBeenCalledWith('/periods/1/expenses/Rent/entries/3')
  })
})
