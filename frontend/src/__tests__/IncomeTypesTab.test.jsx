import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import IncomeTypesTab from '../pages/tabs/IncomeTypesTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getIncomeTypes: jest.fn(),
  createIncomeType: jest.fn(),
  updateIncomeType: jest.fn(),
  deleteIncomeType: jest.fn(),
  getIncomeTypeHistory: jest.fn(),
  getBalanceTypes: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('IncomeTypesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [],
      investment_items: [],
    })
    client.getIncomeTypeHistory.mockResolvedValue({ item_desc: 'Salary', category: 'income', current_revisionnum: 0, entries: [] })
  })

  it('defaults new income sources to auto-include and allows opting out', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Source'))
    expect(await screen.findByRole('heading', { name: 'Add Income Source' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Salary' },
    })
    fireEvent.change(screen.getByLabelText('Default Amount'), {
      target: { value: '2500' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Everyday' },
    })

    const autoIncludeToggle = screen.getByRole('checkbox')
    expect(autoIncludeToggle.checked).toBe(true)
    fireEvent.click(autoIncludeToggle)
    expect(autoIncludeToggle.checked).toBe(false)

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: false,
        amount: 2500,
        linked_account: 'Everyday',
      })
    })
  })

  it('blocks creating an income source without a linked account', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Source'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Casual Work' },
    })
    fireEvent.change(screen.getByLabelText('Default Amount'), {
      target: { value: '300' },
    })
    // Do not select a linked account
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).not.toHaveBeenCalled()
    })
  })

  it('updates an existing income source, including renaming it and changing its linked account', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      },
    ])
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Everyday', balance_type: 'Transaction' },
      { balancedesc: 'Savings', balance_type: 'Savings' },
    ])
    client.updateIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))
    expect(await screen.findByRole('heading', { name: 'Edit Income Source' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Main Salary' },
    })
    fireEvent.change(screen.getByLabelText('Default Amount'), {
      target: { value: '2600' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Savings' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateIncomeType).toHaveBeenCalledWith(1, 'Salary', expect.objectContaining({
        incomedesc: 'Main Salary',
        amount: 2600,
        linked_account: 'Savings',
      }))
    })
  })

  it('disables delete for an income source already in use', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      },
    ])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [
        {
          incomedesc: 'Salary',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_edit_structure: false,
        },
      ],
      expense_items: [],
      investment_items: [],
    })

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    expect(screen.getByText('In Use')).toBeTruthy()
    const deleteButton = screen.getAllByRole('button').find(button => button.className.includes('btn-danger'))
    expect(deleteButton.disabled).toBe(true)
  })

  it('shows linked account options without type labels', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])

    renderWithProviders(
      <IncomeTypesTab
        budgetId={1}
        budget={{ allow_overdraft_transactions: true }}
      />
    )

    fireEvent.click(await screen.findByText('Add Income Source'))
    expect(await screen.findByRole('option', { name: 'Everyday' })).toBeTruthy()
  })

  it('shows history details for an income source using budget adjustment entries', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
        revisionnum: 2,
      },
    ])
    client.getIncomeTypeHistory.mockResolvedValue({
      item_desc: 'Salary',
      category: 'income',
      current_revisionnum: 2,
      entries: [
        {
          id: 9,
          finperiodid: 3,
          period_startdate: '2026-04-28T00:00:00',
          period_enddate: '2026-05-11T00:00:00',
          source: 'income',
          type: 'BUDGETADJ',
          amount: '100.00',
          note: 'Pay rise landed.',
          entrydate: '2026-04-10T09:00:00',
          entry_kind: 'budget_adjustment',
          budget_scope: 'future',
          budget_before_amount: '2500.00',
          budget_after_amount: '2600.00',
        },
      ],
    })

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    fireEvent.click(screen.getByTitle('View history details'))

    expect(await screen.findByText('History Details — Salary')).toBeTruthy()
    expect(await screen.findByText('Pay rise landed.')).toBeTruthy()
    expect(client.getIncomeTypeHistory).toHaveBeenCalledWith(1, 'Salary')
  })
})
