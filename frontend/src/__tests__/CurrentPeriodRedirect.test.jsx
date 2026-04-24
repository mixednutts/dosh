import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

import CurrentPeriodRedirect from '../pages/CurrentPeriodRedirect'

jest.mock('../api/client', () => ({
  getCurrentPeriodDetail: jest.fn(),
}))

const client = require('../api/client')

function renderWithRoute(ui, { route = '/budgets/1/periods/current' } = {}) {
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
          <Route path="budgets/:budgetId/periods/current" element={ui} />
          <Route path="budgets/:budgetId" element={<div data-testid="budget-page">Budget Page</div>} />
          <Route path="budgets/:budgetId/periods/:periodId" element={<div data-testid="period-page">Period Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CurrentPeriodRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows a spinner while loading', () => {
    client.getCurrentPeriodDetail.mockImplementation(() => new Promise(() => {}))
    renderWithRoute(<CurrentPeriodRedirect />)
    expect(screen.queryByTestId('period-page')).toBeFalsy()
    expect(screen.queryByTestId('budget-page')).toBeFalsy()
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('redirects to the current period when found', async () => {
    client.getCurrentPeriodDetail.mockResolvedValue({
      period: { finperiodid: 42 },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
    })
    renderWithRoute(<CurrentPeriodRedirect />)
    await waitFor(() => {
      expect(screen.getByTestId('period-page')).toBeTruthy()
    })
  })

  it('redirects to budget page when no current period exists', async () => {
    client.getCurrentPeriodDetail.mockRejectedValue(new Error('Not found'))
    renderWithRoute(<CurrentPeriodRedirect />)
    await waitFor(() => {
      expect(screen.getByTestId('budget-page')).toBeTruthy()
    })
  })

  it('redirects to budget page when response has no period', async () => {
    client.getCurrentPeriodDetail.mockResolvedValue({ period: null })
    renderWithRoute(<CurrentPeriodRedirect />)
    await waitFor(() => {
      expect(screen.getByTestId('budget-page')).toBeTruthy()
    })
  })
})
