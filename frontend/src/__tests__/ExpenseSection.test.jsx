import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { ExpenseSection } from '../components/period-sections/ExpenseSection'
import { renderWithProviders } from '../testUtils'

describe('ExpenseSection', () => {
  const formatters = {
    fmt: value => `$${Number(value).toFixed(2)}`,
    fmtPercent: value => `${value}%`,
  }

  const baseProps = {
    locked: false,
    closed: false,
    autoExpenseEnabled: true,
    expenseStatusFilter: 'all',
    dragOver: null,
    effectiveExpenseBudget: 1500,
    totalExpenseActual: 1200,
    totalExpenseRemaining: 300,
    formatters,
    onAddExpense: jest.fn(),
    onEditBudget: jest.fn(),
    onMarkPaid: jest.fn(),
    onRevise: jest.fn(),
    onAddTransaction: jest.fn(),
    onAddRefund: jest.fn(),
    onViewTransactions: jest.fn(),
    onDeleteLine: jest.fn(),
    deleteExpenseLine: { mutate: jest.fn() },
    setExpenseStatus: { mutate: jest.fn() },
    updateExpensePayType: { mutate: jest.fn() },
    onStatusFilterChange: jest.fn(),
    onDragStart: jest.fn(),
    onDragOver: jest.fn(),
    onDragLeave: jest.fn(),
    onDrop: jest.fn(),
  }

  const expenses = [
    { expensedesc: 'Groceries', budgetamount: 500, actualamount: 400, remaining_amount: 100, status: 'Current', paytype: 'AUTO', freqtype: 'Every N Days', frequency_value: '7', effectivedate: '2026-04-01' },
    { expensedesc: 'Rent', budgetamount: 1000, actualamount: 1000, remaining_amount: 0, status: 'Paid' },
    { expensedesc: 'Utilities', budgetamount: 0, actualamount: 0, remaining_amount: 0, status: 'Current', paytype: 'MANUAL', freqtype: 'Always' },
    { expensedesc: 'One-off Gift', budgetamount: 200, actualamount: 0, remaining_amount: 200, status: 'Current', is_oneoff: true },
  ]

  it('renders expense rows with descriptions and amounts', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('Rent')).toBeTruthy()
    expect(screen.getByText('Utilities')).toBeTruthy()
    expect(screen.getByText('One-off Gift')).toBeTruthy()
  })

  it('shows "Paid" for paid expenses instead of remaining', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const paidCells = screen.getAllByText('Paid')
    expect(paidCells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows remaining amount with tone for current expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    // Groceries remaining: 100
    expect(screen.getByText('$100.00')).toBeTruthy()
  })

  it('shows schedule badges for scheduled and one-off expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    expect(screen.getByText('One-off')).toBeTruthy()
    expect(screen.getByText(/Recurring/)).toBeTruthy()
  })

  it('shows paytype toggle for scheduled editable expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    // Groceries is scheduled, editable, has AUTO paytype → should show as toggle button
    expect(screen.getByText('AUTO')).toBeTruthy()
    expect(screen.getByText('MANUAL')).toBeTruthy()
  })

  it('calls updateExpensePayType when paytype toggle is clicked', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const autoButton = screen.getByText('AUTO')
    fireEvent.click(autoButton)

    expect(baseProps.updateExpensePayType.mutate).toHaveBeenCalledWith({ desc: 'Groceries', paytype: 'MANUAL' })
  })

  it('shows add-expense button when not locked and not closed', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)
    expect(screen.getByText(/Add New Expense Line Item/)).toBeTruthy()
  })

  it('hides add-expense button when locked or closed', () => {
    const { rerender } = renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} locked />)
    expect(screen.queryByText(/Add New Expense Line Item/)).toBeNull()

    rerender(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} closed />)
    expect(screen.queryByText(/Add New Expense Line Item/)).toBeNull()
  })

  it('allows budget editing for current/revised but not paid expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    // Rent is Paid → no edit; Groceries, Utilities, One-off Gift are Current → editable
    expect(screen.getByLabelText('Edit budget for Groceries')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for Utilities')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for One-off Gift')).toBeTruthy()
    expect(screen.queryByLabelText('Edit budget for Rent')).toBeNull()
  })

  it('shows delete button only for zero-budget zero-actual expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    // Utilities has budget 0 and actual 0 → deleteable
    const deleteButtons = screen.getAllByTitle('Remove from budget cycle (no actuals, zero budget)')
    expect(deleteButtons.length).toBe(1)
  })

  it('calls deleteExpenseLine.mutate when delete is confirmed', () => {
    jest.spyOn(globalThis, 'confirm').mockReturnValue(true)

    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const deleteButton = screen.getByTitle('Remove from budget cycle (no actuals, zero budget)')
    fireEvent.click(deleteButton)

    expect(globalThis.confirm).toHaveBeenCalledWith('Remove "Utilities" from this budget cycle?')
    expect(baseProps.deleteExpenseLine.mutate).toHaveBeenCalledWith('Utilities')

    globalThis.confirm.mockRestore()
  })

  it('disables transaction buttons for paid expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const addTxButtons = screen.getAllByTitle('Add expense transaction')
    // Rent is Paid → 1 disabled button
    const disabledButtons = addTxButtons.filter(b => b.disabled)
    expect(disabledButtons.length).toBe(1)
  })

  it('disables transaction buttons when cycle is closed', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} closed />)

    const addTxButtons = screen.getAllByTitle('Add expense transaction')
    expect(addTxButtons.every(b => b.disabled)).toBe(true)
  })

  it('renders empty state for filtered expenses', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={[]} />)
    expect(screen.getByText('No expense line items match this status.')).toBeTruthy()
  })

  it('renders footer totals correctly', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    expect(screen.getByText('Total Expenses')).toBeTruthy()
    expect(screen.getByText('$1500.00')).toBeTruthy()
    expect(screen.getByText('$1200.00')).toBeTruthy()
    expect(screen.getByText('$300.00')).toBeTruthy()
  })

  it('calls onStatusFilterChange when filter dropdown changes', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const filterSelect = screen.getByLabelText('Status')
    fireEvent.change(filterSelect, { target: { value: 'Paid' } })

    expect(baseProps.onStatusFilterChange).toHaveBeenCalledWith('Paid')
  })

  it('calls drag handlers on table rows', () => {
    renderWithProviders(<ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} />)

    const groceriesCell = screen.getByText('Groceries')
    const row = groceriesCell.closest('tr')

    fireEvent.dragStart(row)
    expect(baseProps.onDragStart).toHaveBeenCalledWith('Groceries')

    fireEvent.dragOver(row)
    expect(baseProps.onDragOver).toHaveBeenCalled()

    fireEvent.dragLeave(row)
    expect(baseProps.onDragLeave).toHaveBeenCalled()

    fireEvent.drop(row)
    expect(baseProps.onDrop).toHaveBeenCalled()
  })

  it('shows drag highlight when dragOver matches row', () => {
    const { container } = renderWithProviders(
      <ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} dragOver="Groceries" />
    )
    expect(container.querySelector('.bg-dosh-50')).toBeTruthy()
  })

  it('disables drag when status filter is not all', () => {
    const { container } = renderWithProviders(
      <ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} expenseStatusFilter="Paid" />
    )
    expect(container.querySelector('.cursor-not-allowed')).toBeTruthy()
  })

  it('disables drag when locked or closed', () => {
    const { container: lockedContainer } = renderWithProviders(
      <ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} locked />
    )
    expect(lockedContainer.querySelector('.cursor-not-allowed')).toBeTruthy()

    const { container: closedContainer } = renderWithProviders(
      <ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} closed />
    )
    expect(closedContainer.querySelector('.cursor-not-allowed')).toBeTruthy()
  })

  it('shows static paytype badge when autoExpenseEnabled is false (mobile)', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      renderWithProviders(
        <ExpenseSection {...baseProps} expenses={expenses} filteredExpenses={expenses} autoExpenseEnabled={false} />
      )
      // Groceries has AUTO paytype but autoExpenseEnabled=false → mobile shows static span
      const autoSpans = screen.getAllByText('AUTO').filter(el => el.tagName === 'SPAN')
      expect(autoSpans.length).toBeGreaterThanOrEqual(1)
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('shows em-dash for paytype when no paytype is set', () => {
    const expensesNoPaytype = [
      { expensedesc: 'Misc', budgetamount: 100, actualamount: 0, remaining_amount: 100, status: 'Current' },
    ]
    renderWithProviders(
      <ExpenseSection {...baseProps} expenses={expensesNoPaytype} filteredExpenses={expensesNoPaytype} />
    )
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  describe('mobile rendering', () => {
    function renderMobile(props = {}) {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      try {
        return renderWithProviders(<ExpenseSection {...baseProps} {...props} expenses={expenses} filteredExpenses={expenses} />)
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    }

    it('renders mobile card columns', () => {
      renderMobile()
      expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Payment Type').length).toBeGreaterThanOrEqual(1)
    })

    it('mobile paytype toggle calls updateExpensePayType', () => {
      renderMobile()
      const autoButtons = screen.getAllByText('AUTO').filter(el => el.tagName === 'BUTTON')
      expect(autoButtons.length).toBeGreaterThanOrEqual(1)
      fireEvent.click(autoButtons[0])
      expect(baseProps.updateExpensePayType.mutate).toHaveBeenCalledWith({ desc: 'Groceries', paytype: 'MANUAL' })
    })

    it('mobile actions include add transaction, refund, view, and delete', () => {
      renderMobile()
      const addTxButtons = screen.getAllByTitle('Add expense transaction')
      expect(addTxButtons.length).toBeGreaterThanOrEqual(1)
      const refundButtons = screen.getAllByTitle('Add refund/credit')
      expect(refundButtons.length).toBeGreaterThanOrEqual(1)
      const viewButtons = screen.getAllByTitle('View transactions')
      expect(viewButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('mobile delete button calls deleteExpenseLine when confirmed', () => {
      jest.spyOn(globalThis, 'confirm').mockReturnValue(true)
      renderMobile()
      const deleteButtons = screen.getAllByTitle('Remove from budget cycle (no actuals, zero budget)')
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
      fireEvent.click(deleteButtons[0])
      expect(baseProps.deleteExpenseLine.mutate).toHaveBeenCalled()
      globalThis.confirm.mockRestore()
    })

    it('mobile footer shows totals', () => {
      renderMobile()
      expect(screen.getAllByText('Total Expenses').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('$1500.00').length).toBeGreaterThanOrEqual(1)
    })
  })
})
