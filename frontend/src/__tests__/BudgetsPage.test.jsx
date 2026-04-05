import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import BudgetsPage from '../pages/BudgetsPage'
import { renderWithProviders } from '../testUtils'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  createBudget: jest.fn(),
  createDemoBudget: jest.fn(),
  deleteBudget: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getBudgetHealth: jest.fn(),
  getPeriodDetail: jest.fn(),
}))

const client = require('../api/client')

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(Date.parse('2026-04-10T09:30:00Z'))
    global.__DEV_MODE__ = false
    client.getBudgets.mockResolvedValue([])
    client.getPeriodsForBudget.mockResolvedValue([])
    client.getBudgetHealth.mockResolvedValue(null)
    client.getPeriodDetail.mockResolvedValue(null)
    client.createBudget.mockResolvedValue({
      budgetid: 21,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.createDemoBudget.mockResolvedValue({
      budgetid: 88,
      budgetowner: 'Dosh Demo',
      description: 'Demo Household Budget',
      budget_frequency: 'Monthly',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('hides the demo budget action when dev mode is disabled', async () => {
    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    expect(screen.queryByRole('button', { name: 'Create Demo Budget' })).toBeNull()
  })

  it('shows and runs the demo budget action when dev mode is enabled', async () => {
    global.__DEV_MODE__ = true

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    const demoButton = screen.getByRole('button', { name: 'Create Demo Budget' })
    fireEvent.click(demoButton)

    await waitFor(() => {
      expect(client.createDemoBudget).toHaveBeenCalledTimes(1)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/budgets/88')
  })

  it('replaces the historical stat with a calendar-style current cycle summary', async () => {
    client.getBudgets.mockResolvedValue([
      {
        budgetid: 7,
        budgetowner: 'Alex',
        description: 'Household',
        budget_frequency: 'Monthly',
      },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      {
        finperiodid: 101,
        budgetid: 7,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
    ])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 101,
        budgetid: 7,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
      incomes: [
        {
          finperiodid: 101,
          budgetid: 7,
          incomedesc: 'Salary',
          budgetamount: 3500,
          actualamount: 0,
          varianceamount: 0,
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [
        {
          finperiodid: 101,
          budgetid: 7,
          expensedesc: 'Rent',
          budgetamount: 1800,
          actualamount: 0,
          varianceamount: 0,
          is_oneoff: false,
          sort_order: 0,
          revision_snapshot: 0,
          status: 'Current',
          remaining_amount: 1800,
          freqtype: 'Fixed Day of Month',
          frequency_value: 15,
          paytype: 'AUTO',
          effectivedate: '2026-01-15T00:00:00',
          note: null,
          revision_comment: null,
        },
      ],
      investments: [],
      balances: [],
      projected_savings: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    expect(await screen.findByText('Calendar')).not.toBeNull()
    expect(screen.queryByText('Historical')).toBeNull()
    expect(screen.queryByText('Today 10 Apr')).toBeNull()
    expect(screen.getByText('April 2026')).not.toBeNull()
    expect(screen.queryByText('Month view around today')).toBeNull()
    expect(screen.queryByText('Compact calendar preview for the active cycle.')).toBeNull()
    expect(screen.queryByText('Coming up')).toBeNull()
    expect(screen.queryByText(/income line at cycle start/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Open full calendar' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Previous month' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Next month' })).not.toBeNull()
    expect(screen.queryByText('Now')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open full calendar' }))

    const dialogHeading = await screen.findByRole('heading', { name: /Calendar for Household/i })
    expect(screen.getByText('Budget cycle starts')).not.toBeNull()
    expect(screen.getByText('Salary')).not.toBeNull()
    expect(screen.getByText(/Rent/)).not.toBeNull()
    expect(screen.queryByText('Current cycle calendar')).toBeNull()
    expect(screen.queryByText(/Income is anchored to/)).toBeNull()
    expect(screen.queryByText(/Nothing is scheduled for today/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Today' }).disabled).toBe(true)
    expect(dialogHeading).not.toBeNull()
  })

  it('includes active and upcoming periods in the calendar with a 3-month lookahead', async () => {
    client.getBudgets.mockResolvedValue([
      {
        budgetid: 8,
        budgetowner: 'Alex',
        description: 'Forward View',
        budget_frequency: 'Monthly',
      },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      {
        finperiodid: 201,
        budgetid: 8,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
      {
        finperiodid: 202,
        budgetid: 8,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'PLANNED',
        closed_at: null,
      },
      {
        finperiodid: 203,
        budgetid: 8,
        startdate: '2026-08-01T00:00:00',
        enddate: '2026-08-31T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'PLANNED',
        closed_at: null,
      },
    ])
    client.getPeriodDetail
      .mockResolvedValueOnce({
        period: {
          finperiodid: 201,
          budgetid: 8,
          startdate: '2026-04-01T00:00:00',
          enddate: '2026-04-30T00:00:00',
          budgetowner: 'Alex',
          islocked: false,
          cycle_status: 'ACTIVE',
          closed_at: null,
        },
        incomes: [{ finperiodid: 201, budgetid: 8, incomedesc: 'Salary', budgetamount: 4000, actualamount: 0, varianceamount: 0, is_system: false, system_key: null }],
        expenses: [],
        investments: [],
        balances: [],
        projected_savings: 0,
        closeout_snapshot: null,
      })
      .mockResolvedValueOnce({
        period: {
          finperiodid: 202,
          budgetid: 8,
          startdate: '2026-05-01T00:00:00',
          enddate: '2026-05-31T00:00:00',
          budgetowner: 'Alex',
          islocked: false,
          cycle_status: 'PLANNED',
          closed_at: null,
        },
        incomes: [{ finperiodid: 202, budgetid: 8, incomedesc: 'Salary', budgetamount: 4000, actualamount: 0, varianceamount: 0, is_system: false, system_key: null }],
        expenses: [{
          finperiodid: 202,
          budgetid: 8,
          expensedesc: 'Insurance',
          budgetamount: 120,
          actualamount: 0,
          varianceamount: 0,
          is_oneoff: false,
          sort_order: 0,
          revision_snapshot: 0,
          status: 'Current',
          remaining_amount: 120,
          freqtype: 'Fixed Day of Month',
          frequency_value: 12,
          paytype: 'AUTO',
          effectivedate: '2026-05-12T00:00:00',
          note: null,
          revision_comment: null,
        }],
        investments: [],
        balances: [],
        projected_savings: 0,
        closeout_snapshot: null,
      })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Open full calendar' }))

    const dialogHeading = await screen.findByRole('heading', { name: /Calendar for Forward View/i })
    const dialog = dialogHeading.closest('[class*="max-w"]') ?? document.body
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next month' }))
    expect(await screen.findByText('May 2026')).not.toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Today' }).disabled).toBe(false)
    expect(screen.getByText('Insurance')).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Today' }))
    expect(within(dialog).getByText('April 2026')).not.toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Today' }).disabled).toBe(true)
    expect(client.getPeriodDetail).toHaveBeenCalledTimes(2)
  })

  it('opens day events when clicking a calendar cell with events', async () => {
    client.getBudgets.mockResolvedValue([
      {
        budgetid: 9,
        budgetowner: 'Alex',
        description: 'Clickable Days',
        budget_frequency: 'Monthly',
      },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      {
        finperiodid: 301,
        budgetid: 9,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
    ])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 301,
        budgetid: 9,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
      incomes: [
        { finperiodid: 301, budgetid: 9, incomedesc: 'Salary', budgetamount: 4000, actualamount: 0, varianceamount: 0, is_system: false, system_key: null },
      ],
      expenses: [
        {
          finperiodid: 301,
          budgetid: 9,
          expensedesc: 'Rent',
          budgetamount: 1800,
          actualamount: 0,
          varianceamount: 0,
          is_oneoff: false,
          sort_order: 0,
          revision_snapshot: 0,
          status: 'Current',
          remaining_amount: 1800,
          freqtype: 'Fixed Day of Month',
          frequency_value: 15,
          paytype: 'AUTO',
          effectivedate: '2026-01-15T00:00:00',
          note: null,
          revision_comment: null,
        },
      ],
      investments: [],
      balances: [],
      projected_savings: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByRole('button', { name: 'View events for 15 April 2026' }))

    expect(await screen.findByRole('heading', { name: 'Wednesday 15 April 2026' })).not.toBeNull()
    expect(screen.getByText('Rent')).not.toBeNull()
    expect(screen.getByText('Expense')).not.toBeNull()
  })

  it('shows budget cycle start as a highlighted calendar event', async () => {
    client.getBudgets.mockResolvedValue([
      {
        budgetid: 10,
        budgetowner: 'Alex',
        description: 'Cycle Marker',
        budget_frequency: 'Monthly',
      },
    ])
    client.getPeriodsForBudget.mockResolvedValue([
      {
        finperiodid: 401,
        budgetid: 10,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
    ])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 401,
        budgetid: 10,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        budgetowner: 'Alex',
        islocked: false,
        cycle_status: 'ACTIVE',
        closed_at: null,
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      projected_savings: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    const cycleStartDay = await screen.findByRole('button', { name: 'View events for 1 April 2026' })
    expect(cycleStartDay.getAttribute('title')).toContain('Budget cycle starts')

    fireEvent.click(cycleStartDay)

    expect(await screen.findByRole('heading', { name: 'Wednesday 1 April 2026' })).not.toBeNull()
    expect(screen.getByText('Budget cycle starts')).not.toBeNull()
    expect(screen.getByText('Cycle start')).not.toBeNull()
  })
})
