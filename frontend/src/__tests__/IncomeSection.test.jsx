import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { IncomeSection } from '../components/period-sections/IncomeSection'
import { renderWithProviders } from '../testUtils'

describe('IncomeSection', () => {
  const formatters = {
    fmt: value => `$${Number(value).toFixed(2)}`,
    fmtPercent: value => `${value}%`,
  }

  const baseProps = {
    locked: false,
    closed: false,
    totalIncomeBudget: 3000,
    totalIncomeActual: 3200,
    formatters,
    onAddIncome: jest.fn(),
    onEditBudget: jest.fn(),
    onMarkPaid: jest.fn(),
    onRevise: jest.fn(),
    onAddTransaction: jest.fn(),
    onAddCorrection: jest.fn(),
    onViewTransactions: jest.fn(),
    onDeleteLine: jest.fn(),
    deleteIncomeLine: { mutate: jest.fn() },
    setIncomeStatus: { mutate: jest.fn() },
  }

  const standardIncomes = [
    { incomedesc: 'Salary', budgetamount: 2000, actualamount: 2100, status: 'Current', linked_account: 'Main' },
    { incomedesc: 'Bonus', budgetamount: 1000, actualamount: 1100, status: 'Paid' },
    { incomedesc: 'Transfer: Savings to Main', budgetamount: 0, actualamount: 0, status: 'Current' },
    { incomedesc: 'Carried Forward', budgetamount: 500, actualamount: 0, status: 'Current', system_key: 'carry_forward' },
  ]

  it('renders income rows with descriptions, amounts, and accounts', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    expect(screen.getByText('Salary')).toBeTruthy()
    expect(screen.getByText('Bonus')).toBeTruthy()
    expect(screen.getByText('Transfer from Savings')).toBeTruthy()
    expect(screen.getByText('Carried Forward')).toBeTruthy()
    expect(screen.getByText('System')).toBeTruthy()

    // Account routing — "Main" appears as linked_account for Salary and as transfer destination
    expect(screen.getAllByText('Main').length).toBeGreaterThanOrEqual(2)
  })

  it('shows "Paid" for paid income instead of remaining amount', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    const paidCells = screen.getAllByText('Paid')
    expect(paidCells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows remaining amount for current income', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    // Salary: actual 2100 - budget 2000 = 100 remaining
    expect(screen.getByText('$100.00')).toBeTruthy()
  })

  it('allows budget editing for non-system-key income but not for carry_forward', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    // BudgetAmountCell renders an edit button when canEdit=true
    // Income editability only checks locked/closed/system_key, not Paid status
    expect(screen.getByLabelText('Edit budget for Salary')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for Bonus')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for Transfer: Savings to Main')).toBeTruthy()
    expect(screen.queryByLabelText('Edit budget for Carried Forward')).toBeNull()
  })

  it('hides add-income button when locked or closed', () => {
    const { rerender } = renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} locked />)
    expect(screen.queryByText(/Add New Income Line Item/)).toBeNull()

    rerender(<IncomeSection {...baseProps} incomes={standardIncomes} closed />)
    expect(screen.queryByText(/Add New Income Line Item/)).toBeNull()
  })

  it('shows add-income button when not locked and not closed', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)
    expect(screen.getByText(/Add New Income Line Item/)).toBeTruthy()
  })

  it('renders empty state when no incomes', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={[]} />)
    expect(screen.getByText('No income entries')).toBeTruthy()
  })

  it('calls onEditBudget when edit button is clicked', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    fireEvent.click(screen.getByLabelText('Edit budget for Salary'))

    expect(baseProps.onEditBudget).toHaveBeenCalledWith(expect.objectContaining({ incomedesc: 'Salary' }))
  })

  it('calls onViewTransactions when view button is clicked', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    const viewButtons = screen.getAllByTitle('View transactions')
    fireEvent.click(viewButtons[0])

    expect(baseProps.onViewTransactions).toHaveBeenCalledWith(expect.objectContaining({ incomedesc: 'Salary' }))
  })

  it('calls deleteIncomeLine.mutate when delete is confirmed', () => {
    jest.spyOn(globalThis, 'confirm').mockReturnValue(true)

    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    // Delete button is only shown for non-locked, non-closed, non-carry_forward, non-paid rows
    const deleteButtons = screen.getAllByTitle('Remove from budget cycle')
    fireEvent.click(deleteButtons[0])

    expect(globalThis.confirm).toHaveBeenCalledWith('Remove "Salary" from this budget cycle?')
    expect(baseProps.deleteIncomeLine.mutate).toHaveBeenCalledWith('Salary')

    globalThis.confirm.mockRestore()
  })

  it('does not show delete button for carry_forward or paid income', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    // Only Salary and Transfer have delete buttons (not Bonus which is Paid, not Carried Forward)
    const deleteButtons = screen.queryAllByTitle('Remove from budget cycle')
    expect(deleteButtons.length).toBe(2)
  })

  it('does not show delete button when locked or closed', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} locked />)

    const deleteButtons = screen.queryAllByTitle('Remove from budget cycle')
    expect(deleteButtons.length).toBe(0)
  })

  it('renders footer totals correctly', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    expect(screen.getByText('Total Income')).toBeTruthy()
    expect(screen.getByText('$3000.00')).toBeTruthy()
    expect(screen.getByText('$3200.00')).toBeTruthy()
    expect(screen.getByText('$200.00')).toBeTruthy()
  })

  it('disables transaction buttons for paid income', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} />)

    // All "Add income transaction" buttons; the one for Bonus (Paid) should be disabled
    const addTxButtons = screen.getAllByTitle('Add income transaction')
    // 4 income rows total, Bonus is paid → 3 enabled, 1 disabled
    const disabledButtons = addTxButtons.filter(b => b.disabled)
    expect(disabledButtons.length).toBe(1)
  })

  it('disables transaction buttons when cycle is closed', () => {
    renderWithProviders(<IncomeSection {...baseProps} incomes={standardIncomes} closed />)

    const addTxButtons = screen.getAllByTitle('Add income transaction')
    expect(addTxButtons.every(b => b.disabled)).toBe(true)
  })
})
