import React from 'react'
import { screen } from '@testing-library/react'

import Dashboard from '../pages/Dashboard'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getPeriodDetail: jest.fn(),
}))

const client = require('../api/client')

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows the empty-budget state', async () => {
    client.getBudgets.mockResolvedValue([])

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('No budgets yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Budgets' }).getAttribute('href')).toBe('/budgets')
  })

  it('shows setup guidance when a budget has no cycles', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([])

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText(/No budget cycles/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'set up budget' }).getAttribute('href')).toBe('/budgets/1/setup')
  })

  it('shows the next planned cycle when there is no active cycle', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Travel Budget', budgetowner: 'Sam', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 11, cycle_status: 'PLANNED', startdate: '2026-05-01', enddate: '2026-05-31', islocked: false },
      { finperiodid: 12, cycle_status: 'PLANNED', startdate: '2026-06-01', enddate: '2026-06-30', islocked: false },
    ])

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('No current budget cycle')).toBeTruthy()
    expect(screen.getByText('Next: 01 May 2026')).toBeTruthy()
  })

  it('renders the active cycle row with calculated totals and lock state', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Home Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 99, cycle_status: 'ACTIVE', startdate: '2026-04-01', enddate: '2026-04-30', islocked: true },
    ])
    client.getPeriodDetail.mockResolvedValue({
      incomes: [
        { budgetamount: 3000, actualamount: 3100 },
        { budgetamount: 200, actualamount: 150 },
      ],
      expenses: [
        { budgetamount: 1000, actualamount: 900, status: 'Current' },
        { budgetamount: 500, actualamount: 450, status: 'Paid' },
      ],
      investments: [
        { budgeted_amount: 300, actualamount: 280 },
      ],
    })

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('Locked')).toBeTruthy()
    expect(await screen.findByText('$3,200.00')).toBeTruthy()
    expect(screen.getByText('$3,250.00')).toBeTruthy()
    expect(screen.getAllByText('$1,450.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('$1,350.00')).toBeTruthy()
    expect(screen.getByText('$1,900.00')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Details →' }).getAttribute('href')).toBe('/budgets/1/periods/99')
  })

  it('shows locked badge when cycle is locked', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Locked Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 99, cycle_status: 'ACTIVE', startdate: '2026-04-01', enddate: '2026-04-30', islocked: true },
    ])
    client.getPeriodDetail.mockResolvedValue({
      incomes: [{ budgetamount: 3000, actualamount: 3000 }],
      expenses: [{ budgetamount: 1000, actualamount: 900, status: 'Current' }],
      investments: [],
    })

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('Locked')).toBeTruthy()
  })

  it('shows current stage label when cycle is active and not locked', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Active Budget', budgetowner: 'Alex', budget_frequency: 'Monthly' },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 99, cycle_status: 'ACTIVE', startdate: '2026-04-01', enddate: '2026-04-30', islocked: false },
    ])
    client.getPeriodDetail.mockResolvedValue({
      incomes: [{ budgetamount: 3000, actualamount: 3000 }],
      expenses: [{ budgetamount: 1000, actualamount: 900, status: 'Current' }],
      investments: [],
    })

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('Current')).toBeTruthy()
  })
})