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
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
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
    name: 'Budget Health',
    items: [
      {
        metric_key: 'setup_health',
        name: 'Setup Health',
        description: 'Checks whether the budget has the minimum required setup lines.',
        scope: 'OVERALL',
        weight: 0.4,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 0,
        parameters: { min_income_lines: 1, min_expense_lines: 1, min_investment_lines: 1 },
      },
      {
        metric_key: 'budget_cycles_pending_closeout',
        name: 'Budget Cycles Pending Close-Out',
        description: 'The number of budget cycles that are awaiting close-out.',
        scope: 'OVERALL',
        weight: 0.6,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 1,
        parameters: { upper_tolerance_instances: 0 },
      },
      {
        metric_key: 'budget_vs_actual_amount',
        name: 'Budget vs Actual (Amount)',
        description: 'Expense line actual amount exceeds the budget amount (aggregate overrun).',
        scope: 'CURRENT_PERIOD',
        weight: 0.3,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 2,
        parameters: { upper_tolerance_amount: 50, upper_tolerance_pct: 5 },
      },
      {
        metric_key: 'budget_vs_actual_lines',
        name: 'Budget vs Actual (Lines)',
        description: 'Number of expense lines where actual amount exceeds the budget amount.',
        scope: 'CURRENT_PERIOD',
        weight: 0.25,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 3,
        parameters: { upper_tolerance_instances: 2, upper_tolerance_pct: 10 },
      },
      {
        metric_key: 'in_cycle_budget_adjustments',
        name: 'In Cycle Budget Adjustments',
        description: 'Change made to budget amount since the period started.',
        scope: 'CURRENT_PERIOD',
        weight: 0.25,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 4,
        parameters: { upper_tolerance_instances: 1 },
      },
      {
        metric_key: 'revisions_on_paid_expenses',
        name: 'In Cycle Expense Revisions',
        description: 'How many times a revision was recorded for an expense.',
        scope: 'CURRENT_PERIOD',
        weight: 0.2,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 5,
        parameters: { upper_tolerance_instances: 2 },
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
      return Promise.resolve({ data: {} })
    })
    api.patch.mockResolvedValue({ data: { budgetid: 1, ...budget } })
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

  it('loads and displays the health metrics', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Health Metrics')).toBeTruthy()
    expect(await screen.findByText('Setup Health')).toBeTruthy()
    expect(screen.getByText('Budget Cycles Pending Close-Out')).toBeTruthy()
    expect(screen.getByText('Budget vs Actual (Amount)')).toBeTruthy()
    expect(screen.getByText('Budget vs Actual (Lines)')).toBeTruthy()
    expect(screen.getByText('In Cycle Budget Adjustments')).toBeTruthy()
    expect(screen.getByText('In Cycle Expense Revisions')).toBeTruthy()
  })

  it('allows toggling a metric on and off', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const checkboxes = screen.getAllByRole('checkbox', { name: 'Enabled' })
    expect(checkboxes.length).toBe(6)

    fireEvent.click(checkboxes[0])
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/setup_health', { is_enabled: false })
    })
  })

  it('allows expanding metric card to view parameters', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const buttons = screen.getAllByRole('button', { name: 'View / Edit' })
    expect(buttons.length).toBe(6)

    fireEvent.click(buttons[0])
    expect(await screen.findByLabelText('Minimum income lines')).toBeTruthy()
    expect(screen.getByLabelText('Minimum expense lines')).toBeTruthy()
    expect(screen.getByLabelText('Minimum investment lines')).toBeTruthy()
  })

  it('allows changing setup health parameters', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const buttons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(buttons[0])

    const input = await screen.findByLabelText('Minimum income lines')
    fireEvent.change(input, { target: { value: '3' } })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/setup_health', expect.objectContaining({ parameters: expect.objectContaining({ min_income_lines: 3 }) }))
    })
  })

  it('allows changing budget vs actual amount parameters', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Budget vs Actual (Amount)')
    const buttons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(buttons[2])

    const slider = await screen.findByLabelText('Upper tolerance percentage')
    fireEvent.change(slider, { target: { value: '15' } })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/budget_vs_actual_amount', expect.objectContaining({ parameters: expect.objectContaining({ upper_tolerance_pct: 15 }) }))
    })
  })

  it('displays an error when health matrix fails to load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/info') {
        return Promise.resolve({ data: { app: 'Dosh', version: '0.0.0', schema_revision: 'abc', dev_mode: false } })
      }
      if (url === '/budgets/1/health-matrix/') {
        return Promise.reject({ response: { data: { detail: 'Matrix unavailable.' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    expect(await screen.findByText('Matrix unavailable.')).toBeTruthy()
  })
})
