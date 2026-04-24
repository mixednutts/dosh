const mockInstance = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => mockInstance) },
  create: jest.fn(() => mockInstance),
}))

function resetMocks() {
  jest.resetModules()
  Object.keys(mockInstance).forEach(key => {
    if (typeof mockInstance[key] === 'function' && mockInstance[key].mockReset) {
      mockInstance[key].mockReset()
    }
  })
  mockInstance.interceptors.request.use.mockReset()
  mockInstance.interceptors.response.use.mockReset()
}

describe('budget and health client helpers', () => {
  beforeEach(resetMocks)

  it('fetches budgets and individual budget health', async () => {
    mockInstance.get.mockResolvedValueOnce({ data: { budgets: [] } })
    mockInstance.get.mockResolvedValueOnce({ data: { score: 80 } })
    const { getBudgets, getBudgetHealth } = require('../api/client')

    await getBudgets()
    expect(mockInstance.get).toHaveBeenCalledWith('/budgets/')

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

  it('manages health matrix items', async () => {
    mockInstance.patch.mockResolvedValue({ data: { ok: true } })
    const { updateMatrixItem } = require('../api/client')

    await updateMatrixItem(1, 'setup_health', { weight: 0.5 })
    expect(mockInstance.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/setup_health', { weight: 0.5 })
  })
})

describe('download and export helpers', () => {
  let originalCreateElement
  let originalAppendChild
  let originalCreateObjectURL
  let originalRevokeObjectURL

  beforeEach(() => {
    resetMocks()
    originalCreateElement = globalThis.document.createElement
    originalAppendChild = globalThis.document.body.appendChild
    originalCreateObjectURL = globalThis.URL.createObjectURL
    originalRevokeObjectURL = globalThis.URL.revokeObjectURL

    globalThis.document.createElement = jest.fn((tag) => {
      if (tag === 'a') {
        return { click: jest.fn(), href: '', download: '', remove: jest.fn() }
      }
      return originalCreateElement.call(globalThis.document, tag)
    })
    globalThis.document.body.appendChild = jest.fn(() => {})
    globalThis.URL.createObjectURL = jest.fn(() => 'blob:url')
    globalThis.URL.revokeObjectURL = jest.fn(() => {})
  })

  afterEach(() => {
    globalThis.document.createElement = originalCreateElement
    globalThis.document.body.appendChild = originalAppendChild
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('exports a period and triggers browser download', async () => {
    const mockBlob = new Blob(['csv,data'])
    mockInstance.get.mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': 'attachment; filename="dosh-export.csv"' },
    })

    const { exportPeriod } = require('../api/client')
    const result = await exportPeriod(1, 5, 'csv')

    expect(mockInstance.get).toHaveBeenCalledWith('/budgets/1/periods/5/export', {
      params: { format: 'csv' },
      responseType: 'blob',
    })
    expect(result).toBe('dosh-export.csv')
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url')
  })

  it('handles missing content-disposition with fallback filename', async () => {
    const mockBlob = new Blob(['json,data'])
    mockInstance.get.mockResolvedValue({ data: mockBlob, headers: {} })

    const { exportPeriod } = require('../api/client')
    const result = await exportPeriod(2, 10, 'json')

    expect(result).toBe('dosh-budget-cycle-export.json')
  })

  it('parses UTF-8 encoded filename from content-disposition', async () => {
    const mockBlob = new Blob(['data'])
    mockInstance.get.mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': "attachment; filename*=UTF-8''dosh-%C3%A9xport.csv" },
    })

    const { exportPeriod } = require('../api/client')
    const result = await exportPeriod(1, 1, 'csv')

    expect(result).toBe('dosh-éxport.csv')
  })

  it('backs up a single budget and triggers download', async () => {
    const mockBlob = new Blob(['backup'])
    mockInstance.post.mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': 'attachment; filename="budget-1.json"' },
    })

    const { backupBudget } = require('../api/client')
    const result = await backupBudget(1)

    const callArgs = mockInstance.post.mock.calls[0]
    expect(callArgs[0]).toBe('/budgets/backup')
    expect(callArgs[1].get('budgetid')).toBe('1')
    expect(callArgs[2]).toEqual({ responseType: 'blob' })
    expect(result).toBe('budget-1.json')
  })

  it('backs up all budgets when no budgetId is provided', async () => {
    const mockBlob = new Blob(['all-backup'])
    mockInstance.post.mockResolvedValue({ data: mockBlob, headers: {} })

    const { backupBudget } = require('../api/client')
    const result = await backupBudget()

    const callArgs = mockInstance.post.mock.calls[0]
    expect(callArgs[0]).toBe('/budgets/backup')
    expect(callArgs[1].get('budgetid')).toBeNull()
    expect(result).toBe('dosh-backup-all.json')
  })
})

describe('restore helpers', () => {
  beforeEach(resetMocks)

  it('inspects a restore file', async () => {
    mockInstance.post.mockResolvedValue({ data: { budgets: [{ description: 'Test' }] } })

    const { inspectRestoreFile } = require('../api/client')
    const mockFile = new File(['content'], 'backup.json', { type: 'application/json' })
    const result = await inspectRestoreFile(mockFile)

    const callArgs = mockInstance.post.mock.calls[0]
    expect(callArgs[0]).toBe('/budgets/restore/inspect')
    expect(callArgs[1].get('file')).toBe(mockFile)
    expect(callArgs[2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
    expect(result).toEqual({ budgets: [{ description: 'Test' }] })
  })

  it('applies restore with selected indices and overwrite flag', async () => {
    mockInstance.post.mockResolvedValue({ data: { restored: 2 } })

    const { applyRestore } = require('../api/client')
    const mockFile = new File(['content'], 'backup.json')
    const result = await applyRestore(mockFile, [0, 2], true)

    const callArgs = mockInstance.post.mock.calls[0]
    expect(callArgs[0]).toBe('/budgets/restore/apply')
    expect(callArgs[1].get('file')).toBe(mockFile)
    expect(callArgs[1].get('selected_indices')).toBe('0,2')
    expect(callArgs[1].get('allow_overwrite')).toBe('true')
    expect(result).toEqual({ restored: 2 })
  })

  it('applies restore with defaults (no indices, no overwrite)', async () => {
    mockInstance.post.mockResolvedValue({ data: { restored: 1 } })

    const { applyRestore } = require('../api/client')
    const mockFile = new File(['content'], 'backup.json')
    const result = await applyRestore(mockFile)

    const callArgs = mockInstance.post.mock.calls[0]
    expect(callArgs[1].get('selected_indices')).toBeNull()
    expect(callArgs[1].get('allow_overwrite')).toBe('false')
    expect(result).toEqual({ restored: 1 })
  })
})
