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
    acceptable_expense_overrun_pct: 10,
    comfortable_surplus_buffer_pct: 5,
    maximum_deficit_amount: null,
    revision_sensitivity: 50,
    savings_priority: 50,
    period_criticality_bias: 50,
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
        weight: 0.2,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 0,
        personalisation_key: null,
        personalisation_value: null,
      },
      {
        metric_id: 102,
        template_key: null,
        name: 'Custom Metric',
        description: 'A user-built metric.',
        scope: 'CURRENT_PERIOD',
        weight: 0.15,
        scoring_sensitivity: 30,
        is_enabled: true,
        display_order: 1,
        personalisation_key: 'threshold',
        personalisation_value: 0.8,
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

  it('renders budget-backed values and resets back to defaults', async () => {
    const customBudget = {
      ...budget,
      acceptable_expense_overrun_pct: 15,
      comfortable_surplus_buffer_pct: 20,
      maximum_deficit_amount: 75,
    }

    renderWithProviders(<PersonalisationTab budgetId={1} budget={customBudget} />)

    const overrunInput = screen.getByLabelText('When would an expense going over budget start to feel uncomfortable?')
    const deficitInput = screen.getByLabelText('At what point will a budget deficit start raising a budget health concern?')
    const amountInput = screen.getByLabelText('Maximum deficit amount')

    expect(overrunInput.value).toBe('15')
    expect(deficitInput.value).toBe('20')
    expect(amountInput.value).toBe('75.00')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    expect(overrunInput.value).toBe('10')
    expect(deficitInput.value).toBe('5')
    expect(amountInput.value).toBe('')
  })

  it('autosaves meaningful changes and ignores invalid maximum deficit input', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    const amountInput = screen.getByLabelText('Maximum deficit amount')
    fireEvent.change(amountInput, { target: { value: '12.345' } })
    expect(amountInput.value).toBe('12.35')

    await act(async () => {
      jest.advanceTimersByTime(450)
    })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1', expect.objectContaining({
        maximum_deficit_amount: '12.35',
      }))
    })
  })

  it('shows the save error message when autosave fails', async () => {
    api.patch.mockRejectedValue({
      response: {
        data: {
          detail: 'Unable to save preferences right now.',
        },
      },
    })

    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    fireEvent.change(
      screen.getByLabelText('How quickly should repeated plan changes start to feel like a warning sign?'),
      { target: { value: '8' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(450)
    })

    expect(await screen.findByText('Unable to save preferences right now.')).toBeTruthy()
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

  it('allows changing the weight of a matrix item', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const weightInputs = screen.getAllByLabelText('Weight')
    fireEvent.change(weightInputs[0], { target: { value: '0.5' } })
    fireEvent.mouseUp(weightInputs[0])

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', expect.objectContaining({ weight: 0.5 }))
    })
  })

  it('allows changing the scoring sensitivity of a matrix item', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const sensitivityInputs = screen.getAllByLabelText('Scoring Sensitivity')
    fireEvent.change(sensitivityInputs[0], { target: { value: '75' } })
    fireEvent.mouseUp(sensitivityInputs[0])

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', expect.objectContaining({ scoring_sensitivity: 75 }))
    })
  })

  it('allows editing the personalisation value of a metric', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Custom Metric')
    const persInput = screen.getByLabelText('Personalisation (threshold)')
    fireEvent.change(persInput, { target: { value: '0.95' } })
    fireEvent.blur(persInput)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/personalisation/102', {
        personalisation_key: 'threshold',
        value: '0.95',
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
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Matrix unavailable.')).toBeTruthy()
  })

  it('changes health tone when a tone option is selected', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Tone')
    fireEvent.click(screen.getByText('Factual'))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1', { health_tone: 'factual' })
    })
  })
})
