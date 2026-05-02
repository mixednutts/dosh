import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

import IncomeAllocationPage from '../pages/IncomeAllocationPage'

const mockNavigate = jest.fn()

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getIncomeAllocationTrends: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children, data }) => (
    <div data-testid="area-chart" data-data-count={data?.length || 0}>{children}</div>
  ),
  Area: ({ dataKey, name }) => <span data-testid={`area-${dataKey}`}>{name}</span>,
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

function renderWithRouter(route) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="reports/income-allocation" element={<IncomeAllocationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('IncomeAllocationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to first budget when no budgetId is provided', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
      { budgetid: 2, description: 'Travel Budget', budgetowner: 'Sam', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/income-allocation')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getAllByText('Income Allocation').length).toBeGreaterThanOrEqual(1)
  })

  it('renders breadcrumbs when budgetId is present', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getAllByText('Income Allocation').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: 'Budgets' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeTruthy()
  })

  it('shows loading spinner while trends load', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockImplementation(() => new Promise(() => {}))

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when no periods match filter', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({ periods: [] })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByText('No periods in selected date range')).toBeTruthy()
    expect(await screen.findByText('Try adjusting the filter to include more budget cycles.')).toBeTruthy()
  })

  it('renders chart when trend data is available', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByTestId('area-chart')).toBeTruthy()
  })

  it('toggles category visibility via pills', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByTestId('area-chart')).toBeTruthy()

    const expensePill = screen.getByRole('button', { name: 'Expenses' })
    fireEvent.click(expensePill)

    await waitFor(() => {
      expect(screen.queryByTestId('area-expense_actual')).toBeNull()
    })
  })

  it('toggles surplus visibility via pill', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    expect(await screen.findByTestId('area-chart')).toBeTruthy()

    const surplusPill = screen.getByRole('button', { name: 'Surplus' })
    fireEvent.click(surplusPill)

    await waitFor(() => {
      expect(screen.queryByTestId('area-surplus_actual')).toBeNull()
    })
  })

  it('excludes current period when Current Cycle pill is toggled off', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
      { finperiodid: 11, startdate: '2025-12-01', enddate: '2025-12-31', cycle_stage: 'CLOSED' },
    ])
    client.getIncomeAllocationTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CURRENT' },
        { label: 'Dec 2025', income_actual: 3100, expense_actual: 1400, investment_actual: 450, surplus_actual: 1250, cycle_stage: 'CLOSED' },
      ],
    })

    renderWithRouter('/reports/income-allocation?budgetId=1')

    const chart = await screen.findByTestId('area-chart')
    expect(chart).toBeTruthy()
    expect(chart.getAttribute('data-data-count')).toBe('2')

    const currentCyclePill = screen.getByRole('button', { name: 'Current Cycle' })
    fireEvent.click(currentCyclePill)

    await waitFor(() => {
      const updatedChart = screen.getByTestId('area-chart')
      expect(updatedChart.getAttribute('data-data-count')).toBe('1')
    })
  })
})
