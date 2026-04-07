import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import Layout from '../components/Layout'

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  getPeriodDetail: jest.fn(),
  getPeriodsForBudget: jest.fn(),
}))

const client = require('../api/client')

function renderLayout(route) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<Layout />}>
            <Route path="budgets" element={<div>Budgets Page</div>} />
            <Route path="budgets/:budgetId" element={<div>Budget Cycles Page</div>} />
            <Route path="budgets/:budgetId/setup" element={<div>Budget Setup Page</div>} />
            <Route path="periods/:periodId" element={<div>Period Detail Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Layout navigation', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()

    client.getBudgets.mockResolvedValue([
      {
        budgetid: 1,
        budgetowner: 'Alex',
        description: 'Home Budget',
        budget_frequency: 'Monthly',
      },
      {
        budgetid: 2,
        budgetowner: 'Jordan',
        description: 'Travel Budget',
        budget_frequency: 'Fortnightly',
      },
    ])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: false,
      blocking_issues: ['Add at least one income source before generating budget cycles.'],
      warnings: [],
      accounts: [],
    })
    client.getPeriodsForBudget.mockResolvedValue([])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 88,
        budgetid: 1,
      },
    })
  })

  it('keeps the budget list above the current budget panel and keeps setup actions off the budget cycles sidebar baseline', async () => {
    renderLayout('/budgets/1')

    fireEvent.click(await screen.findByTitle('Show budget list'))

    const budgetListHeading = await screen.findByText('Budget List')
    const currentBudgetHeading = screen.getByText('Current Budget')
    expect(
      budgetListHeading.compareDocumentPosition(currentBudgetHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    expect(screen.getByRole('link', { name: 'Budget Cycles' }).getAttribute('href')).toBe('/budgets/1')
    expect(screen.queryByRole('link', { name: 'Setup' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open setup' })).toBeNull()
    expect(screen.getByText('No budget cycles yet. Open Budget Cycles to generate your first budget cycle.')).toBeTruthy()
  })

  it('collapses the current budget cycle shortcuts when the budget list is collapsed', async () => {
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
    })

    renderLayout('/budgets/1')

    fireEvent.click(await screen.findByTitle('Show budget list'))

    expect(await screen.findByText('Budget Cycle Shortcuts')).toBeTruthy()
    expect(screen.getByText('Current Budget')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Hide budget list'))

    expect(screen.queryByText('Current Budget')).toBeNull()
    expect(screen.queryByText('Budget Cycle Shortcuts')).toBeNull()
    expect(screen.queryByText('No budget cycles yet. Open Budget Cycles to generate your first budget cycle.')).toBeNull()
  })

  it('keeps the setup route sidebar collapsed until the budget layer is expanded', async () => {
    renderLayout('/budgets/1/setup')

    expect(await screen.findByTitle('Show budget list')).toBeTruthy()
    expect(screen.queryByText('Current Budget')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Budget Cycles' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Setup' })).toBeNull()
  })

  it('surfaces the current sidebar shortcut labels and deep links for additional cycles', async () => {
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
    })
    client.getPeriodsForBudget.mockResolvedValue([
      {
        finperiodid: 101,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        cycle_status: 'ACTIVE',
      },
      {
        finperiodid: 102,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        cycle_status: 'PLANNED',
      },
      {
        finperiodid: 103,
        startdate: '2026-06-01T00:00:00',
        enddate: '2026-06-30T00:00:00',
        cycle_status: 'PLANNED',
      },
      {
        finperiodid: 104,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        cycle_status: 'PLANNED',
      },
      {
        finperiodid: 201,
        startdate: '2025-12-01T00:00:00',
        enddate: '2025-12-31T00:00:00',
        cycle_status: 'CLOSED',
      },
      {
        finperiodid: 202,
        startdate: '2026-01-01T00:00:00',
        enddate: '2026-01-31T00:00:00',
        cycle_status: 'CLOSED',
      },
      {
        finperiodid: 203,
        startdate: '2026-02-01T00:00:00',
        enddate: '2026-02-28T00:00:00',
        cycle_status: 'CLOSED',
      },
      {
        finperiodid: 204,
        startdate: '2026-03-01T00:00:00',
        enddate: '2026-03-31T00:00:00',
        cycle_status: 'CLOSED',
      },
      {
        finperiodid: 205,
        startdate: '2025-11-01T00:00:00',
        enddate: '2025-11-30T00:00:00',
        cycle_status: 'CLOSED',
      },
    ])

    renderLayout('/budgets/1')

    fireEvent.click(await screen.findByTitle('Show budget list'))

    expect(await screen.findByText('Historical')).toBeTruthy()

    const upcomingMore = screen.getByRole('link', { name: 'View all 3 upcoming cycles (1 more)' })
    expect(upcomingMore.getAttribute('href')).toBe('/budgets/1#upcoming')

    const historicalMore = screen.getByRole('link', { name: 'View all 5 historical cycles (1 more)' })
    expect(historicalMore.getAttribute('href')).toBe('/budgets/1#historical')
  })
})
