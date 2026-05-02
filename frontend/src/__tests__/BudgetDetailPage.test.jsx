import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import BudgetDetailPage from '../pages/BudgetDetailPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getBudget: jest.fn(),
  getIncomeTypes: jest.fn(),
  getExpenseItems: jest.fn(),
  getInvestmentItems: jest.fn(),
  getBalanceTypes: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  getPeriodSummariesForBudget: jest.fn(),
  updateBudget: jest.fn(),
}))

jest.mock('../pages/tabs/IncomeTypesTab', () => () => <div>Income Sources Tab</div>)
jest.mock('../pages/tabs/ExpenseItemsTab', () => () => <div>Expense Items Tab</div>)
jest.mock('../pages/tabs/InvestmentItemsTab', () => () => <div>Investment Items Tab</div>)
jest.mock('../pages/tabs/BalanceTypesTab', () => () => <div>Balance Types Tab</div>)
jest.mock('../pages/tabs/BudgetHealthTab', () => () => <div>Budget Health</div>)
jest.mock('../pages/tabs/SettingsTab', () => () => <div>Settings Tab</div>)

const client = require('../api/client')

describe('BudgetDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function mockSetupAssessment(overrides = {}) {
    client.getBudgetSetupAssessment.mockResolvedValue({
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [],
      investment_items: [],
      ...overrides,
    })
  }

  function mockNoPeriods() {
    client.getPeriodSummariesForBudget.mockResolvedValue([])
  }

  it('shows setup guidance when no accounts exist yet', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([])
    client.getIncomeTypes.mockResolvedValue([])
    client.getExpenseItems.mockResolvedValue([])
    client.getInvestmentItems.mockResolvedValue([])
    mockSetupAssessment({
      can_generate: false,
      blocking_issues: ['Choose one active account as the primary account so expense entries have a default home.'],
    })
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Choose one account as the primary account, so expenses know which account to deduct from by default\./)).toBeTruthy()
    expect(screen.getByText(/Add an account first if you want income to flow into a tracked account\./)).toBeTruthy()
    expect(screen.getByText(/Add an account first if you want investment contributions linked to a tracked account\./)).toBeTruthy()
    expect(screen.getByText(/A few setup details still need attention before the first budget cycle can be created\./)).toBeTruthy()
    expect(screen.getAllByText('Needs Attention')).toHaveLength(1)
    expect(screen.getByText(/Choose one active account as the primary account so expense entries have a default home\./)).toBeTruthy()
  })

  it('reflects a mixed-account setup shape without no-account guidance', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction', active: true, is_primary: true },
      { balancedesc: 'Bills', balance_type: 'Transaction', active: true, is_primary: false },
      { balancedesc: 'Savings', balance_type: 'Savings', active: true, is_primary: false },
    ])
    client.getIncomeTypes.mockResolvedValue([
      { incomedesc: 'Salary' },
      { incomedesc: 'Side Hustle' },
    ])
    client.getExpenseItems.mockResolvedValue([
      { expensedesc: 'Rent', active: true },
      { expensedesc: 'Insurance', active: false },
    ])
    client.getInvestmentItems.mockResolvedValue([
      { investmentdesc: 'ETF Portfolio' },
    ])
    mockSetupAssessment({
      warnings: ['Some setup items are already in downstream use and are now protected.'],
      accounts: [{ account_desc: 'Everyday', in_use: true }],
      income_types: [{ income_desc: 'Salary', in_use: true }],
      expense_items: [{ expense_desc: 'Rent', in_use: true }],
      investment_items: [{ investment_desc: 'ETF Portfolio', in_use: true }],
    })
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/3 accounts, 2 income sources, 1 active expense item, 1 investment/)).toBeTruthy()
    expect(screen.queryByText(/Add an account first if you want income to flow into a tracked account\./)).toBeNull()
    expect(screen.queryByText(/Add an account first if you want investment contributions linked to a tracked account\./)).toBeNull()
    expect(screen.queryByText(/Choose one account as the primary account, this allow expenses to know which account to deduct from by default\./)).toBeNull()
    expect(screen.getByText(/This setup is ready for your first budget cycle\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review budget cycles' }).getAttribute('href')).toBe('/budgets/1')
    expect(screen.getAllByText('1 In Use')).toHaveLength(4)
    expect(screen.getByText(/Some setup items are already in downstream use and are now protected\./)).toBeTruthy()
  })

  it('treats a single-account setup as valid without account-foundation warnings', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction', active: true, is_primary: true },
    ])
    client.getIncomeTypes.mockResolvedValue([
      { incomedesc: 'Salary' },
    ])
    client.getExpenseItems.mockResolvedValue([
      { expensedesc: 'Rent', active: true },
    ])
    client.getInvestmentItems.mockResolvedValue([])
    mockSetupAssessment()
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/1 account, 1 income source, 1 active expense item, 0 investments/)).toBeTruthy()
    expect(screen.queryByText(/Add an account first if you want income to flow into a tracked account\./)).toBeNull()
    expect(screen.queryByText(/Add an account first so future expense entries can be connected to one when you need that\./)).toBeNull()
    expect(screen.queryByText(/Add an account first if you want investment contributions linked to a tracked account\./)).toBeNull()
    expect(screen.queryByText(/Choose one account as the primary account, this allow expenses to know which account to deduct from by default\./)).toBeNull()
    expect(screen.getByText(/This setup is ready for your first budget cycle\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review budget cycles' }).getAttribute('href')).toBe('/budgets/1')
    expect(screen.getAllByText('Ready')).toHaveLength(4)
  })

  it('prompts for a primary account when accounts exist but none is selected', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction', active: true, is_primary: false },
      { balancedesc: 'Savings', balance_type: 'Savings', active: true, is_primary: false },
    ])
    client.getIncomeTypes.mockResolvedValue([{ incomedesc: 'Salary' }])
    client.getExpenseItems.mockResolvedValue([{ expensedesc: 'Rent', active: true }])
    client.getInvestmentItems.mockResolvedValue([{ investmentdesc: 'ETF Portfolio' }])
    mockSetupAssessment({
      can_generate: false,
      blocking_issues: ['Choose one active account as the primary account so expense entries have a default home.'],
    })
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Choose one account as the primary account, so expenses know which account to deduct from by default\./)).toBeTruthy()
    expect(screen.queryByText(/Add an account first if you want income to flow into a tracked account\./)).toBeNull()
    expect(screen.queryByText(/Add an account first if you want investment contributions linked to a tracked account\./)).toBeNull()
    expect(screen.getByText(/A few setup details still need attention before the first budget cycle can be created\./)).toBeTruthy()
    expect(screen.getAllByText('Needs Attention')).toHaveLength(1)
  })

  it('shows blocking issues in the same order as the setup sections', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([])
    client.getIncomeTypes.mockResolvedValue([])
    client.getExpenseItems.mockResolvedValue([])
    client.getInvestmentItems.mockResolvedValue([])
    mockSetupAssessment({
      can_generate: false,
      blocking_issues: [
        'Add at least one active expense item so your budget cycle has spending to plan for.',
        'Add at least one income source so your budget cycle has income to plan with.',
        'Add at least one active account so Dosh has a place to track this budget\'s balances.',
      ],
    })
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/A few setup details still need attention before the first budget cycle can be created\./)).toBeTruthy()

    const setupIssues = [
      'Add at least one active account so Dosh has a place to track this budget\'s balances.',
      'Add at least one income source so your budget cycle has income to plan with.',
      'Add at least one active expense item so your budget cycle has spending to plan for.',
    ].map(issue => screen.getByText(issue).textContent)
    expect(setupIssues).toEqual([
      'Add at least one active account so Dosh has a place to track this budget\'s balances.',
      'Add at least one income source so your budget cycle has income to plan with.',
      'Add at least one active expense item so your budget cycle has spending to plan for.',
    ])
  })

  it('autosaves budget info edits after the debounce and blocks blank-owner saves', async () => {
    jest.useFakeTimers()
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_overdraft_transactions: false,
    })
    client.getBalanceTypes.mockResolvedValue([])
    client.getIncomeTypes.mockResolvedValue([])
    client.getExpenseItems.mockResolvedValue([])
    client.getInvestmentItems.mockResolvedValue([])
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Jordan',
      description: 'Renamed Budget',
      budget_frequency: 'Monthly',
      allow_overdraft_transactions: false,
    })
    mockSetupAssessment()
    mockNoPeriods()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    const nameInput = await screen.findByLabelText('Budget Name')
    const ownerInput = screen.getByLabelText('Budget Owner')

    fireEvent.change(nameInput, { target: { value: 'Renamed Budget' } })
    fireEvent.change(ownerInput, { target: { value: 'Jordan' } })

    act(() => {
      jest.advanceTimersByTime(450)
    })

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, {
        description: 'Renamed Budget',
        budgetowner: 'Jordan',
      })
    })

    client.updateBudget.mockClear()
    fireEvent.change(ownerInput, { target: { value: '   ' } })
    act(() => {
      jest.advanceTimersByTime(450)
    })

    expect(screen.getByText(/Budget Owner can't be blank/i)).toBeTruthy()
    expect(client.updateBudget).not.toHaveBeenCalled()
  })

  it('remembers collapsed section state for the setup session', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
      allow_overdraft_transactions: false,
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction', active: true, is_primary: true },
    ])
    client.getIncomeTypes.mockResolvedValue([{ incomedesc: 'Salary' }])
    client.getExpenseItems.mockResolvedValue([{ expensedesc: 'Rent', active: true }])
    client.getInvestmentItems.mockResolvedValue([])
    mockSetupAssessment()
    mockNoPeriods()

    const firstRender = renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByTitle('Expand budget health')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Expand budget health'))
    expect(screen.getByRole('heading', { name: 'Budget Health' })).toBeTruthy()

    firstRender.unmount()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByTitle('Collapse budget health')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Budget Health' })).toBeTruthy()
  })

  it('hides the setup assessment card when budget cycles already exist', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction', active: true, is_primary: true },
    ])
    client.getIncomeTypes.mockResolvedValue([{ incomedesc: 'Salary' }])
    client.getExpenseItems.mockResolvedValue([{ expensedesc: 'Rent', active: true }])
    client.getInvestmentItems.mockResolvedValue([])
    client.getPeriodSummariesForBudget.mockResolvedValue([
      { period: { finperiodid: 10, startdate: '2024-01-01', enddate: '2024-01-31' } },
    ])
    mockSetupAssessment()

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/1 account, 1 income source, 1 active expense item, 0 investments/)).toBeTruthy()
    expect(screen.queryByText(/Setup Assessment/)).toBeNull()
    expect(screen.queryByText(/This setup is ready for your first budget cycle\./)).toBeNull()
  })
})
