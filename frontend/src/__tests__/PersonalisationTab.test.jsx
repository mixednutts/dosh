import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import axios from 'axios'

import PersonalisationTab from '../pages/tabs/PersonalisationTab'
import { renderWithProviders } from '../testUtils'

jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  }
  return {
    __esModule: true,
    default: { create: jest.fn(() => mockInstance) },
    create: jest.fn(() => mockInstance),
  }
})

const api = axios.create()

describe('PersonalisationTab', () => {
  const budget = {
    health_tone: 'supportive',
  }

  const matrixResponse = {
    matrix_id: 1,
    budgetid: 1,
    name: 'Standard Budget Health',
    items: [
      {
        metric_id: 101,
        template_key: 'setup_health',
        name: 'Setup Health',
        description: 'Checks whether budget setup is complete.',
        scope: 'OVERALL',
        formula_expression: 'income_source_count + active_expense_count',
        formula_data_sources_json: ['income_source_count', 'active_expense_count'],
        weight: 0.2,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 0,
        personalisation_key: null,
        personalisation_value: null,
        personalisation_scale: null,
      },
      {
        metric_id: 102,
        template_key: null,
        name: 'Custom Metric',
        description: 'A user-built metric.',
        scope: 'CURRENT_PERIOD',
        formula_expression: 'total_budgeted_income / total_budgeted_expenses',
        formula_data_sources_json: ['total_budgeted_income', 'total_budgeted_expenses'],
        weight: 0.15,
        scoring_sensitivity: 30,
        is_enabled: true,
        display_order: 1,
        personalisation_key: 'threshold',
        personalisation_value: 0.8,
        personalisation_scale: {
          scale_key: 'percentage_0_100',
          scale_type: 'integer_range',
          min_value: 0,
          max_value: 100,
          unit_label: '%',
        },
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    api.get.mockImplementation((url) => {
      if (url === '/budgets/1/health-matrix/') {
        return Promise.resolve({ data: matrixResponse })
      }
      if (url === '/budgets/1/health-matrix/data-sources') {
        return Promise.resolve({
          data: [
            { source_key: 'total_budgeted_income', name: 'Total Budgeted Income', description: '', return_type: 'decimal' },
            { source_key: 'total_budgeted_expenses', name: 'Total Budgeted Expenses', description: '', return_type: 'decimal' },
          ],
        })
      }
      if (url === '/budgets/1/health-matrix/definitions') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: {} })
    })
    api.patch.mockResolvedValue({ data: { budgetid: 1, ...budget } })
    api.post.mockResolvedValue({ data: { metric_id: 103 } })
    api.delete.mockResolvedValue({ data: { ok: true } })
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('renders tone selector and allows changing tone', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Tone')).toBeTruthy()
    expect(screen.getByText('Supportive')).toBeTruthy()

    fireEvent.click(screen.getByText('Factual'))
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1', { health_tone: 'factual' })
    })
  })

  it('loads and displays the health matrix with items', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Matrix')).toBeTruthy()
    expect(await screen.findByText('Setup Health')).toBeTruthy()
    expect(screen.getByText('Custom Metric')).toBeTruthy()
    expect(screen.getByText('A user-built metric.')).toBeTruthy()
  })

  it('allows toggling a matrix item on and off', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const setupCheckbox = screen.getAllByRole('checkbox', { name: 'Enabled' })[0]

    fireEvent.click(setupCheckbox)
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', { is_enabled: false })
    })
  })

  it('allows expanding metric card to view details', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    expect(viewEditButtons.length).toBe(2)

    fireEvent.click(viewEditButtons[0])
    expect(await screen.findByText('Formula')).toBeTruthy()
    expect(screen.getByText('income_source_count + active_expense_count')).toBeTruthy()
  })

  it('allows changing the weight of a matrix item', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(viewEditButtons[0])

    const weightInput = await screen.findByLabelText('Weight')
    fireEvent.change(weightInput, { target: { value: '0.5' } })
    fireEvent.mouseUp(weightInput)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', expect.objectContaining({ weight: 0.5 }))
    })
  })

  it('allows changing the scoring sensitivity of a matrix item', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(viewEditButtons[0])

    const sensitivityInput = await screen.findByLabelText('Scoring Sensitivity')
    fireEvent.change(sensitivityInput, { target: { value: '75' } })
    fireEvent.mouseUp(sensitivityInput)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', expect.objectContaining({ scoring_sensitivity: 75 }))
    })
  })

  it('allows editing the personalisation value of a metric', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Custom Metric')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(viewEditButtons[1])

    const persLabel = await screen.findByText('Personalisation: threshold')
    expect(persLabel).toBeTruthy()

    // The percentage slider should be visible
    const slider = screen.getByLabelText('Value')
    fireEvent.change(slider, { target: { value: '95' } })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/personalisation/102', {
        personalisation_key: 'threshold',
        value: 95,
      })
    })
  })

  it('allows removing a custom metric', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Custom Metric')
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    expect(removeButtons.length).toBe(1)

    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/budgets/1/health-matrix/items/102')
    })
  })

  it('shows metric builder when Add Metric is clicked and hides on cancel', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    expect(screen.getByText('Create Custom Metric')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Create Custom Metric')).toBeNull()
  })

  it('creates a custom metric with valid inputs', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Savings Rate' } })
    fireEvent.change(screen.getByLabelText('Formula'), { target: { value: 'total_budgeted_income' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create Metric' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', expect.objectContaining({
        name: 'Savings Rate',
        formula_expression: 'total_budgeted_income',
        data_sources: ['total_budgeted_income'],
      }))
    })
  })

  it('shows validation error when creating a metric without a name', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    fireEvent.click(screen.getByRole('button', { name: 'Create Metric' }))

    expect(await screen.findByText('Metric name is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', expect.anything())
  })

  it('shows validation error when creating a metric without a formula', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Metric' }))

    expect(await screen.findByText('Formula expression is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', expect.anything())
  })

  it('displays an error when health matrix fails to load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/budgets/1/health-matrix/') {
        return Promise.reject({ response: { data: { detail: 'Matrix unavailable.' } } })
      }
      if (url === '/budgets/1/health-matrix/data-sources') {
        return Promise.resolve({
          data: [
            { source_key: 'total_budgeted_income', name: 'Total Budgeted Income', description: '', return_type: 'decimal' },
          ],
        })
      }
      if (url === '/budgets/1/health-matrix/definitions') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Matrix unavailable.')).toBeTruthy()
  })
})
