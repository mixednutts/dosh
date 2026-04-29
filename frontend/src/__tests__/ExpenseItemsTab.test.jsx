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
  getExpenseItemHistory: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  getBalanceTypes: jest.fn(),
  getBudget: jest.fn(),
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
    client.getExpenseItemHistory.mockResolvedValue({ item_desc: 'Rent', category: 'expense', current_revisionnum: 0, entries: [] })
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Main Account', balance_type: 'Transaction', is_primary: true, active: true },
    ])
    client.getBudget.mockResolvedValue({ allow_overdraft_transactions: false })
  })

  afterEach(() => {
    jest.useRealTimers()
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
          can_deactivate: true,
          deactivation_impact: 'Deactivating this expense will remove it from future generated budget cycles.',
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

  it('allows revision-style edits and shows deactivation warning for in-use expense items', async () => {
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
          can_deactivate: true,
          deactivation_impact: 'Deactivating this expense will remove it from future generated budget cycles. Existing budget cycles, including the current cycle, will keep this expense line.',
          can_edit_structure: true,
        },
      ],
      investment_items: [],
    })
    client.updateExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Rent')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))

    const amountInput = screen.getByLabelText(/Amount/i)
    expect(amountInput.value).toBe('1,200.00')
    fireEvent.focus(amountInput)
    expect(amountInput.value).toBe('1200')
    fireEvent.change(amountInput, { target: { value: '1300' } })

    // Active checkbox should be enabled (not disabled)
    const activeToggle = screen.getByRole('checkbox', { name: /^Active/i })
    expect(activeToggle.disabled).toBe(false)
    
    // Warning should appear when unchecking the active toggle
    expect(screen.queryByText(/Deactivating this expense will remove it from future generated budget cycles/i)).toBeNull()
    fireEvent.click(activeToggle) // uncheck
    expect(screen.getByText(/Deactivating this expense will remove it from future generated budget cycles/i)).toBeTruthy()
    
    // Re-check to keep it active for the save
    fireEvent.click(activeToggle) // check again
    expect(screen.queryByText(/Deactivating this expense will remove it from future generated budget cycles/i)).toBeNull()
    
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateExpenseItem).toHaveBeenCalledWith(1, 'Rent', expect.objectContaining({
        expenseamount: 1300,
        active: true,
        default_account_desc: null,
      }))
    })
  })

  it('allows editing pay type for existing scheduled expense items', async () => {
    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Subscription',
        active: true,
        freqtype: 'Every N Days',
        frequency_value: 14,
        paytype: 'MANUAL',
        effectivedate: '2026-04-01',
        expenseamount: '50.00',
        revisionnum: 1,
        sort_order: 0,
        default_account_desc: null,
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
          expensedesc: 'Subscription',
          in_use: false,
          reasons: [],
          can_delete: true,
          can_deactivate: true,
          deactivation_impact: '',
          can_edit_structure: true,
        },
      ],
      investment_items: [],
    })
    client.updateExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Subscription')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))

    // Pay type should be editable for scheduled expenses
    const payTypeSelect = screen.getByRole('combobox', { name: /^Pay Type$/i })
    expect(payTypeSelect.disabled).toBe(false)
    expect(payTypeSelect.value).toBe('MANUAL')

    fireEvent.change(payTypeSelect, { target: { value: 'AUTO' } })
    expect(payTypeSelect.value).toBe('AUTO')

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateExpenseItem).toHaveBeenCalledWith(1, 'Subscription', expect.objectContaining({
        paytype: 'AUTO',
      }))
    })
  })

  it('shows history details for an expense item', async () => {
    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Rent',
        active: true,
        freqtype: 'Always',
        frequency_value: null,
        paytype: 'MANUAL',
        effectivedate: null,
        expenseamount: '1200.00',
        revisionnum: 2,
        sort_order: 0,
      },
    ])
    client.getExpenseItemHistory.mockResolvedValue({
      item_desc: 'Rent',
      category: 'expense',
      current_revisionnum: 2,
      entries: [
        {
          id: 10,
          entrydate: '2026-04-10T08:00:00',
          history_kind: 'setup_revision',
          entry_kind: 'setup_revision',
          revisionnum: 2,
          change_details: [
            {
              field: 'freqtype',
              label: 'Schedule type',
              before_value: 'Always',
              after_value: 'Every N Days',
            },
          ],
        },
        {
          id: 11,
          finperiodid: 2,
          period_startdate: '2026-04-14T00:00:00',
          period_enddate: '2026-04-27T00:00:00',
          history_kind: 'budget_adjustment',
          revisionnum: 2,
          source: 'expense',
          type: 'BUDGETADJ',
          amount: '100.00',
          note: 'Rent increased mid-cycle.',
          entrydate: '2026-04-09T08:30:00',
          entry_kind: 'budget_adjustment',
          budget_scope: 'current',
          budget_before_amount: '1200.00',
          budget_after_amount: '1300.00',
        },
      ],
    })

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Rent')).toBeTruthy()
    fireEvent.click(screen.getByTitle('View history details'))

    expect(await screen.findByText('History Details — Rent')).toBeTruthy()
    expect(await screen.findByText('Current Setup')).toBeTruthy()
    expect((await screen.findAllByText('Pay Type')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Effective Date')).length).toBeGreaterThan(1)
    expect(await screen.findByText('Setup revision 2')).toBeTruthy()
    expect(await screen.findByText(/Schedule type:/)).toBeTruthy()
    expect(await screen.findByText('Revision 2')).toBeTruthy()
    expect(await screen.findByText('Rent increased mid-cycle.')).toBeTruthy()
    expect(client.getExpenseItemHistory).toHaveBeenCalledWith(1, 'Rent')
  })

  it('creates an every-n-days expense item with an effective date and AUTO pay type by default', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Fuel' },
    })
    fireEvent.change(screen.getByLabelText(/Frequency Type/i), {
      target: { value: 'Every N Days' },
    })
    fireEvent.change(screen.getByLabelText(/Interval \(days\)/i), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '85.50' },
    })
    fireEvent.change(screen.getByLabelText(/Effective Date/i), {
      target: { value: '2026-04-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(client.createExpenseItem).toHaveBeenCalledWith(1, {
        expensedesc: 'Fuel',
        active: true,
        freqtype: 'Every N Days',
        frequency_value: 10,
        paytype: 'AUTO',
        effectivedate: '2026-04-01',
        expenseamount: 85.5,
        default_account_desc: null,
      })
    })
  })

  it('shows fixed-day rollover guidance when day 31 is selected', async () => {
    client.getExpenseItems.mockResolvedValue([])

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))
    fireEvent.change(screen.getByLabelText(/Frequency Type/i), {
      target: { value: 'Fixed Day of Month' },
    })
    fireEvent.change(screen.getByLabelText(/Day of Month \(1-31\)/i), {
      target: { value: '31' },
    })

    expect(screen.getByText(/If a month does not include day 31, Dosh will move this expense to the next day after month end\./)).toBeTruthy()
  })

  it('hides effective date when frequency type is always', async () => {
    client.getExpenseItems.mockResolvedValue([])

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    expect(screen.queryByLabelText(/Effective Date/i)).toBeNull()
  })

  it('shows always-included wording for always expense items', async () => {
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

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Always included')).toBeTruthy()
  })

  it('reveals inactive items and reorders active items', async () => {
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
      {
        expensedesc: 'Gym',
        active: true,
        freqtype: 'Fixed Day of Month',
        frequency_value: 15,
        paytype: 'AUTO',
        effectivedate: '2026-04-15T00:00:00',
        expenseamount: '25.00',
        revisionnum: 0,
        sort_order: 1,
      },
      {
        expensedesc: 'Old Subscription',
        active: false,
        freqtype: 'Always',
        frequency_value: null,
        paytype: 'MANUAL',
        effectivedate: null,
        expenseamount: '12.00',
        revisionnum: 0,
        sort_order: 2,
      },
    ])
    client.reorderExpenseItems.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Rent')).toBeTruthy()
    expect(screen.queryByText('Old Subscription')).toBeNull()

    fireEvent.click(screen.getByLabelText('Show inactive'))
    expect(screen.getByText('Old Subscription')).toBeTruthy()

    fireEvent.click(screen.getAllByTitle('Move down')[0])

    await waitFor(() => {
      expect(client.reorderExpenseItems).toHaveBeenCalledWith(1, [
        { expensedesc: 'Gym', sort_order: 0 },
        { expensedesc: 'Rent', sort_order: 1 },
        { expensedesc: 'Old Subscription', sort_order: 2 },
      ])
    })
  })

  it('shows next due for every-n-days items and deletes an item after confirmation', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(Date.parse('2026-04-10T09:00:00Z'))
    globalThis.confirm = jest.fn(() => true)

    client.getExpenseItems.mockResolvedValue([
      {
        expensedesc: 'Fuel',
        active: true,
        freqtype: 'Every N Days',
        frequency_value: 10,
        paytype: 'MANUAL',
        effectivedate: '2026-04-01T00:00:00',
        expenseamount: '85.50',
        revisionnum: 1,
        sort_order: 0,
      },
    ])
    client.deleteExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    expect(await screen.findByText('Fuel')).toBeTruthy()
    expect(screen.getByText('Every 10d')).toBeTruthy()
    expect(screen.getByText('11 Apr 2026')).toBeTruthy()

    const deleteButton = screen.getAllByRole('button').find(button => button.className.includes('btn-danger'))
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(client.deleteExpenseItem).toHaveBeenCalledWith(1, 'Fuel')
    })
  })

  it('defaults debit account to the primary account and stores null', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Main Account', balance_type: 'Transaction', is_primary: true, active: true },
      { balancedesc: 'Joint Account', balance_type: 'Transaction', is_primary: false, active: true },
    ])
    client.getBudget.mockResolvedValue({ allow_overdraft_transactions: false })

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Groceries' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '200' },
    })

    // Debit Account dropdown should default to the primary account
    const debitSelect = screen.getByRole('combobox', { name: /^Debit Account$/i })
    expect(debitSelect.value).toBe('Main Account')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(client.createExpenseItem).toHaveBeenCalledWith(1, expect.objectContaining({
        expensedesc: 'Groceries',
        expenseamount: 200,
        default_account_desc: null,
      }))
    })
  })

  it('allows selecting a non-primary debit account for an expense item', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Main Account', balance_type: 'Transaction', is_primary: true, active: true },
      { balancedesc: 'Joint Account', balance_type: 'Transaction', is_primary: false, active: true },
    ])
    client.getBudget.mockResolvedValue({ allow_overdraft_transactions: false })

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Groceries' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '200' },
    })

    const debitSelect = screen.getByRole('combobox', { name: /^Debit Account$/i })
    fireEvent.change(debitSelect, { target: { value: 'Joint Account' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(client.createExpenseItem).toHaveBeenCalledWith(1, expect.objectContaining({
        expensedesc: 'Groceries',
        expenseamount: 200,
        default_account_desc: 'Joint Account',
      }))
    })
  })

  it('allows selecting any active account (including non-Transaction) as the debit account', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Main Account', balance_type: 'Transaction', is_primary: true, active: true },
      { balancedesc: 'Savings Account', balance_type: 'Savings', is_primary: false, active: true },
      { balancedesc: 'Cash Wallet', balance_type: 'Cash', is_primary: false, active: true },
    ])
    client.getBudget.mockResolvedValue({ allow_overdraft_transactions: false })

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Groceries' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '150' },
    })

    const debitSelect = screen.getByRole('combobox', { name: /^Debit Account$/i })
    fireEvent.change(debitSelect, { target: { value: 'Savings Account' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(client.createExpenseItem).toHaveBeenCalledWith(1, expect.objectContaining({
        expensedesc: 'Groceries',
        expenseamount: 150,
        default_account_desc: 'Savings Account',
      }))
    })
  })

  it('shows validation error when Fixed Day of Month is selected without a day value', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Utilities' },
    })
    fireEvent.change(screen.getByLabelText(/Frequency Type/i), {
      target: { value: 'Fixed Day of Month' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '120' },
    })

    // Clear the default day value if any
    const dayInput = screen.getByLabelText(/Day of Month/i)
    fireEvent.change(dayInput, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Day of month is required for Fixed Day of Month expenses.')).toBeTruthy()
    })
    expect(client.createExpenseItem).not.toHaveBeenCalled()
  })

  it('shows validation error when Every N Days is selected without interval or effective date', async () => {
    client.getExpenseItems.mockResolvedValue([])
    client.createExpenseItem.mockResolvedValue({})

    renderWithProviders(<ExpenseItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Expense Item'))

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Petrol' },
    })
    fireEvent.change(screen.getByLabelText(/Frequency Type/i), {
      target: { value: 'Every N Days' },
    })
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: '80' },
    })

    const intervalInput = screen.getByLabelText(/Interval \(days\)/i)
    fireEvent.change(intervalInput, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Interval and effective date are required for Every N Days expenses.')).toBeTruthy()
    })
    expect(client.createExpenseItem).not.toHaveBeenCalled()
  })
})
