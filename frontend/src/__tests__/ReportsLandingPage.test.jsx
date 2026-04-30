import { screen } from '@testing-library/react'
import ReportsLandingPage from '../pages/ReportsLandingPage'
import { renderWithProviders } from '../testUtils'

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

describe('ReportsLandingPage', () => {
  it('renders budget selector when no budgetId', async () => {
    renderWithProviders(<ReportsLandingPage />, { route: '/reports', path: '/reports' })
    expect(await screen.findByText('Test Budget')).toBeTruthy()
  })

  it('renders report cards when budgetId is present', async () => {
    renderWithProviders(<ReportsLandingPage />, { route: '/reports/1', path: '/reports/:budgetId' })
    expect(await screen.findByText('Budget vs Actual')).toBeTruthy()
    expect((await screen.findAllByText('Coming soon')).length).toBe(2)
  })
})
