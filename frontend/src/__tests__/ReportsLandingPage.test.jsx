import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import ReportsLandingPage from '../pages/ReportsLandingPage'

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(() => Promise.resolve([
    { budgetid: 1, description: 'Test Budget', budgetowner: 'Alice', budget_frequency: 'Monthly' },
  ])),
  getBudgetReportSummary: jest.fn(() => Promise.resolve({
    budget: { budgetid: 1, description: 'Test Budget', budgetowner: 'Alice' },
    period_count: 3,
    date_range: { start: '2026-01-01', end: '2026-03-31' },
  })),
}))

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
          <Route path="reports" element={<ReportsLandingPage />} />
          <Route path="reports/:budgetId" element={<ReportsLandingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReportsLandingPage', () => {
  it('redirects to first budget when no budgetId', async () => {
    renderWithRouter('/reports')
    expect(await screen.findByText('Budget vs Actual')).toBeTruthy()
    expect(await screen.findByText('Income Allocation')).toBeTruthy()
    expect(await screen.findByText('Investment Trends')).toBeTruthy()
  })

  it('renders report cards when budgetId is present', async () => {
    renderWithRouter('/reports/1')
    expect(await screen.findByText('Budget vs Actual')).toBeTruthy()
    expect(await screen.findByText('Income Allocation')).toBeTruthy()
    expect(await screen.findByText('Investment Trends')).toBeTruthy()
  })
})
