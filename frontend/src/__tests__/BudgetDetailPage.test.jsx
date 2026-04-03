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

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Set one account as the primary account so expense movements have a default home\./)).toBeTruthy()
    expect(screen.getByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeTruthy()
    expect(screen.getByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeTruthy()
  })

  it('reflects a mixed-account setup shape without no-account guidance', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Bank', active: true, is_primary: true },
      { balancedesc: 'Bills', balance_type: 'Bank', active: true, is_primary: false },
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

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/3 accounts, 2 income types, 1 active expense item, 1 investment/)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
    expect(screen.queryByText(/Set one account as the primary account so expense movements have a default home\./)).toBeNull()
  })

  it('treats a single-account setup as valid without account-foundation warnings', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Bank', active: true, is_primary: true },
    ])
    client.getIncomeTypes.mockResolvedValue([
      { incomedesc: 'Salary' },
    ])
    client.getExpenseItems.mockResolvedValue([
      { expensedesc: 'Rent', active: true },
    ])
    client.getInvestmentItems.mockResolvedValue([])

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/1 account, 1 income type, 1 active expense item, 0 investments/)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so expense tracking has an account structure in place as that behaviour develops\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
    expect(screen.queryByText(/Set one account as the primary account so expense movements have a default home\./)).toBeNull()
  })

  it('prompts for a primary account when accounts exist but none is selected', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Bank', active: true, is_primary: false },
      { balancedesc: 'Savings', balance_type: 'Savings', active: true, is_primary: false },
    ])
    client.getIncomeTypes.mockResolvedValue([{ incomedesc: 'Salary' }])
    client.getExpenseItems.mockResolvedValue([{ expensedesc: 'Rent', active: true }])
    client.getInvestmentItems.mockResolvedValue([{ investmentdesc: 'ETF Portfolio' }])

    renderWithProviders(<BudgetDetailPage />, {
      route: '/budgets/1/setup',
      path: '/budgets/:budgetId/setup',
    })

    expect(await screen.findByText(/Set one account as the primary account so expense movements have a default home\./)).toBeTruthy()
    expect(screen.queryByText(/Create at least one account first so account-linked income options are ready when you need them\./)).toBeNull()
    expect(screen.queryByText(/Create at least one account first so linked investment accounts are available when needed\./)).toBeNull()
  })
})
