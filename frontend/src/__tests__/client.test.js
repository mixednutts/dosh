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
