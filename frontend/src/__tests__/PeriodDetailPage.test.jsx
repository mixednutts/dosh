import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import PeriodDetailPage from '../pages/PeriodDetailPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getPeriodDetail: jest.fn(),
  getBudget: jest.fn(),
  setPeriodLock: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getIncomeTransactions: jest.fn(),
  addIncomeTransaction: jest.fn(),
  deleteIncomeTransaction: jest.fn(),
  createIncomeType: jest.fn(),
  addExpenseToPeriod: jest.fn(),
  addIncomeToPeriod: jest.fn(),
  accountTransfer: jest.fn(),
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
  updatePeriodExpensePayType: jest.fn(),
  runPeriodAutoExpenses: jest.fn(),
  updatePeriodIncomeBudget: jest.fn(),
  updatePeriodExpenseBudget: jest.fn(),
  removePeriodExpense: jest.fn(),
  updatePeriodInvestmentBudget: jest.fn(),
  getBalanceTypes: jest.fn(),
  removePeriodIncome: jest.fn(),
  setPeriodInvestmentStatus: jest.fn(),
  getPeriodCloseoutPreview: jest.fn(),
  closeOutPeriod: jest.fn(),
  exportPeriod: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

function expectSummaryCardValue(label, value) {
  const cardLabel = screen.getByText(label)
  const card = cardLabel.closest('div')
  expect(card).toBeTruthy()
  expect(card.textContent).toContain(value)
}

