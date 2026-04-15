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
    name: 'Budget Health',
    items: [
      {
        metric_id: 101,
        metric_key: 'setup_health',
        name: 'Setup Health',
        description: 'Checks whether the budget has the minimum required setup lines.',
        scope: 'CURRENT_PERIOD',
        weight: 0.3,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 0,
        parameters: { min_income_lines: 1, min_expense_lines: 1, min_investment_lines: 1 },
      },
      {
        metric_id: 102,
        metric_key: 'budget_discipline',
        name: 'Budget Discipline',
        description: 'Measures historical expense overrun against your tolerance.',
        scope: 'OVERALL',
        weight: 0.7,
        scoring_sensitivity: 50,
        is_enabled: true,
        display_order: 1,
        parameters: { max_overrun_dollar: 0, max_overrun_pct_of_expenses: 10 },
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
    expect(screen.getByText('Budget Discipline')).toBeTruthy()
  })

  it('allows toggling a metric on and off', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const checkboxes = screen.getAllByRole('checkbox', { name: 'Enabled' })
    expect(checkboxes.length).toBe(2)

    fireEvent.click(checkboxes[0])
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', { is_enabled: false })
    })
  })

  it('allows expanding metric card to view parameters', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Setup Health')
    const buttons = screen.getAllByRole('button', { name: 'View / Edit' })
    expect(buttons.length).toBe(2)

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
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/101', expect.objectContaining({ parameters: expect.objectContaining({ min_income_lines: 3 }) }))
    })
  })

  it('allows changing budget discipline parameters', async () => {
    renderWithProviders(<BudgetHealthTab budgetId={1} budget={budget} />)

    await screen.findByText('Budget Discipline')
    const buttons = screen.getAllByRole('button', { name: 'View / Edit' })
    fireEvent.click(buttons[1])

    const slider = await screen.findByLabelText('Max overrun % of expenses')
    fireEvent.change(slider, { target: { value: '25' } })

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/budgets/1/health-matrix/items/102', expect.objectContaining({ parameters: expect.objectContaining({ max_overrun_pct_of_expenses: 25 }) }))
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
