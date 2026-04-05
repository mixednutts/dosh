import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import PeriodDetailPage from '../pages/PeriodDetailPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getPeriodDetail: jest.fn(),
  getBudget: jest.fn(),
  setPeriodLock: jest.fn(),
  getIncomeTransactions: jest.fn(),
  addIncomeTransaction: jest.fn(),
  deleteIncomeTransaction: jest.fn(),
  createIncomeType: jest.fn(),
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
  updatePeriodIncomeBudget: jest.fn(),
  updatePeriodExpenseBudget: jest.fn(),
  removePeriodExpense: jest.fn(),
  updatePeriodInvestmentBudget: jest.fn(),
  getBalanceTypes: jest.fn(),
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
    client.createIncomeType.mockResolvedValue({})
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
      projected_savings: '150.00',
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
    expect(screen.getByText('Remaining Expenses')).toBeTruthy()
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Projected Savings')).toBeTruthy()
    expect(screen.getByText('$150.00')).toBeTruthy()
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
      route: '/periods/57',
      path: '/periods/:periodId',
    })

    expect(await screen.findByText('Salary')).toBeTruthy()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.getByLabelText('Edit budget for Salary')).toBeTruthy()
    expect(screen.getByTitle('Add income transaction')).toBeTruthy()
    expect(screen.getByTitle('Add income correction')).toBeTruthy()
    expect(screen.getByTitle('View transactions')).toBeTruthy()
    expect(screen.getByTitle('Remove from budget cycle')).toBeTruthy()
    expect(screen.getByText('Actions')).toBeTruthy()

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
      route: '/periods/58',
      path: '/periods/:periodId',
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
      route: '/periods/57',
      path: '/periods/:periodId',
    })

    expect(await screen.findByText(/Budget cycle is locked\./)).toBeTruthy()
    expect(screen.getByText(/You can still record actuals and transactions, but budget amounts and cycle line structure are protected until you unlock it\./)).toBeTruthy()
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
    expect(screen.getAllByText('Add Transaction').length).toBeGreaterThan(0)
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
      route: '/periods/61',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle('Add income correction'))
    expect(await screen.findByText('Transactions — Salary')).toBeTruthy()
    expect(screen.queryByTitle('Click to set')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '125.50' },
    })
    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), {
      target: { value: 'Payroll correction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Correction' }))

    await waitFor(() => {
      expect(client.addIncomeTransaction).toHaveBeenCalledWith(61, 'Salary', {
        amount: -125.5,
        note: 'Payroll correction',
      })
    })
  })

  it('allows creating a new income type directly from the add income modal', async () => {
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday Account', balance_type: 'Transaction' },
    ])
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
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
      route: '/periods/63',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByText('Add New Income Line Item'))
    fireEvent.click(screen.getByText('New income'))
    fireEvent.change(screen.getByPlaceholderText('e.g. Bonus'), { target: { value: 'Bonus' } })
    await screen.findByRole('option', { name: 'Everyday Account' })
    fireEvent.change(screen.getByLabelText('Paid into Account'), { target: { value: 'Everyday Account' } })
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '450.00' } })
    fireEvent.change(screen.getByPlaceholderText('Why are you adding this line?'), { target: { value: 'Added for this quarter' } })
    fireEvent.click(screen.getByLabelText('This + future unlocked budget cycles'))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Bonus',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 450,
        linked_account: 'Everyday Account',
      })
    })

    await waitFor(() => {
      expect(client.addIncomeToPeriod).toHaveBeenCalledWith(63, {
        budgetid: 1,
        incomedesc: 'Bonus',
        budgetamount: 450,
        scope: 'future',
        note: 'Added for this quarter',
      })
    })
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
      route: '/periods/62',
      path: '/periods/:periodId',
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
      route: '/periods/63',
      path: '/periods/:periodId',
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
      route: '/periods/64',
      path: '/periods/:periodId',
    })

    expect((await screen.findAllByText('Status / Txns')).length).toBeGreaterThanOrEqual(2)

    const totalInvestmentsRow = screen.getByText('Total Investments').closest('tr')
    expect(totalInvestmentsRow).toBeTruthy()
    expect(totalInvestmentsRow.textContent).toContain('$175.00')
    expect(totalInvestmentsRow.textContent).toContain('$155.00')
    expect(totalInvestmentsRow.textContent).toContain('-$5.00')

    const totalBalancesRow = screen.getByText('Total Balances').closest('tr')
    expect(totalBalancesRow).toBeTruthy()
    expect(totalBalancesRow.textContent).toContain('$1,500.00')
    expect(totalBalancesRow.textContent).toContain('$1,650.00')
    expect(totalBalancesRow.textContent).toContain('—')

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
      route: '/periods/59',
      path: '/periods/:periodId',
    })

    fireEvent.click(await screen.findByTitle(/Click to reopen as Revised/))

    await waitFor(() => {
      expect(client.setPeriodExpenseStatus).toHaveBeenCalledWith(59, 'Utilities', 'Revised', null)
    })
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
      route: '/periods/60',
      path: '/periods/:periodId',
    })

    fireEvent.click((await screen.findAllByText('Paid')).find(element => element.tagName === 'BUTTON'))

    await waitFor(() => {
      expect(client.setPeriodInvestmentStatus).toHaveBeenCalledWith(60, 'Brokerage', 'Revised', null)
    })
  })
})
