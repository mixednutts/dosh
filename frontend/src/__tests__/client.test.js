const mockGet = jest.fn()

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: mockGet,
  })),
}))

describe('exportPeriod', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGet.mockReset()
  })

  it('requests a blob export and triggers a browser download using the attachment filename', async () => {
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    const createElementSpy = jest.spyOn(document, 'createElement')
    const click = jest.fn()
    const remove = jest.fn()
    createElementSpy.mockReturnValue({ click, remove })
    global.URL.createObjectURL = jest.fn(() => 'blob:download')
    global.URL.revokeObjectURL = jest.fn()

    const blob = new Blob(['csv-data'], { type: 'text/csv' })
    mockGet.mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="cycle-export.csv"' },
    })

    const { exportPeriod } = require('../api/client')
    const filename = await exportPeriod(12, 'csv')

    expect(mockGet).toHaveBeenCalledWith('/periods/12/export', {
      params: { format: 'csv' },
      responseType: 'blob',
    })
    expect(filename).toBe('cycle-export.csv')
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:download')

    appendSpy.mockRestore()
    createElementSpy.mockRestore()
  })
})
