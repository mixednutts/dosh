import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import axios from 'axios'

import BudgetHealthTab from '../pages/tabs/BudgetHealthTab'
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

describe('BudgetHealthTab', () => {
  const budget = {
    health_tone: 'supportive',
  }

  const matrixResponse = {
    matrix_id: 1,
    budgetid: 1,
    name: 'Standard Budget Health',
    based_on_template_key: 'standard_budget_health',
    template_name: 'Standard Budget Health',
    is_customized: false,
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
        threshold_value: null,
        threshold_scale: null,
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
        threshold_value: 80,
        threshold_scale: {
          scale_key: 'percentage_0_100',
          scale_type: 'integer_range',
          min_value: 0,
          max_value: 100,
          unit_label: '%',
        },
      },
      {
        metric_id: 103,
        template_key: 'planning_stability',
        name: 'Planning Stability',
        description: 'Tracks off-plan activity.',
        scope: 'BOTH',
        formula_expression: 'revised_line_count',
        formula_data_sources_json: ['revised_line_count'],
        weight: 0.25,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 2,
        threshold_value: null,
        threshold_scale: null,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    api.get.mockImplementation((url) => {
      if (url === '/info') {
        return Promise.resolve({ data: { app: 'Dosh', version: '0.0.0', schema_revision: 'abc', dev_mode: false } })
      }
      if (url === '/budgets/1/health-matrix/') {
        return Promise.resolve({ data: matrixResponse })
      }
      if (url === '/budgets/1/health-matrix/templates') {
        return Promise.resolve({
          data: [
            { template_key: 'standard_budget_health', name: 'Standard Budget Health', description: '', is_system: true },
            { template_key: 'minimal', name: 'Minimal', description: '', is_system: false },
          ],
        })
      }
      if (url === '/budgets/1/health-matrix/data-sources') {
        return Promise.resolve({
          data: [
            { source_key: 'total_budgeted_income', name: 'Total Budgeted Income', description: '', return_type: 'decimal' },
            { source_key: 'total_budgeted_expenses', name: 'Total Budgeted Expenses', description: '', return_type: 'decimal' },
          ],
        })
      }
      if (url === '/budgets/1/health-matrix/scales') {
        return Promise.resolve({
          data: [
            { scale_key: 'percentage_0_100', name: 'Percentage (0-100)', scale_type: 'integer_range', min_value: 0, max_value: 100, unit_label: '%' },
            { scale_key: 'dollar_amount', name: 'Dollar Amount', scale_type: 'money', unit_label: '$' },
          ],
        })
      }
      return Promise.resolve({ data: {} })
    })
    api.patch.mockResolvedValue({ data: { budgetid: 1, ...budget } })
    api.post.mockResolvedValue({ data: { metric_id: 104 } })
    api.delete.mockResolvedValue({ data: { ok: true } })
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('renders tone selector and allows changing tone', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Tone')).toBeTruthy()
    expect(screen.getByText('Supportive')).toBeTruthy()

    fireEvent.click(screen.getByText('Factual'))
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1', { health_tone: 'factual' })
    })
  })

  it('loads and displays the health matrix with items', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Matrix')).toBeTruthy()
    expect(await screen.findByText('Setup Health')).toBeTruthy()
    expect(screen.getByText('Custom Metric')).toBeTruthy()
    expect(screen.getByText('A user-built metric.')).toBeTruthy()
  })

  it('shows template selector with current template', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Matrix Template')).toBeTruthy()
    expect(screen.getByText(/Current: Standard Budget Health/)).toBeTruthy()
  })

  it('allows applying a different template', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix Template')
    const select = screen.getByDisplayValue('Standard Budget Health')
    fireEvent.change(select, { target: { value: 'minimal' } })

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/budgets/1/health-matrix/apply-template', { template_key: 'minimal' })
    })
  })

  it('shows customized badge and allows reset when customized', async () => {
    const customizedResponse = { ...matrixResponse, is_customized: true }
    api.get.mockImplementation((url) => {
      if (url === '/info') {
        return Promise.resolve({ data: { app: 'Dosh', version: '0.0.0', schema_revision: 'abc', dev_mode: false } })
      }
      if (url === '/budgets/1/health-matrix/') return Promise.resolve({ data: customizedResponse })
      if (url === '/budgets/1/health-matrix/templates') {
        return Promise.resolve({
          data: [
            { template_key: 'standard_budget_health', name: 'Standard Budget Health', description: '', is_system: true },
          ],
        })
      }
      if (url === '/budgets/1/health-matrix/scales') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Customized')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy()
  })

  it('filters metrics by scope tabs', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    expect(screen.getByText('Custom Metric')).toBeTruthy()
    expect(screen.getByText('Planning Stability')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Overall' }))
    expect(screen.getByText('Setup Health')).toBeTruthy()
    expect(screen.queryByText('Custom Metric')).toBeNull()
    expect(screen.getByText('Planning Stability')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Current Period' }))
    expect(screen.queryByText('Setup Health')).toBeNull()
    expect(screen.getByText('Custom Metric')).toBeTruthy()
    expect(screen.getByText('Planning Stability')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Both' }))
    expect(screen.queryByText('Setup Health')).toBeNull()
    expect(screen.queryByText('Custom Metric')).toBeNull()
    expect(screen.getByText('Planning Stability')).toBeTruthy()
  })

  it('shows weight and sensitivity inline without expanding', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const weightBadges = screen.getAllByText('20%')
    expect(weightBadges.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1)
  })

  it('allows toggling a matrix item on and off', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const setupCheckbox = screen.getAllByRole('checkbox', { name: 'Enabled' })[0]

    fireEvent.click(setupCheckbox)
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', { is_enabled: false })
    })
  })

  it('allows expanding metric card to view details', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    expect(viewEditButtons.length).toBe(3)

    fireEvent.click(viewEditButtons[0])
    expect(await screen.findByText('Formula')).toBeTruthy()
    expect(screen.getByText('income_source_count + active_expense_count')).toBeTruthy()
  })

  it('allows changing the weight of a matrix item', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

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
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

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

  it('allows editing the threshold value of a metric', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Custom Metric')
    const viewEditButtons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(viewEditButtons[1])

    const thresholdLabel = await screen.findByText(/Threshold/)
    expect(thresholdLabel).toBeTruthy()

    const slider = screen.getByLabelText('Value')
    fireEvent.change(slider, { target: { value: '95' } })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/102', {
        threshold_value: 95,
      })
    })
  })

  it('allows removing a custom metric', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Custom Metric')
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    expect(removeButtons.length).toBe(1)

    fireEvent.click(removeButtons[0])
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/budgets/1/health-matrix/items/102')
    })
  })

  it('shows metric builder when Add Metric is clicked and hides on cancel', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    expect(screen.getByText('Create Custom Metric')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Create Custom Metric')).toBeNull()
  })

  it('creates a custom metric with valid inputs', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

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
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    fireEvent.click(screen.getByRole('button', { name: 'Create Metric' }))

    expect(await screen.findByText('Metric name is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', expect.anything())
  })

  it('shows validation error when creating a metric without a formula', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Health Matrix')
    fireEvent.click(screen.getByRole('button', { name: '+ Add Metric' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Metric' }))

    expect(await screen.findByText('Formula expression is required')).toBeTruthy()
    expect(api.post).not.toHaveBeenCalledWith('/budgets/1/health-matrix/metrics', expect.anything())
  })

  it('displays an error when health matrix fails to load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/info') {
        return Promise.resolve({ data: { app: 'Dosh', version: '0.0.0', schema_revision: 'abc', dev_mode: false } })
      }
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
      if (url === '/budgets/1/health-matrix/scales') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/budgets/1/health-matrix/templates') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Matrix unavailable.')).toBeTruthy()
  })
})
