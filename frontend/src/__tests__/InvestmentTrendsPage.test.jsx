import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

import InvestmentTrendsPage from '../pages/InvestmentTrendsPage'

const mockNavigate = jest.fn()

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getInvestmentTrends: jest.fn(),
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
  Line: ({ dataKey, name, strokeDasharray }) => (
    <span data-testid={`line-${dataKey}`} data-dash={strokeDasharray || ''}>{name}</span>
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

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
          <Route path="reports/investment-trends" element={<InvestmentTrendsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InvestmentTrendsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to first budget when no budgetId is provided', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getInvestmentTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', cumulative_contributed: 450, cumulative_projected: 500, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/investment-trends')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getAllByText('Investment Trends').length).toBeGreaterThanOrEqual(1)
  })

  it('renders breadcrumbs when budgetId is present', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getInvestmentTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', cumulative_contributed: 450, cumulative_projected: 500, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/investment-trends?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
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
    client.getInvestmentTrends.mockImplementation(() => new Promise(() => {}))

    renderWithRouter('/reports/investment-trends?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when no periods match filter', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([])
    client.getInvestmentTrends.mockResolvedValue({ periods: [] })

    renderWithRouter('/reports/investment-trends?budgetId=1')

    expect(await screen.findByText('No periods to display')).toBeTruthy()
  })

  it('renders chart when trend data is available', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getInvestmentTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', cumulative_contributed: 450, cumulative_projected: 500, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/investment-trends?budgetId=1')

    expect(await screen.findByTestId('line-chart')).toBeTruthy()
  })

  it('renders historical and upcoming filter sections', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CURRENT' },
    ])
    client.getInvestmentTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', cumulative_contributed: 450, cumulative_projected: 500, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/investment-trends?budgetId=1')

    expect(await screen.findByText('Historical Range')).toBeTruthy()
    expect(await screen.findByText('Upcoming')).toBeTruthy()
  })

  it('filters historical periods via Last 3 button', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
      { finperiodid: 11, startdate: '2026-02-01', enddate: '2026-02-28', cycle_stage: 'CLOSED' },
      { finperiodid: 12, startdate: '2026-03-01', enddate: '2026-03-31', cycle_stage: 'CLOSED' },
      { finperiodid: 13, startdate: '2026-04-01', enddate: '2026-04-30', cycle_stage: 'CURRENT' },
    ])
    client.getInvestmentTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', cumulative_contributed: 100, cumulative_projected: 100, cycle_stage: 'CLOSED' },
        { label: 'Feb 2026', cumulative_contributed: 200, cumulative_projected: 200, cycle_stage: 'CLOSED' },
        { label: 'Mar 2026', cumulative_contributed: 300, cumulative_projected: 300, cycle_stage: 'CLOSED' },
        { label: 'Apr 2026', cumulative_contributed: 400, cumulative_projected: 400, cycle_stage: 'CURRENT' },
      ],
    })

    renderWithRouter('/reports/investment-trends?budgetId=1')

    const chart = await screen.findByTestId('line-chart')
    expect(chart.getAttribute('data-data-count')).toBe('4')

    const last3Button = screen.getByRole('button', { name: 'Last 3' })
    fireEvent.click(last3Button)

    await waitFor(() => {
      const updatedChart = screen.getByTestId('line-chart')
      expect(updatedChart.getAttribute('data-data-count')).toBe('3')
    })
  })
})
