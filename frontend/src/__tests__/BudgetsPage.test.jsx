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
  backupBudget: jest.fn(),
  inspectRestoreFile: jest.fn(),
  applyRestore: jest.fn(),
}))

const client = require('../api/client')

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(Date.parse('2026-04-10T09:30:00Z'))
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

  it('shows and runs the demo budget action', async () => {
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

  it('explains what a budget is and supports custom day-cycle creation', async () => {
    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    expect(screen.getByRole('button', { name: /More about Budgets and Budget Cycles/i })).toBeTruthy()
    expect(screen.queryByText(/A budget is a financial plan that estimates income and expenses over a specific period\./)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /More about Budgets and Budget Cycles/i }))
    expect(screen.getByText(/A budget is a financial plan that estimates income and expenses over a specific period\./)).toBeTruthy()
    expect(screen.getByText(/A Dosh budget is made of various Account, Expense & Investment information/)).toBeTruthy()
    expect(screen.getByText(/A budget cycle is a repeating period in days that represents the time frame of your financial planning\./)).toBeTruthy()
    expect(screen.getByText(/We will create our basic budget information here, then guide you through setup before we create your first budget cycle\./)).toBeTruthy()
    expect(screen.getByText(/Choose the budget cycle you want Dosh to plan around\./)).toBeTruthy()
    expect(screen.getByText(/After saving the basic budget information, we will add accounts, income sources, and expense items before generating our first budget cycle\./)).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Household Budget 2025'), {
      target: { value: 'Ten Day Budget' },
    })
    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Alex' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '__custom_day_cycle__' },
    })

    expect(screen.getByRole('spinbutton', { name: 'Cycle length in days' }).value).toBe('')
    expect(screen.getByText('Every ___ Days')).toBeTruthy()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Cycle length in days' }), {
      target: { value: '1' },
    })
    expect(screen.getByRole('spinbutton', { name: 'Cycle length in days' }).value).toBe('1')
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'Cycle length in days' }))
    expect(screen.getByRole('spinbutton', { name: 'Cycle length in days' }).value).toBe('2')
    expect(screen.getByText('Every 2 Days')).toBeTruthy()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Cycle length in days' }), {
      target: { value: '10' },
    })
    expect(screen.getByText('Every 10 Days')).toBeTruthy()
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createBudget.mock.calls[0][0]).toEqual({
        description: 'Ten Day Budget',
        budgetowner: 'Alex',
        budget_frequency: 'Every 10 Days',
      })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/budgets/21/setup')
  })

  it('keeps custom cycles invalid until a valid day length is provided and allows switching back to a standard cycle', async () => {
    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Household Budget 2025'), {
      target: { value: 'Monthly Budget' },
    })
    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Alex' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '__custom_day_cycle__' },
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton.disabled).toBe(true)
    expect(screen.getByText('Every ___ Days')).toBeTruthy()

    const customCycleInput = screen.getByRole('spinbutton', { name: 'Cycle length in days' })
    fireEvent.change(customCycleInput, {
      target: { value: '999' },
    })
    fireEvent.blur(customCycleInput)
    expect(customCycleInput.value).toBe('365')
    expect(screen.getByText('Every 365 Days')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)

    fireEvent.change(customCycleInput, {
      target: { value: '' },
    })
    expect(screen.getByText(/Enter a whole number of days between 2 and 365\./)).toBeTruthy()
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Monthly' },
    })
    expect(screen.queryByRole('spinbutton', { name: 'Cycle length in days' })).toBeNull()
    expect(saveButton.disabled).toBe(false)

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(client.createBudget.mock.calls[0][0]).toEqual({
        description: 'Monthly Budget',
        budgetowner: 'Alex',
        budget_frequency: 'Monthly',
      })
    })
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
      projected_investment: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    expect(await screen.findByText('Calendar')).not.toBeNull()
    expect(screen.queryByText('Historic')).toBeNull()
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
    expect(screen.getByRole('button', { name: /Today 10 Apr/i }).disabled).toBe(true)
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
        projected_investment: 0,
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
        projected_investment: 0,
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
    expect(within(dialog).getByRole('button', { name: /Today 10 Apr/i }).disabled).toBe(false)
    expect(screen.getByText('Insurance')).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: /Today 10 Apr/i }))
    expect(within(dialog).getByText('April 2026')).not.toBeNull()
    expect(within(dialog).getByRole('button', { name: /Today 10 Apr/i }).disabled).toBe(true)
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
      projected_investment: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByRole('button', { name: /15 April 2026/ }))

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
      projected_investment: 0,
      closeout_snapshot: null,
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    const cycleStartDay = await screen.findByRole('button', { name: /1 April 2026/ })
    expect(cycleStartDay.getAttribute('title')).toContain('Budget cycle starts')

    fireEvent.click(cycleStartDay)

    expect(await screen.findByRole('heading', { name: 'Wednesday 1 April 2026' })).not.toBeNull()
    expect(screen.getByText('Budget cycle starts')).not.toBeNull()
    expect(screen.getByText('Cycle start')).not.toBeNull()
  })

  it('opens the Budget Health modal with per-metric cards and expandable calculation', async () => {
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
    client.getBudgetHealth.mockResolvedValue({
      overall_score: 72,
      overall_status: 'Watch',
      overall_summary: 'Tracking okay.',
      momentum_status: 'Stable',
      momentum_delta: 0,
      momentum_summary: 'No change since last period.',
      evaluated_at: '2026-04-20T01:00:00+00:00',
      pillars: [
        {
          name: 'Setup Health',
          key: 'setup_health',
          score: 100,
          status: 'Strong',
          summary: 'Setup looks good.',
          weight: 0.4,
          weighted_contribution: 40,
          evidence: [
            { label: 'Income sources', value: '1', raw_value: 1, raw_unit: 'count', limit: '1', raw_limit: 1, detail: '1 income source configured (minimum 1)' },
          ],
        },
      ],
      current_period_check: {
        score: 56,
        status: 'Watch',
        summary: 'Expense overrun exceeds configured limits.',
        metrics: [
          {
            name: 'Budget vs Actual (Amount)',
            key: 'budget_vs_actual_amount',
            score: 70,
            status: 'Watch',
            summary: 'Overrun detected.',
            weight: 0.3,
            weighted_contribution: 21,
            evidence: [
              { label: 'Overrun amount', value: '$120.00', raw_value: 120, raw_unit: 'currency', limit: '$50.00', raw_limit: 50, detail: 'Aggregate amount by which actual expenses exceed budgeted amounts.' },
            ],
          },
        ],
      },
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    const detailsButtons = await screen.findAllByText(/Health Details/i)
    fireEvent.click(detailsButtons[1])

    expect(await screen.findByRole('heading', { name: /Budget Health — Household/i })).not.toBeNull()
    expect(screen.getByText('Setup Health')).not.toBeNull()
    expect(screen.getByText('Tracking okay.')).not.toBeNull()

    // Expandable calculation section
    fireEvent.click(screen.getByRole('button', { name: /Show Details/i }))
    expect(screen.getByText('Income sources')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show Formula/i }))
    expect(screen.getByText(/Weight:/)).not.toBeNull()
    expect(screen.getByText(/Contribution:/)).not.toBeNull()
  })

  it('opens the Current Period Check modal with per-metric cards', async () => {
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
    client.getBudgetHealth.mockResolvedValue({
      overall_score: 72,
      overall_status: 'Watch',
      overall_summary: 'Tracking okay.',
      momentum_status: 'Stable',
      momentum_delta: 0,
      momentum_summary: 'No change since last period.',
      evaluated_at: '2026-04-20T01:00:00+00:00',
      pillars: [
        {
          name: 'Setup Health',
          key: 'setup_health',
          score: 100,
          status: 'Strong',
          summary: 'Setup looks good.',
          weight: 0.4,
          weighted_contribution: 40,
          evidence: [],
        },
      ],
      current_period_check: {
        score: 56,
        status: 'Watch',
        summary: 'Expense overrun exceeds configured limits.',
        metrics: [
          {
            name: 'Budget vs Actual (Amount)',
            key: 'budget_vs_actual_amount',
            score: 70,
            status: 'Watch',
            summary: 'Overrun detected.',
            weight: 0.3,
            weighted_contribution: 21,
            evidence: [
              { label: 'Overrun amount', value: '$120.00', raw_value: 120, raw_unit: 'currency', limit: '$50.00', raw_limit: 50, detail: 'Aggregate amount by which actual expenses exceed budgeted amounts.' },
            ],
          },
        ],
      },
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    const detailsButtons = await screen.findAllByText(/Health Details/i)
    // The first Health Details button is for the Current Period Check card
    fireEvent.click(detailsButtons[0])

    expect(await screen.findByRole('heading', { name: /Current Budget Cycle Check — Household/i })).not.toBeNull()
    expect(screen.getByText('Budget vs Actual (Amount)')).not.toBeNull()
    expect(screen.getByText('Overrun detected.')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show Details/i }))
    expect(screen.getByText('Overrun amount')).not.toBeNull()
  })

  it('shows the Backup & Restore button and opens the modal', async () => {
    client.getBudgets.mockResolvedValue([])
    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    const button = await screen.findByRole('button', { name: /Backup & Restore/i })
    expect(button).not.toBeNull()
    fireEvent.click(button)

    expect(await screen.findByRole('heading', { name: /Backup & Restore/i })).not.toBeNull()
    // Tab buttons inside modal (exact match to avoid Backup & Restore button)
    expect(screen.getByRole('button', { name: /^Backup$/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /^Restore$/i })).not.toBeNull()
  })

  it('allows downloading a backup from the modal', async () => {
    client.getBudgets.mockResolvedValue([
      { budgetid: 1, description: 'Test Budget', budgetowner: 'Alice', budget_frequency: 'Monthly' },
    ])
    client.backupBudget.mockResolvedValue('dosh-backup-all.json')

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByRole('button', { name: /Backup & Restore/i }))
    await screen.findByRole('heading', { name: /Backup & Restore/i })

    const downloadButton = screen.getByRole('button', { name: /Download Backup/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(client.backupBudget).toHaveBeenCalledWith(null)
    })
  })

  it('shows restore inspect results after file selection', async () => {
    client.getBudgets.mockResolvedValue([])
    client.inspectRestoreFile.mockResolvedValue({
      backup_version: '0.6.7-alpha',
      current_version: '0.6.7-alpha',
      compatibility: 'exact',
      budget_count: 1,
      budgets: [
        { index: 0, description: 'Restored Budget', budgetowner: 'Alice', budget_frequency: 'Monthly', period_count: 2 },
      ],
    })

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByRole('button', { name: /Backup & Restore/i }))
    await screen.findByRole('heading', { name: /Backup & Restore/i })

    fireEvent.click(screen.getByRole('button', { name: /^Restore$/i }))

    const fileInput = screen.getByLabelText(/Backup file/i)
    const file = new File(['{"dosh_backup":true}'], 'backup.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(client.inspectRestoreFile).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText(/Restored Budget/i)).not.toBeNull()
    expect(screen.getByText(/same app version/i)).not.toBeNull()
  })
})
