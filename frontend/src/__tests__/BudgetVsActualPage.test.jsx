import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'

import BudgetVsActualPage from '../pages/BudgetVsActualPage'
import { renderWithProviders } from '../testUtils'

const mockNavigate = jest.fn()

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getBudgetVsActualTrends: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }) => (
    <div data-testid="line-chart" data-data-count={data?.length || 0}>{children}</div>
  ),
  Line: ({ dataKey, name }) => <span data-testid={`line-${dataKey}`}>{name}</span>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

jest.mock('../components/DateField', () => {
  const ReactForMock = require('react')
  return ReactForMock.forwardRef(function MockDateField({ selected, onChange, placeholderText }, ref) {
    return (
      <input
        ref={ref}
        data-testid={placeholderText}
        value={selected ? selected.toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val ? new Date(val + 'T00:00:00') : null)
        }}
        placeholder={placeholderText}
      />
    )
  })
})

const client = require('../api/client')

describe('BudgetVsActualPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows budget selector when no budgetId is provided', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
      { budgetid: 2, description: 'Travel Budget', budgetowner: 'Sam', budget_frequency: 'Monthly' },
    ])

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByText('Select a budget to view this report.')).toBeTruthy()
    expect(await screen.findByRole('option', { name: 'Home Budget' })).toBeTruthy()
    expect(await screen.findByRole('option', { name: 'Travel Budget' })).toBeTruthy()
  })

  it('renders breadcrumbs and budget switcher when budgetId is present', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_budget: 3000, income_actual: 3100, expense_budget: 1500, expense_actual: 1400, investment_budget: 500, investment_actual: 450 },
      ],
    })

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByRole('heading', { name: 'Budget vs Actual' })).toBeTruthy()
    expect(screen.getByText('Track how actuals compare to budget over time.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Budgets' })).toBeTruthy()
    expect(await screen.findByRole('option', { name: 'Home Budget' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeTruthy()
  })

  it('shows loading spinner while trends load', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockImplementation(() => new Promise(() => {}))

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByRole('heading', { name: 'Budget vs Actual' })).toBeTruthy()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when no periods match filter', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockResolvedValue({ periods: [] })

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByText('No periods in selected date range')).toBeTruthy()
    expect(await screen.findByText('Try adjusting the filter to include more budget cycles.')).toBeTruthy()
  })

  it('renders chart when trend data is available', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_budget: 3000, income_actual: 3100, expense_budget: 1500, expense_actual: 1400, investment_budget: 500, investment_actual: 450 },
      ],
    })

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByTestId('line-chart')).toBeTruthy()
  })

  it('toggles surplus lines via checkbox', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_budget: 3000, income_actual: 3100, expense_budget: 1500, expense_actual: 1400, investment_budget: 500, investment_actual: 450, surplus_budget: 1000, surplus_actual: 1250 },
      ],
    })

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    expect(await screen.findByTestId('line-chart')).toBeTruthy()

    const checkbox = screen.getByRole('checkbox', { name: 'Show surplus' })
    expect(checkbox.checked).toBe(true)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)

    await waitFor(() => {
      expect(client.getBudgetVsActualTrends).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ include_surplus: false })
      )
    })
  })

  it('calls trends API with query params including surplus', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31' },
    ])
    client.getBudgetVsActualTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_budget: 3000, income_actual: 3100, expense_budget: 1500, expense_actual: 1400, investment_budget: 500, investment_actual: 450 },
      ],
    })

    renderWithProviders(<BudgetVsActualPage />, {
      route: '/reports/budget-vs-actual?budgetId=1',
      path: '/reports/budget-vs-actual',
    })

    await screen.findByTestId('line-chart')

    await waitFor(() => {
      expect(client.getBudgetVsActualTrends).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ include_surplus: true })
      )
    })
  })
})
