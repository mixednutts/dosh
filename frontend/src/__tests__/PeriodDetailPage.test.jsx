import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import PeriodDetailPage from '../pages/PeriodDetailPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getPeriodDetail: jest.fn(),
  getBudget: jest.fn(),
  setPeriodLock: jest.fn(),
  updateIncomeActual: jest.fn(),
  addToIncomeActual: jest.fn(),
  addExpenseToPeriod: jest.fn(),
  addIncomeToPeriod: jest.fn(),
  savingsTransfer: jest.fn(),
  getExpenseItems: jest.fn(),
  getIncomeTypes: jest.fn(),
  createExpenseItem: jest.fn(),
  getExpenseEntries: jest.fn(),
  addExpenseEntry: jest.fn(),
  deleteExpenseEntry: jest.fn(),
  reorderPeriodExpenses: jest.fn(),
  getBalanceTransactions: jest.fn(),
  getInvestmentTransactions: jest.fn(),
  addInvestmentTransaction: jest.fn(),
  deleteInvestmentTransaction: jest.fn(),
  setPeriodExpenseStatus: jest.fn(),
  updatePeriodExpenseBudget: jest.fn(),
  removePeriodExpense: jest.fn(),
  updatePeriodInvestmentBudget: jest.fn(),
  getBalanceTypes: jest.fn(),
  updateExpenseNote: jest.fn(),
  removePeriodIncome: jest.fn(),
  setPeriodInvestmentStatus: jest.fn(),
  getPeriodCloseoutPreview: jest.fn(),
  closeOutPeriod: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('PeriodDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows closed-cycle read-only messaging and snapshot details', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 44,
        budgetid: 1,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        islocked: true,
        cycle_status: 'CLOSED',
      },
      incomes: [
        {
          finperiodid: 44,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '1000.00',
          actualamount: '1000.00',
          varianceamount: '0.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: {
        comments: 'Closed out smoothly.',
        goals: 'Stay consistent next cycle.',
        carry_forward_amount: '150.00',
        health_snapshot_json: JSON.stringify({
          summary: 'This period looks to be tracking along nicely with the current plan.',
          score: 88,
          status: 'Strong',
        }),
        totals_snapshot_json: '{}',
        created_at: '2026-04-30T12:00:00',
      },
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/44',
      path: '/periods/:periodId',
    })

    expect(await screen.findByText(/This budget cycle is closed\./)).toBeTruthy()
    expect(screen.getByText(/Carry Forward:/)).toBeTruthy()
    expect(screen.getByText(/Closed out smoothly\./)).toBeTruthy()
    expect(screen.getByText(/Next cycle goals: Stay consistent next cycle\./)).toBeTruthy()
    expect(screen.queryByText('Close Out')).toBeNull()
    expect(screen.queryByText('Unlocked')).toBeNull()
  })

  it('shows close-out modal preview and requires next-cycle confirmation when missing', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 55,
        budgetid: 1,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: {
        finperiodid: 55,
        budgetid: 1,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      next_period: null,
      carry_forward_amount: '150.00',
      totals: {
        income_budget: '1000.00',
        surplus_budget: '150.00',
      },
      health: {
        summary: 'Things are still on track overall.',
        score: 82,
        status: 'Strong',
      },
      next_cycle_exists: false,
      can_close_early: true,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/55',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Close Out'))

    expect(await screen.findByText('Close Out Budget Cycle')).toBeTruthy()
    expect(await screen.findByText(/Closing this cycle makes it read-only\./i)).toBeTruthy()
    expect(screen.getByText(/Create the next budget cycle automatically during close-out/i)).toBeTruthy()
    expect(screen.getByText(/\$150\.00 will be placed into the next cycle as a `Carried Forward` income budget line\./i)).toBeTruthy()

    const closeButton = screen.getByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(closeButton.disabled).toBe(false)
  })

  it('requires confirmation before marking an under-spent expense as paid', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 56,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 56,
          budgetid: 1,
          expensedesc: 'Groceries',
          budgetamount: '200.00',
          actualamount: '150.00',
          remaining_amount: '50.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })
    client.setPeriodExpenseStatus.mockResolvedValue({})

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/56',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle(/Click to mark Paid/i))

    expect(await screen.findByText('Mark Expense as Paid?')).toBeTruthy()
    expect(screen.getByText(/This expense still has \$50\.00 remaining against budget\. Mark it as paid anyway\?/)).toBeTruthy()
    expect(screen.getByText(/Paid expenses are locked until revised\./)).toBeTruthy()

    fireEvent.click(screen.getByText('Mark Paid'))

    await waitFor(() => {
      expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(56, 'Groceries', 'Paid', null)
    })
  })

  it('shows lock guidance and hides structure-edit actions while a cycle is locked', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 57,
        budgetid: 1,
        startdate: '2026-06-01T00:00:00',
        enddate: '2026-06-30T00:00:00',
        islocked: true,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 57,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '1000.00',
          actualamount: '0.00',
          varianceamount: '-1000.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [
        {
          finperiodid: 57,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '500.00',
          actualamount: '0.00',
          remaining_amount: '500.00',
          freqtype: 'Always',
          is_oneoff: false,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/57',
      path: '/periods/:periodId',
    })

    expect(await screen.findByText(/Budget cycle is locked\./)).toBeTruthy()
    expect(screen.getByText(/You can still record actuals and transactions, but budget amounts and cycle line structure are protected until you unlock it\./)).toBeTruthy()
    expect(screen.getByText('Locked')).toBeTruthy()
    expect(screen.queryByText('Add New Income Line Item')).toBeNull()
    expect(screen.queryByText('Add New Expense Line Item')).toBeNull()

    const addExpenseButton = screen.getByTitle('Add expense transaction')
    expect(addExpenseButton.disabled).toBe(true)
  })

  it('requires confirmation before marking an over-budget investment as paid', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 58,
        budgetid: 1,
        startdate: '2026-06-01T00:00:00',
        enddate: '2026-06-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 58,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '100.00',
          actualamount: '140.00',
          remaining_amount: '-40.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1140.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })
    client.setPeriodInvestmentStatus.mockResolvedValue({})

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/58',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Spent'))

    expect(await screen.findByText('Mark Investment as Paid?')).toBeTruthy()
    expect(screen.getByText(/This investment is \$40\.00 over budget\. Mark it as paid anyway\?/)).toBeTruthy()
    expect(screen.getByText(/Paid investments are locked until revised\./)).toBeTruthy()

    fireEvent.click(screen.getByText('Mark Paid'))

    await waitFor(() => {
      expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(58, 'Emergency Fund', 'Paid', null)
    })
  })

  it('requires a revision comment before reopening a paid expense', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 59,
        budgetid: 1,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 59,
          budgetid: 1,
          expensedesc: 'Utilities',
          budgetamount: '180.00',
          actualamount: '180.00',
          remaining_amount: '0.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Paid',
          revision_comment: null,
        },
      ],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })
    client.setPeriodExpenseStatus.mockResolvedValue({})

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/59',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle(/Click to revise with a comment/))

    expect(await screen.findByText('Revise Expense — Utilities')).toBeTruthy()
    fireEvent.click(screen.getByText('Revise Expense'))
    expect(await screen.findByText('A revision comment is required')).toBeTruthy()
    expect(client.setPeriodExpenseStatus).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('Why does this paid expense need to be revised?'), {
      target: { value: 'Bill was corrected after supplier adjustment.' },
    })
    fireEvent.click(screen.getByText('Revise Expense'))

    await waitFor(() => {
      expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(59, 'Utilities', 'Revised', 'Bill was corrected after supplier adjustment.')
    })
  })

  it('requires a revision comment before reopening a paid investment', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 60,
        budgetid: 1,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 60,
          budgetid: 1,
          investmentdesc: 'Brokerage',
          budgeted_amount: '250.00',
          actualamount: '250.00',
          remaining_amount: '0.00',
          linked_account_desc: 'Investments',
          opening_value: '5000.00',
          closing_value: '5250.00',
          status: 'Paid',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })
    client.setPeriodInvestmentStatus.mockResolvedValue({})

    renderWithProviders(<PeriodDetailPage />, {
      route: '/periods/60',
      path: '/periods/:periodId',
    })

    fireEvent.click((await screen.findAllByText('Paid')).find(element => element.tagName === 'BUTTON'))

    expect(await screen.findByText('Revise Investment — Brokerage')).toBeTruthy()
    fireEvent.click(screen.getByText('Revise Investment'))
    expect(await screen.findByText('A revision comment is required')).toBeTruthy()
    expect(client.setPeriodInvestmentStatus).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Reopened after brokerage correction landed late.' },
    })
    fireEvent.click(screen.getByText('Revise Investment'))

    await waitFor(() => {
      expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(60, 'Brokerage', 'Revised', 'Reopened after brokerage correction landed late.')
    })
  })
})