describe('PeriodDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.createIncomeType.mockResolvedValue({})
    client.exportPeriod.mockResolvedValue('dosh-budget-cycle.csv')
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
          linked_account: 'Main Account',
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      projected_investment: '150.00',
      closeout_snapshot: {
        comments: 'Closed out smoothly.',
        carry_forward_amount: '150.00',
        health_snapshot_json: JSON.stringify({
          summary: 'This period looks to be tracking along nicely with the current plan.',
          score: 88,
          status: 'Strong',
          metrics: [],
        }),
        totals_snapshot_json: '{}',
        created_at: '2026-04-30T12:00:00',
      },
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/44',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText(/This budget cycle is closed\. All data for this budget cycle is now read-only\./)).toBeTruthy()
    expect(screen.getByText(/Carried Forward/)).toBeTruthy()
    expect(screen.getByText('Remaining Expenses')).toBeTruthy()
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Projected Investment')).toBeTruthy()
    expect(screen.getAllByText('$150.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/This period looks to be tracking along nicely with the current plan\./)).toBeTruthy()
    expect(screen.getByText(/Budget Cycle Notes & Observations/)).toBeTruthy()
    expect(screen.getByText(/Closed out smoothly\./)).toBeTruthy()
    expect(screen.queryByText('Close Out')).toBeNull()
    expect(screen.queryByText('Unlocked')).toBeNull()
  })

  it('shows export alongside lifecycle actions for active cycles and downloads the selected format', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 45,
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
      projected_investment: '0.00',
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/45',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Close Out')).toBeTruthy()
    expect(screen.getByTitle('Export budget cycle')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Export budget cycle'))
    expect(await screen.findByText('Export Budget Cycle')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /JSON \(.json\)/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /JSON \(.json\)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }))

    await waitFor(() => {
      expect(client.exportPeriod).toHaveBeenCalledWith(1, 45, 'json')
    })
  })

  it('shows Auto Expense controls only when the budget setting is enabled', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
      auto_expense_enabled: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 47,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 47,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1200.00',
          actualamount: '0.00',
          varianceamount: '0.00',
          is_oneoff: false,
          sort_order: 0,
          status: 'Current',
          remaining_amount: '1200.00',
          freqtype: 'Fixed Day of Month',
          frequency_value: 15,
          paytype: 'MANUAL',
          effectivedate: '2026-01-01T00:00:00',
        },
      ],
      investments: [],
      balances: [],
      projected_investment: '0.00',
      closeout_snapshot: null,
    })
    client.runPeriodAutoExpenses.mockResolvedValue({ created_count: 1, skipped_count: 0, skipped_reasons: [] })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/47',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Run Auto Expense')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'MANUAL' })).toBeTruthy()

    fireEvent.click(screen.getByText('Run Auto Expense'))

    await waitFor(() => {
      expect(client.runPeriodAutoExpenses).toHaveBeenCalledWith(1, 47)
    })
  })

  it('shows the paytype switch rejection in a warning modal', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
      auto_expense_enabled: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 49,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 49,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1200.00',
          actualamount: '0.00',
          varianceamount: '0.00',
          is_oneoff: false,
          sort_order: 0,
          status: 'Current',
          remaining_amount: '1200.00',
          freqtype: 'Fixed Day of Month',
          frequency_value: 15,
          paytype: 'MANUAL',
          effectivedate: '2026-01-01T00:00:00',
        },
      ],
      investments: [],
      balances: [],
      projected_investment: '0.00',
      closeout_snapshot: null,
    })
    client.updatePeriodExpensePayType.mockRejectedValue({
      response: {
        data: {
          detail: 'Expense item "Rent" cannot be changed to AUTO because it already has recorded expense activity.',
        },
      },
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/49',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByRole('button', { name: 'MANUAL' }))

    expect(await screen.findByText('Unable to Change AUTO/MANUAL')).toBeTruthy()
    expect(screen.getByText(/Expense item "Rent" cannot be changed to AUTO because it already has recorded expense activity\./i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => {
      expect(screen.queryByText('Unable to Change AUTO/MANUAL')).toBeNull()
    })
  })

  it('hides Auto Expense controls when the budget setting is disabled', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
      auto_expense_enabled: false,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 48,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 48,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1200.00',
          actualamount: '0.00',
          varianceamount: '0.00',
          is_oneoff: false,
          sort_order: 0,
          status: 'Current',
          remaining_amount: '1200.00',
          freqtype: 'Fixed Day of Month',
          frequency_value: 15,
          paytype: 'AUTO',
          effectivedate: '2026-01-01T00:00:00',
        },
      ],
      investments: [],
      balances: [],
      projected_investment: '0.00',
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/48',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Rent')).toBeTruthy()
    expect(screen.queryByText('Run Auto Expense')).toBeNull()
    expect(screen.queryByText('AUTO')).toBeNull()
  })

  it('shows export for closed cycles without lifecycle action buttons', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 46,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: true,
        cycle_status: 'CLOSED',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      projected_investment: '0.00',
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/46',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByTitle('Export budget cycle')).toBeTruthy()
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
      route: '/budgets/1/periods/55',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Close Out'))

    expect(await screen.findByText('Close Out Budget Cycle')).toBeTruthy()
    expect(await screen.findByText(/Closing a budget cycle makes it read-only/i)).toBeTruthy()
    expect(screen.getByText(/Create the next budget cycle automatically during close-out/i)).toBeTruthy()
    expect(screen.getByLabelText(/Carry this amount forward/i)).toBeTruthy()

    const closeButton = screen.getByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(true)

    fireEvent.click(screen.getByLabelText(/Create the next budget cycle automatically during close-out/i))
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
      route: '/budgets/1/periods/56',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle(/Click to mark Paid/i))

    expect(await screen.findByText('Mark Expense as Paid?')).toBeTruthy()
    expect(screen.getByText(/This expense still has \$50\.00 remaining against budget\. Mark it as paid anyway\?/)).toBeTruthy()
    expect(screen.getByText(/Paid expenses are locked until revised\./)).toBeTruthy()

    fireEvent.click(screen.getByText('Mark Paid'))

    await waitFor(() => {
      expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(1, 56, 'Groceries', 'Paid', null)
    })
  })

  it('uses icon actions for income rows and opens budget editing from the action rail', async () => {
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
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 57,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '1500.00',
          varianceamount: '-500.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/57',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Salary')).toBeTruthy()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.getByLabelText('Edit budget for Salary')).toBeTruthy()
    expect(screen.getByTitle('Add income transaction')).toBeTruthy()
    expect(screen.getByTitle('Add income correction')).toBeTruthy()
    expect(screen.getByTitle('View transactions')).toBeTruthy()
    expect(screen.getByTitle('Remove from budget cycle')).toBeTruthy()
    // Verify "Status / Txns" column header exists in Income section
    const incomeSection = screen.getByText('Income').closest('.card')
    expect(incomeSection.textContent).toContain('Status / Txns')

    fireEvent.click(screen.getByLabelText('Edit budget for Salary'))
    expect(await screen.findByText('Edit Line Budget — Salary')).toBeTruthy()
  })

  it('uses budget-column edit icons consistently for income, expense, and investment rows', async () => {
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
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 58,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '1500.00',
          varianceamount: '-500.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [
        {
          finperiodid: 58,
          budgetid: 1,
          expensedesc: 'Groceries',
          budgetamount: '300.00',
          actualamount: '120.00',
          remaining_amount: '180.00',
          freqtype: 'Always',
          frequency_value: null,
          effectivedate: null,
          paytype: 'MANUAL',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [
        {
          finperiodid: 58,
          budgetid: 1,
          investmentdesc: 'ETF',
          budgeted_amount: '250.00',
          actualamount: '100.00',
          remaining_amount: '150.00',
          opening_value: '5000.00',
          closing_value: '5100.00',
          linked_account_desc: 'Brokerage',
          status: 'Current',
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/58',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Salary')).toBeTruthy()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.getByLabelText('Edit budget for Salary')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for Groceries')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for ETF')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Edit budget for Groceries'))
    expect(await screen.findByText('Edit Line Budget — Groceries')).toBeTruthy()
  })

  it('shows lock guidance and hides structure-edit actions while a cycle is locked', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getExpenseEntries.mockResolvedValue([])
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '125.00',
        note: 'Initial contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
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
        {
          finperiodid: 57,
          budgetid: 1,
          incomedesc: 'Carried Forward',
          budgetamount: '250.00',
          actualamount: '0.00',
          varianceamount: '-250.00',
          is_system: true,
          system_key: 'carry_forward',
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
      investments: [
        {
          finperiodid: 57,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '100.00',
          actualamount: '0.00',
          remaining_amount: '100.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1000.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/57',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText(/Budget cycle is locked\./)).toBeTruthy()
    expect(screen.getByText(/You can still record actuals and transactions, but budget amounts and cycle line structure are protected unless you unlock it\./)).toBeTruthy()
    expect(screen.getByText('Locked')).toBeTruthy()
    expect(screen.queryByText('Add New Income Line Item')).toBeNull()
    expect(screen.queryByText('Add New Expense Line Item')).toBeNull()
    expect(screen.getByText('System')).toBeTruthy()

    const incomeButtons = screen.getAllByTitle('Add income transaction')
    expect(incomeButtons[0].disabled).toBe(false)
    fireEvent.click(incomeButtons[0])
    expect(await screen.findByText('Transactions — Salary')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Income' })).toBeTruthy()

    const addExpenseButton = screen.getByTitle('Add expense transaction')
    expect(addExpenseButton.disabled).toBe(false)
    fireEvent.click(addExpenseButton)
    expect(await screen.findByText('Transactions — Rent')).toBeTruthy()
    expect(screen.queryByText('Add Transaction')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Expense' })).toBeTruthy()

    const addInvestmentButton = screen.getByTitle('Add investment transaction')
    expect(addInvestmentButton.disabled).toBe(false)
    fireEvent.click(addInvestmentButton)
    expect(await screen.findByText('Transactions — Emergency Fund')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
  })

  it('records income actuals through the transaction modal instead of inline editing', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.addIncomeTransaction.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 61,
        budgetid: 1,
        startdate: '2026-08-01T00:00:00',
        enddate: '2026-08-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 61,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '0.00',
          varianceamount: '-2000.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/61',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income correction'))
    expect(await screen.findByText('Transactions — Salary')).toBeTruthy()
    expect(screen.queryByTitle('Click to set')).toBeNull()
    expect(screen.getByPlaceholderText('Amount').value).toBe('')

    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '=500/4+0.5' },
    })
    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), {
      target: { value: 'Payroll correction' },
    })
    expect(screen.getByText('= $125.50')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add Correction' }))

    await waitFor(() => {
      expect(client.addIncomeTransaction).toHaveBeenCalledWith(1, 61, 'Salary', {
        amount: -125.5,
        note: 'Payroll correction',
        entrydate: expect.any(String),
      })
    })
  })

  it('submits resolved expressions for expense transactions', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.addExpenseEntry.mockResolvedValue({})
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Main Account', balance_type: 'Transaction', is_primary: true, active: true }])
    client.getExpenseItems.mockResolvedValue([{ expensedesc: 'Rent', default_account_desc: null }])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 65,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 65,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '0.00',
          remaining_amount: '1000.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/65',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))
    expect(await screen.findByText('Transactions — Rent')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '=1000/4+25' },
    })
    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), {
      target: { value: 'Part payment' },
    })
    expect(screen.getByText('= $275.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }))

    await waitFor(() => {
      expect(client.addExpenseEntry).toHaveBeenCalledWith(1, 65, 'Rent', {
        amount: 275,
        note: 'Part payment',
        entrydate: expect.any(String),
        account_desc: 'Main Account',
      })
    })
  })

  it('uses add-remaining quick fill for expense transactions when some budget is left', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 165,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 165,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '300.00',
          remaining_amount: '700.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/165',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))
    const amountInput = screen.getByPlaceholderText('Amount')

    fireEvent.click(screen.getByRole('button', { name: /\$700\.00/ }))
    expect(amountInput.value).toBe('700')
  })

  it('does not show add-remaining quick fill on the credit expense view', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 167,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 167,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '300.00',
          remaining_amount: '700.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/167',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Refund (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$300\.00/ })).toBeTruthy()
  })

  it('hides the expense quick fill when nothing remains on the debit view', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 171,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 171,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '1000.00',
          remaining_amount: '0.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/171',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Full amount/i })).toBeNull()
  })

  it('shows full amount quick fill on the credit expense view when nothing remains', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 172,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 172,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '1000.00',
          remaining_amount: '0.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/172',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Refund (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$1,000\.00/ })).toBeTruthy()
  })

  it('uses neutral submit styling for expense transaction actions', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 181,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 181,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '300.00',
          remaining_amount: '700.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/181',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))

    expect(screen.getByRole('button', { name: 'Add Expense' }).className).toContain('btn-neutral')

    fireEvent.click(screen.getByRole('button', { name: 'Refund (−)' }))
    expect(screen.getByRole('button', { name: 'Add Refund' }).className).toContain('btn-neutral')
  })

  it('shows full amount quick fill for the actual value on the refund view when an expense is over budget', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 177,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 177,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '1360.00',
          remaining_amount: '-360.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/177',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Refund (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$1,360\.00/ })).toBeTruthy()
  })

  it('hides the income quick fill when nothing remains on the positive view', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 173,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 173,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '2000.00',
          varianceamount: '0.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/173',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Full amount/i })).toBeNull()
  })

  it('shows full amount quick fill on the income correction view when nothing remains', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 174,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 174,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '2000.00',
          varianceamount: '0.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/174',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Correction (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$2,000\.00/ })).toBeTruthy()
  })

  it('shows full amount quick fill for the actual value on the income correction view when income actual exists below budget', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 182,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 182,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '300.00',
          varianceamount: '-1700.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/182',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Correction (−)' }))

    expect(screen.getByRole('button', { name: 'Add Correction' }).className).toContain('btn-neutral')
    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$300\.00/ })).toBeTruthy()
  })

  it('uses neutral submit styling for income transaction actions', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 184,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 184,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '300.00',
          varianceamount: '-1700.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/184',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))

    expect(screen.getByRole('button', { name: 'Add Income' }).className).toContain('btn-neutral')

    fireEvent.click(screen.getByRole('button', { name: 'Correction (−)' }))
    expect(screen.getByRole('button', { name: 'Add Correction' }).className).toContain('btn-neutral')
  })

  it('shows full amount quick fill for the actual value on the income correction view when income is over budget', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 178,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 178,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '2360.00',
          varianceamount: '360.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/178',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Correction (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$2,360\.00/ })).toBeTruthy()
  })

  it('uses add-remaining quick fill for investment transactions when some budget is left', async () => {
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '125.00',
        note: 'Initial contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 168,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 168,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '125.00',
          remaining_amount: '375.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1125.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/168',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))
    const amountInput = screen.getByPlaceholderText('Amount')

    await screen.findByText('Initial contribution')
    fireEvent.click(screen.getByRole('button', { name: /\$375\.00/ }))
    expect(amountInput.value).toBe('375')
  })

  it('hides the investment quick fill when nothing remains on the positive view', async () => {
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '500.00',
        note: 'Completed contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 175,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 175,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '500.00',
          remaining_amount: '0.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1500.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/175',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))
    await screen.findByText('Completed contribution')

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Full amount/i })).toBeNull()
  })

  it('shows full amount quick fill on the investment decrease view when nothing remains', async () => {
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '500.00',
        note: 'Completed contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 176,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 176,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '500.00',
          remaining_amount: '0.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1500.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/176',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))
    await screen.findByText('Completed contribution')
    fireEvent.click(screen.getByRole('button', { name: 'Subtract (−)' }))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$500\.00/ })).toBeTruthy()
  })

  it('shows full amount quick fill for the actual value on the investment decrease view when actual exists below budget', async () => {
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '125.00',
        note: 'Partial contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 183,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 183,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '125.00',
          remaining_amount: '375.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1125.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/183',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))
    await screen.findByText('Partial contribution')
    fireEvent.click(screen.getByRole('button', { name: 'Subtract (−)' }))

    expect(screen.getByRole('button', { name: 'Subtract' }).className).toContain('btn-neutral')
    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$125\.00/ })).toBeTruthy()
  })

  it('uses neutral submit styling for investment transaction actions', async () => {
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '125.00',
        note: 'Partial contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 185,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 185,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '125.00',
          remaining_amount: '375.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1125.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/185',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))

    expect(screen.getByRole('button', { name: 'Add' }).className).toContain('btn-neutral')

    fireEvent.click(screen.getByRole('button', { name: 'Subtract (−)' }))
    expect(screen.getByRole('button', { name: 'Subtract' }).className).toContain('btn-neutral')
  })

  it('submits resolved expressions for investment transactions', async () => {
    client.getInvestmentTransactions.mockResolvedValue([])
    client.addInvestmentTransaction.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 66,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 66,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '0.00',
          remaining_amount: '500.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1000.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/66',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))
    expect(await screen.findByText('Transactions — Emergency Fund')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '=(200-50)/3' },
    })
    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), {
      target: { value: 'Adjusted contribution' },
    })
    expect(screen.getByText('= $50.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(client.addInvestmentTransaction).toHaveBeenCalledWith(1, 66, 'Emergency Fund', {
        amount: 50,
        note: 'Adjusted contribution',
        account_desc: null,
        entrydate: expect.any(String),
      })
    })
  })

  it('shows expense and investment details modals as read-only when opened from view transactions', async () => {
    client.getExpenseEntries.mockResolvedValue([
      {
        id: 1,
        amount: '50.00',
        note: 'Part payment',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getInvestmentTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '25.00',
        note: 'Initial contribution',
        entrydate: '2026-11-02T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 166,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 166,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '50.00',
          remaining_amount: '950.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [
        {
          finperiodid: 166,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '100.00',
          actualamount: '25.00',
          remaining_amount: '75.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1025.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/166',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    const viewButtons = await screen.findAllByTitle('View transactions')

    fireEvent.click(viewButtons[0])
    expect(await screen.findByText('Transactions — Rent')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add Expense' })).toBeNull()
    expect(screen.queryByPlaceholderText('Amount')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click((await screen.findAllByTitle('View transactions'))[1])
    expect(await screen.findByText('Transactions — Emergency Fund')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
    expect(screen.queryByPlaceholderText('Amount')).toBeNull()
  })

  it('shows income details modal as read-only when opened from view transactions', async () => {
    client.getIncomeTransactions.mockResolvedValue([
      {
        id: 1,
        amount: '1000.00',
        note: 'Salary payment',
        entrydate: '2026-11-01T09:00:00',
        entry_kind: 'manual',
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 167,
        budgetid: 1,
        startdate: '2026-11-01T00:00:00',
        enddate: '2026-11-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 167,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '1000.00',
          varianceamount: '-1000.00',
          is_system: false,
          system_key: null,
          linked_account: 'Checking',
          status: 'Current',
          revision_comment: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/167',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    const viewButton = await screen.findByTitle('View transactions')

    fireEvent.click(viewButton)
    expect(await screen.findByText('Transactions — Salary')).toBeTruthy()
    // In read-only mode, the Add Income button should not be present
    expect(screen.queryByRole('button', { name: 'Add Income' })).toBeNull()
    expect(screen.queryByPlaceholderText('Amount')).toBeNull()
    // Should show a Close button instead
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('submits resolved expressions for budget adjustments', async () => {
    client.updatePeriodIncomeBudget.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 67,
        budgetid: 1,
        startdate: '2026-12-01T00:00:00',
        enddate: '2026-12-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 67,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '1500.00',
          varianceamount: '-500.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/67',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByLabelText('Edit budget for Salary'))
    expect(await screen.findByText('Edit Line Budget — Salary')).toBeTruthy()

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], { target: { value: '=1000/4+25' } })
    fireEvent.change(textboxes[1], { target: { value: 'Adjusted budget' } })
    expect(screen.getByText('= $275.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Budget Change' }))

    await waitFor(() => {
      expect(client.updatePeriodIncomeBudget).toHaveBeenCalledWith(1, 67, 'Salary', {
        budgetamount: 275,
        scope: 'current',
        note: 'Adjusted budget',
      })
    })
  })

  it('allows creating a new income source directly from the add income modal', async () => {
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday Account', balance_type: 'Transaction' },
    ])
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: true,
        amount: '2000.00',
        linked_account: 'Everyday Account',
      },
    ])
    client.addIncomeToPeriod.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 63,
        budgetid: 1,
        startdate: '2026-09-01T00:00:00',
        enddate: '2026-09-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 63,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '0.00',
          varianceamount: '-2000.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/63',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Income Line Item'))
    fireEvent.click(screen.getByText('New income'))
    fireEvent.change(screen.getByPlaceholderText('e.g. Bonus'), { target: { value: 'Bonus' } })
    await screen.findByRole('option', { name: 'Everyday Account' })
    fireEvent.change(screen.getByLabelText('Paid into Account'), { target: { value: 'Everyday Account' } })
    fireEvent.change(screen.getByLabelText('Budget Amount ($)'), { target: { value: '450.00' } })
    fireEvent.change(screen.getByPlaceholderText('Why are you adding this line?'), { target: { value: 'Added for this quarter' } })
    fireEvent.click(screen.getByLabelText('This + future unlocked budget cycles'))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Bonus',
        issavings: false,
        autoinclude: true,
        amount: 450,
        linked_account: 'Everyday Account',
      })
    })

    await waitFor(() => {
      expect(client.addIncomeToPeriod).toHaveBeenCalledWith(1, 63, {
        budgetid: 1,
        incomedesc: 'Bonus',
        budgetamount: 450,
        scope: 'future',
        note: 'Added for this quarter',
      })
    })
  })

  it('submits resolved expressions from the add income modal', async () => {
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday Account', balance_type: 'Transaction' },
    ])
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: true,
        amount: '2000.00',
        linked_account: 'Everyday Account',
      },
      {
        incomedesc: 'Bonus',
        issavings: false,
        autoinclude: true,
        amount: '0.00',
        linked_account: null,
      },
    ])
    client.addIncomeToPeriod.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 68,
        budgetid: 1,
        startdate: '2027-01-01T00:00:00',
        enddate: '2027-01-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/68',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Income Line Item'))
    expect(await screen.findByText('Add Income to Budget Cycle')).toBeTruthy()

    fireEvent.change(await screen.findByRole('combobox', { name: 'Income Source' }), {
      target: { value: 'Bonus' },
    })
    fireEvent.change(screen.getByLabelText('Budget Amount ($)'), {
      target: { value: '=1000/4+25' },
    })
    fireEvent.change(screen.getByLabelText('Comment / Note'), {
      target: { value: 'Quarterly top-up' },
    })
    expect(screen.getByText('= $275.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(client.addIncomeToPeriod).toHaveBeenCalledWith(1, 68, {
        budgetid: 1,
        incomedesc: 'Bonus',
        budgetamount: 275,
        scope: 'oneoff',
        note: 'Quarterly top-up',
      })
    })
  })

  it('submits resolved expressions from the add expense modal', async () => {
    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Rent',
        expenseamount: '1200.00',
      },
    ])
    client.addExpenseToPeriod.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 69,
        budgetid: 1,
        startdate: '2027-01-01T00:00:00',
        enddate: '2027-01-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/69',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Expense Line Item'))
    expect(await screen.findByText('Add Expense to Budget Cycle')).toBeTruthy()

    fireEvent.change(await screen.findByRole('combobox', { name: 'Expense Item' }), {
      target: { value: 'Rent' },
    })
    fireEvent.change(screen.getByLabelText('Budget Amount ($)'), {
      target: { value: '=1000/4+25' },
    })
    fireEvent.change(screen.getByLabelText('Comment / Note'), {
      target: { value: 'Monthly allocation' },
    })
    expect(screen.getByText('= $275.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(client.addExpenseToPeriod).toHaveBeenCalledWith(1, 69, {
        budgetid: 1,
        expensedesc: 'Rent',
        budgetamount: 275,
        scope: 'oneoff',
        note: 'Monthly allocation',
      })
    })
  })

  it('blocks invalid expressions from submitting and keeps quick-fill working', async () => {
    client.getIncomeTransactions.mockResolvedValue([])
    client.addIncomeTransaction.mockResolvedValue({})
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 70,
        budgetid: 1,
        startdate: '2027-02-01T00:00:00',
        enddate: '2027-02-28T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 70,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '0.00',
          varianceamount: '-2000.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/70',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income transaction'))
    expect(await screen.findByText('Transactions — Salary')).toBeTruthy()

    const amountInput = screen.getByPlaceholderText('Amount')
    fireEvent.change(amountInput, { target: { value: '=1000//4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }))

    expect(screen.getAllByText('Enter a valid calculation').length).toBeGreaterThan(0)
    expect(screen.getByText('Enter a valid amount')).toBeTruthy()
    expect(client.addIncomeTransaction).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /\$2,000\.00/ }))
    expect(screen.getByPlaceholderText('Amount').value).toBe('2000')
    expect(screen.queryByText('= $2,000.00')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), {
      target: { value: 'Full amount' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }))

    await waitFor(() => {
      expect(client.addIncomeTransaction).toHaveBeenCalledWith(1, 70, 'Salary', {
        amount: 2000,
        note: 'Full amount',
        entrydate: expect.any(String),
      })
    })
  })

  it('shows full amount quick fill on the positive expense view when no actual has been recorded yet', async () => {
    client.getExpenseEntries.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 179,
        budgetid: 1,
        startdate: '2027-02-01T00:00:00',
        enddate: '2027-02-28T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 179,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '0.00',
          remaining_amount: '1000.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/179',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add expense transaction'))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$1,000\.00/ })).toBeTruthy()
  })

  it('shows full amount quick fill on the positive investment view when no actual has been recorded yet', async () => {
    client.getInvestmentTransactions.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 180,
        budgetid: 1,
        startdate: '2027-02-01T00:00:00',
        enddate: '2027-02-28T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 180,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '500.00',
          actualamount: '0.00',
          remaining_amount: '500.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1000.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/180',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add investment transaction'))

    expect(screen.queryByRole('button', { name: /Remaining amount/i })).toBeNull()
    expect(screen.getByRole('button', { name: /\$500\.00/ })).toBeTruthy()
  })

  it('shows fixed-day rollover guidance when creating a new expense line on day 31', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 71,
        budgetid: 1,
        startdate: '2027-03-01T00:00:00',
        enddate: '2027-03-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/71',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Expense Line Item'))
    fireEvent.click(screen.getByRole('button', { name: 'New item' }))
    fireEvent.change(screen.getByLabelText('Day of Month (1-31)'), { target: { value: '31' } })

    expect(screen.getByText(/If a month does not include day 31, Dosh will move this expense to the next day after month end\./)).toBeTruthy()
  })

  it('hides effective date when creating an always-included expense line item', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 72,
        budgetid: 1,
        startdate: '2027-03-01T00:00:00',
        enddate: '2027-03-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/72',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Expense Line Item'))
    fireEvent.click(screen.getByRole('button', { name: 'New item' }))
    fireEvent.change(screen.getByLabelText('Frequency Type'), { target: { value: 'Always' } })

    expect(screen.queryByLabelText(/Effective Date/i)).toBeNull()
    expect(screen.queryByLabelText(/Comment \/ Note/i)).toBeTruthy()
    expect(screen.queryByText('Include in')).toBeTruthy()
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
      route: '/budgets/1/periods/58',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Spent'))

    expect(await screen.findByText('Mark Investment as Paid?')).toBeTruthy()
    expect(screen.getByText(/This investment is \$40\.00 over budget\. Mark it as paid anyway\?/)).toBeTruthy()
    expect(screen.getByText(/Paid investments are locked until revised\./)).toBeTruthy()

    fireEvent.click(screen.getByText('Mark Paid'))

    await waitFor(() => {
      expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(1, 58, 'Emergency Fund', 'Paid', null)
    })
  })

  it('renders the total income footer with a full-width row and no dangling action artifact', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 62,
        budgetid: 1,
        startdate: '2026-09-01T00:00:00',
        enddate: '2026-09-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 62,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '2000.00',
          actualamount: '2000.00',
          varianceamount: '0.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [],
      investments: [],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/62',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    const totalIncomeCell = await screen.findByText('Total Income')
    const totalIncomeRow = totalIncomeCell.closest('tr')

    expect(totalIncomeRow).toBeTruthy()
    expect(totalIncomeRow.children).toHaveLength(5)
  })

  it('uses the same spent-pill wording model for investments as expenses', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 63,
        budgetid: 1,
        startdate: '2026-09-01T00:00:00',
        enddate: '2026-09-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 63,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '100.00',
          actualamount: '95.00',
          remaining_amount: '5.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1095.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/63',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    const spentButton = await screen.findByTitle(/95% spent • \$95\.00 of \$100\.00 • Remaining \$5\.00 • Click to mark Paid/i)
    expect(spentButton).toBeTruthy()
    expect(spentButton.textContent).toBe('Spent')
  })

  it('shows investment and balance totals while keeping balance movement non-totaled', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 64,
        budgetid: 1,
        startdate: '2026-10-01T00:00:00',
        enddate: '2026-10-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [
        {
          finperiodid: 64,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '100.00',
          actualamount: '80.00',
          remaining_amount: '20.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1080.00',
          status: 'Current',
          revision_comment: null,
        },
        {
          finperiodid: 64,
          budgetid: 1,
          investmentdesc: 'Brokerage',
          budgeted_amount: '50.00',
          actualamount: '75.00',
          remaining_amount: '-25.00',
          linked_account_desc: 'Investments',
          opening_value: '5000.00',
          closing_value: '5075.00',
          status: 'Paid',
          revision_comment: null,
        },
      ],
      balances: [
        {
          balancedesc: 'Everyday',
          balance_type: 'Transaction',
          opening_amount: '1000.00',
          movement_amount: '250.00',
        },
        {
          balancedesc: 'Savings',
          balance_type: 'Savings',
          opening_amount: '500.00',
          movement_amount: '-100.00',
        },
      ],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/64',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect((await screen.findAllByText('Status / Txns')).length).toBeGreaterThanOrEqual(2)

    const totalInvestmentsRow = screen.getByText('Total Investments').closest('tr')
    expect(totalInvestmentsRow).toBeTruthy()
    expect(totalInvestmentsRow.textContent).toContain('$150.00')
    expect(totalInvestmentsRow.textContent).toContain('$155.00')
    expect(totalInvestmentsRow.textContent).toContain('$20.00')

    const totalBalancesRow = screen.getByText('Total Balances').closest('tr')
    expect(totalBalancesRow).toBeTruthy()
    expect(totalBalancesRow.textContent).toContain('$1,500.00')
    expect(totalBalancesRow.textContent).toContain('$1,650.00')
    expect(totalBalancesRow.textContent).toContain('—')

  })

  it('shows balance movement details with transfer direction and source-specific labels', async () => {
    client.getBalanceTransactions.mockResolvedValue([
      {
        id: 1,
        source: 'transfer',
        type: 'TRANSFER',
        amount: '75.00',
        affected_account_desc: 'Main Account',
        related_account_desc: 'Savings',
        note: 'Moved money in',
        entrydate: '2026-05-12T09:30:00',
        is_system: false,
      },
      {
        id: 2,
        source: 'transfer',
        type: 'TRANSFER',
        amount: '20.00',
        affected_account_desc: 'Brokerage',
        related_account_desc: 'Main Account',
        note: 'Moved money out',
        entrydate: '2026-05-13T09:30:00',
        is_system: false,
      },
      {
        id: 3,
        source: 'expense',
        type: 'EXPENSE',
        amount: '15.00',
        affected_account_desc: 'Main Account',
        source_label: 'Groceries',
        note: 'Weekly shop',
        entrydate: '2026-05-14T09:30:00',
        is_system: false,
      },
      {
        id: 4,
        source: 'balance',
        type: 'SYSTEM',
        amount: '5.00',
        affected_account_desc: 'Main Account',
        source_label: 'Opening correction',
        system_reason: 'Aligned to imported opening balance.',
        note: null,
        entrydate: '2026-05-15T09:30:00',
        is_system: true,
      },
    ])
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 71,
        budgetid: 1,
        startdate: '2026-05-01T00:00:00',
        enddate: '2026-05-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [],
      investments: [],
      balances: [
        {
          balancedesc: 'Main Account',
          balance_type: 'Transaction',
          opening_amount: '1000.00',
          movement_amount: '45.00',
        },
      ],
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/71',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('View supporting transactions'))

    expect(await screen.findByText('Movement Details — Main Account')).toBeTruthy()
    expect(await screen.findByText('Moved money in')).toBeTruthy()
    expect(screen.getByText('Moved money out')).toBeTruthy()
    expect(screen.getByText('Weekly shop')).toBeTruthy()
    expect(screen.getByText('Aligned to imported opening balance.')).toBeTruthy()
    expect(screen.getByText('Transactions Total')).toBeTruthy()
    expect(screen.getAllByText('TRANSFER').length).toBe(2)
    expect(screen.getAllByText('$45.00').length).toBeGreaterThan(0)
    expect(screen.getByText('-$15.00')).toBeTruthy()
    expect(screen.getByText('System')).toBeTruthy()
  })

  it('filters the expense table by status', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 172,
        budgetid: 1,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 172,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '180.00',
          actualamount: '180.00',
          remaining_amount: '0.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Paid',
          revision_comment: null,
        },
        {
          finperiodid: 172,
          budgetid: 1,
          expensedesc: 'Utilities',
          budgetamount: '140.00',
          actualamount: '40.00',
          remaining_amount: '100.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/172',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Rent')).toBeTruthy()
    expect(screen.getByText('Utilities')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Paid' } })

    expect(screen.getByText('Rent')).toBeTruthy()
    expect(screen.queryByText('Utilities')).toBeNull()
  })

  it('totals remaining expenses using only positive remaining values', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 173,
        budgetid: 1,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [],
      expenses: [
        {
          finperiodid: 173,
          budgetid: 1,
          expensedesc: 'Groceries',
          budgetamount: '120.00',
          actualamount: '100.00',
          remaining_amount: '20.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
        {
          finperiodid: 173,
          budgetid: 1,
          expensedesc: 'Fuel',
          budgetamount: '60.00',
          actualamount: '85.00',
          remaining_amount: '-25.00',
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

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/173',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    const totalExpensesRow = (await screen.findByText('Total Expenses')).closest('tr')
    expect(totalExpensesRow).toBeTruthy()
    expect(totalExpensesRow.textContent).toContain('$20.00')
    expect(totalExpensesRow.textContent).not.toContain('-$5.00')
  })

  it('derives surplus budget from actual net position minus remaining obligations', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 174,
        budgetid: 1,
        startdate: '2026-07-01T00:00:00',
        enddate: '2026-07-31T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 174,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '1000.00',
          actualamount: '960.00',
          varianceamount: '-40.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [
        {
          finperiodid: 174,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '800.00',
          actualamount: '15.00',
          remaining_amount: '785.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
        {
          finperiodid: 174,
          budgetid: 1,
          expensedesc: 'Fuel',
          budgetamount: '60.00',
          actualamount: '85.00',
          remaining_amount: '-25.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [
        {
          finperiodid: 174,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '105.00',
          actualamount: '0.00',
          remaining_amount: '105.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1000.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
      projected_investment: '0.00',
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/174',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Surplus (Budget)')).toBeTruthy()
    expectSummaryCardValue('Surplus (Budget)', '-$30.00')

    const totalExpensesRow = screen.getByText('Total Expenses').closest('tr')
    expect(totalExpensesRow).toBeTruthy()
    expect(totalExpensesRow.textContent).toContain('$785.00')

    const totalInvestmentsRow = screen.getByText('Total Investments').closest('tr')
    expect(totalInvestmentsRow).toBeTruthy()
    expect(totalInvestmentsRow.textContent).toContain('$105.00')
  })

  it('reopens a paid expense as revised immediately', async () => {
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
      route: '/budgets/1/periods/59',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle(/Click to reopen as Revised/))

    await waitFor(() => {
      expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(1, 59, 'Utilities', 'Revised', null)
    })
  })

  it('uses planned budget amounts for surplus budget in untouched future periods', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 175,
        budgetid: 1,
        startdate: '2026-08-01T00:00:00',
        enddate: '2026-08-31T00:00:00',
        islocked: false,
        cycle_status: 'PLANNED',
      },
      incomes: [
        {
          finperiodid: 175,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '890.00',
          actualamount: '0.00',
          varianceamount: '890.00',
          is_system: false,
          system_key: null,
        },
      ],
      expenses: [
        {
          finperiodid: 175,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '785.00',
          actualamount: '0.00',
          remaining_amount: '785.00',
          freqtype: 'Always',
          is_oneoff: true,
          note: null,
          status: 'Current',
          revision_comment: null,
        },
      ],
      investments: [
        {
          finperiodid: 175,
          budgetid: 1,
          investmentdesc: 'Emergency Fund',
          budgeted_amount: '105.00',
          actualamount: '0.00',
          remaining_amount: '105.00',
          linked_account_desc: 'Savings',
          opening_value: '1000.00',
          closing_value: '1000.00',
          status: 'Current',
          revision_comment: null,
        },
      ],
      balances: [],
      closeout_snapshot: null,
      projected_investment: '105.00',
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/175',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    expect(await screen.findByText('Surplus (Budget)')).toBeTruthy()
    expectSummaryCardValue('Surplus (Budget)', '$0.00')
  })

  it('reopens a paid investment as revised immediately', async () => {
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
      route: '/budgets/1/periods/60',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    fireEvent.click((await screen.findAllByText('Paid')).find(element => element.tagName === 'BUTTON'))

    await waitFor(() => {
      expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(1, 60, 'Brokerage', 'Revised', null)
    })
  })

  it('renders consistent table layout across income, expense, and investment sections', async () => {
    // Layout consistency test: ensures column alignment persists across sections
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
      auto_expense_enabled: false,
    })
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 70, startdate: '2026-03-01T00:00:00', enddate: '2026-03-31T00:00:00' },
      { finperiodid: 71, startdate: '2026-04-01T00:00:00', enddate: '2026-04-30T00:00:00' },
      { finperiodid: 72, startdate: '2026-05-01T00:00:00', enddate: '2026-05-31T00:00:00' },
    ])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 71,
        budgetid: 1,
        startdate: '2026-04-01T00:00:00',
        enddate: '2026-04-30T00:00:00',
        islocked: false,
        cycle_status: 'ACTIVE',
      },
      incomes: [
        {
          finperiodid: 71,
          budgetid: 1,
          incomedesc: 'Salary',
          budgetamount: '3000.00',
          actualamount: '3000.00',
          varianceamount: '0.00',
          is_system: false,
          system_key: null,
          linked_account: 'Checking',
        },
      ],
      expenses: [
        {
          finperiodid: 71,
          budgetid: 1,
          expensedesc: 'Rent',
          budgetamount: '1000.00',
          actualamount: '1000.00',
          remaining_amount: '0.00',
          status: 'Paid',
          is_oneoff: false,
          freqtype: 'Always',
          frequency_value: null,
          effectivedate: null,
          paytype: 'MANUAL',
          revision_snapshot: 0,
        },
      ],
      investments: [
        {
          finperiodid: 71,
          budgetid: 1,
          investmentdesc: 'Savings',
          budgeted_amount: '500.00',
          actualamount: '500.00',
          remaining_amount: '0.00',
          status: 'Paid',
          linked_account_desc: 'Savings Account',
          revision_snapshot: 0,
        },
      ],
      balances: [],
      projected_investment: '1500.00',
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/71',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    await screen.findByText('Salary')

    // Verify "Remaining" column header exists in Income (not "Variance")
    const incomeSection = screen.getByText('Income').closest('.card')
    expect(incomeSection.textContent).toContain('Remaining')
    expect(incomeSection.textContent).not.toContain('Variance')

    // Verify "Account" column exists in Income section
    expect(incomeSection.textContent).toContain('Account')

    // Verify linked account is displayed
    expect(screen.getByText('Checking')).toBeTruthy()

    // Verify consistent column headers across sections
    const expenseSection = screen.getByText('Expenses').closest('.card')
    const investmentSection = screen.getByText('Investments').closest('.card')

    // All sections should have Budget, Actual, Remaining columns
    expect(incomeSection.textContent).toContain('Budget')
    expect(incomeSection.textContent).toContain('Actual')
    expect(expenseSection.textContent).toContain('Budget')
    expect(expenseSection.textContent).toContain('Actual')
    expect(expenseSection.textContent).toContain('Remaining')
    expect(investmentSection.textContent).toContain('Budget')
    expect(investmentSection.textContent).toContain('Actual')
    expect(investmentSection.textContent).toContain('Remaining')

    // All sections should have "Status / Txns" column
    expect(incomeSection.textContent).toContain('Status / Txns')
    expect(expenseSection.textContent).toContain('Status / Txns')
    expect(investmentSection.textContent).toContain('Status / Txns')
  })

  it('shows period navigation chevrons when other periods exist', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_cycle_lock: true,
    })
    client.getPeriodsForBudget.mockResolvedValue([
      { finperiodid: 80, startdate: '2026-03-01T00:00:00', enddate: '2026-03-31T00:00:00' },
      { finperiodid: 81, startdate: '2026-04-01T00:00:00', enddate: '2026-04-30T00:00:00' },
      { finperiodid: 82, startdate: '2026-05-01T00:00:00', enddate: '2026-05-31T00:00:00' },
    ])
    client.getPeriodDetail.mockResolvedValue({
      period: {
        finperiodid: 81,
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
      projected_investment: '0.00',
      closeout_snapshot: null,
    })

    renderWithProviders(<PeriodDetailPage />, {
      route: '/budgets/1/periods/81',
      path: '/budgets/:budgetId/periods/:periodId',
    })

    // Wait for page to load
    await screen.findByText('Home Budget')

    // Navigation links should be present (chevrons are part of the links)
    const navLinks = document.querySelectorAll('a[href^="/budgets/1/periods/"]')
    expect(navLinks.length).toBe(2) // Previous and next
  })
})
