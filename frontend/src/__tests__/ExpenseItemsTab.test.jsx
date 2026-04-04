import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import ExpenseItemsTab from '../pages/tabs/ExpenseItemsTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getExpenseItems: jest.fn(),
  createExpenseItem: jest.fn(),
  updateExpenseItem: jest.fn(),
  deleteExpenseItem: jest.fn(),
  reorderExpenseItems: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('ExpenseItemsTab', () => {
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
  })

  it('disables delete for an expense item already in use', async () => {
    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Rent',
        active: true,
        freqtype: 'Always',
        frequency_value: null,
        paytype: 'MANUAL',
        effectivedate: null,
        expenseamount: '1200.00',
        revisionnum: 1,
        sort_order: 0,
      },
    ])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [
        {
          expensedesc: 'Rent',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_deactivate: false,
          can_edit_structure: true,
        },
      ],
      investment_items: [],
    })

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Rent')).toBeTruthy()
    const deleteButton = screen.getAllByRole('button').find(button => button.className.includes('btn-danger'))
    expect(deleteButton.disabled).toBe(true)
  })

  it('allows revision-style edits while an in-use expense item cannot be deactivated', async () => {
    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Rent',
        active: true,
        freqtype: 'Always',
        frequency_value: null,
        paytype: 'MANUAL',
        effectivedate: null,
        expenseamount: '1200.00',
        revisionnum: 1,
        sort_order: 0,
      },
    ])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [
        {
          expensedesc: 'Rent',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_deactivate: false,
          can_edit_structure: true,
        },
      ],
      investment_items: [],
    })
    client.updateExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Rent')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary')))

    const amountInput = screen.getByDisplayValue('1200.00')
    fireEvent.change(amountInput, { target: { value: '1300' } })

    const activeToggle = screen.getAllByRole('checkbox')[1]
    expect(activeToggle.disabled).toBe(true)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateExpenseItem).toHaveBeenCalledWith(1, 'Rent', expect.objectContaining({
        expenseamount: 1300,
        active: true,
      }))
    })
  })
})
