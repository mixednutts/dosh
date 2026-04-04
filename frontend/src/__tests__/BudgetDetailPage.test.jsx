import React from 'react'
import { screen } from '@testing-library/react'

import BudgetDetailPage from '../pages/BudgetDetailPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getBudget: jest.fn(),
  getIncomeTypes: jest.fn(),
  getExpenseItems: jest.fn(),
  getInvestmentItems: jest.fn(),
  getBalanceTypes: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  updateBudget: jest.fn(),
}))

jest.mock('../pages/tabs/IncomeTypesTab', () => () => <div>Income Types Tab</div>)
jest.mock('../pages/tabs/ExpenseItemsTab', () => () => <div>Expense Items Tab</div>)
jest.mock('../pages/tabs/InvestmentItemsTab', () => () => <div>Investment Items Tab</div>)
jest.mock('../pages/tabs/BalanceTypesTab', () => () => <div>Balance Types Tab</div>)
jest.mock('../pages/tabs/PersonalisationTab', () => () => <div>Personalisation Tab</div>)
jest.mock('../pages/tabs/SettingsTab', () => () => <div>Settings Tab</div>)

const client = require('../api/client')

describe('BudgetDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
      blocking_issues: ['A primary account must be configured before budget cycle generation.'],
    })

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Set one account as the primary transaction account so expense movements have a default home\./)).toBeTruthy()
    expect(screen.getByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeTruthy()
    expect(screen.getByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeTruthy()
    expect(screen.getByText(/The following information is needed to allow us to generate a budget cycle:/)).toBeTruthy()
    expect(screen.getAllByText('Needs Attention')).toHaveLength(1)
    expect(screen.getByText(/A primary account must be configured before budget cycle generation\./)).toBeTruthy()
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

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/3 accounts, 2 income types, 1 active expense item, 1 investment/)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
    expect(screen.queryByText(/Set one account as the primary account so expense movements have a default home\./)).toBeNull()
    expect(screen.getByText(/Ready for budget cycle generation/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to budget cycles' }).getAttribute('href')).toBe('/budgets/1/periods')
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

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/1 account, 1 income type, 1 active expense item, 0 investments/)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so expense tracking has an account structure in place as that behaviour develops\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
    expect(screen.queryByText(/Set one account as the primary account so expense movements have a default home\./)).toBeNull()
    expect(screen.getByText(/Ready for budget cycle generation/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to budget cycles' }).getAttribute('href')).toBe('/budgets/1/periods')
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
      blocking_issues: ['A primary account must be configured before budget cycle generation.'],
    })

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Set one account as the primary transaction account so expense movements have a default home\./)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
    expect(screen.getByText(/The following information is needed to allow us to generate a budget cycle:/)).toBeTruthy()
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
        'Add at least one active expense item before generating budget cycles.',
        'Add at least one income type before generating budget cycles.',
        'Add at least one active account before generating budget cycles.',
      ],
    })

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/The following information is needed to allow us to generate a budget cycle:/)).toBeTruthy()

    const setupIssues = screen.getAllByText(/before generating budget cycles\./).map(node => node.textContent)
    expect(setupIssues).toEqual([
      'Add at least one active account before generating budget cycles.',
      'Add at least one income type before generating budget cycles.',
      'Add at least one active expense item before generating budget cycles.',
    ])
  })
})
