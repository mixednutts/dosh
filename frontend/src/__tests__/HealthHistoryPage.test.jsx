import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

import HealthHistoryPage from '../pages/HealthHistoryPage'

const mockNavigate = jest.fn()

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getHealthHistoryTrends: jest.fn(),
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
  Line: ({ dataKey, name }) => (
    <span data-testid={`line-${dataKey}`}>{name}</span>
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
          <Route path="reports/health-history" element={<HealthHistoryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('HealthHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to first budget when no budgetId is provided', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
    ])
    client.getHealthHistoryTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', scores: { setup_health: 85 }, cycle_stage: 'CLOSED' },
      ],
      metrics: [{ key: 'setup_health', name: 'Setup Health' }],
    })

    renderWithRouter('/reports/health-history')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getAllByText('Health History').length).toBeGreaterThanOrEqual(1)
  })

  it('renders breadcrumbs when budgetId is present', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
    ])
    client.getHealthHistoryTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', scores: { setup_health: 85 }, cycle_stage: 'CLOSED' },
      ],
      metrics: [{ key: 'setup_health', name: 'Setup Health' }],
    })

    renderWithRouter('/reports/health-history?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Budgets' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeTruthy()
  })

  it('shows loading spinner while data loads', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
    ])
    client.getHealthHistoryTrends.mockImplementation(() => new Promise(() => {}))

    renderWithRouter('/reports/health-history?budgetId=1')

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when no periods match filter', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([])
    client.getHealthHistoryTrends.mockResolvedValue({ periods: [], metrics: [] })

    renderWithRouter('/reports/health-history?budgetId=1')

    expect(await screen.findByText('No health history to display')).toBeTruthy()
  })

  it('renders chart and metric toggles when data is available', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
      { finperiodid: 11, startdate: '2026-02-01', enddate: '2026-02-28', cycle_stage: 'CLOSED' },
    ])
    client.getHealthHistoryTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', scores: { setup_health: 85, budget_vs_actual_amount: 70 }, cycle_stage: 'CLOSED' },
        { label: 'Feb 2026', scores: { setup_health: 90, budget_vs_actual_amount: 75 }, cycle_stage: 'CLOSED' },
      ],
      metrics: [
        { key: 'setup_health', name: 'Setup Health' },
        { key: 'budget_vs_actual_amount', name: 'Budget vs Actual (Amount)' },
      ],
    })

    renderWithRouter('/reports/health-history?budgetId=1')

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText('Metrics')).toBeTruthy()
    })
    const setupToggles = screen.getAllByText('Setup Health')
    expect(setupToggles.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Budget vs Actual (Amount)').length).toBeGreaterThanOrEqual(1)
  })

  it('toggles metric visibility when metric button is clicked', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 10, startdate: '2026-01-01', enddate: '2026-01-31', cycle_stage: 'CLOSED' },
    ])
    client.getHealthHistoryTrends.mockResolvedValue({
      periods: [
        { label: 'Jan 2026', scores: { setup_health: 85, budget_vs_actual_amount: 70 }, cycle_stage: 'CLOSED' },
      ],
      metrics: [
        { key: 'setup_health', name: 'Setup Health' },
        { key: 'budget_vs_actual_amount', name: 'Budget vs Actual (Amount)' },
      ],
    })

    renderWithRouter('/reports/health-history?budgetId=1')

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByText('Metrics')).toBeTruthy()
    })
    expect(screen.getByTestId('line-setup_health')).toBeTruthy()
    expect(screen.getByTestId('line-budget_vs_actual_amount')).toBeTruthy()

    const setupToggle = screen.getAllByText('Setup Health').find(el => el.closest('button'))
    fireEvent.click(setupToggle)

    await waitFor(() => {
      expect(screen.queryByTestId('line-setup_health')).toBeNull()
    })
    expect(screen.getByTestId('line-budget_vs_actual_amount')).toBeTruthy()
  })
})
