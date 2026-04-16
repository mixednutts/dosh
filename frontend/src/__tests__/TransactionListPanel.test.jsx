import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TransactionListPanel } from '../components/transaction/TransactionListPanel'

const defaultFormatters = {
  fmtDateTime: (value, mode) => `formatted:${value}:${mode}`,
  fmt: value => `$${value}`,
}

const defaultProps = {
  items: [],
  isLoading: false,
  locked: false,
  headerLabel: 'Transactions',
  emptyLabel: 'No transactions yet.',
  getItemAmount: item => item.amount,
  getAmountClassName: () => 'text-gray-900',
  getBadgeClassName: () => 'bg-blue-100 text-blue-700',
  getBadgeLabel: () => 'TX',
  getPrimaryText: item => `Amount: ${item.amount}`,
  onDelete: jest.fn(),
  formatters: defaultFormatters,
}

function renderPanel(props = {}) {
  return render(<TransactionListPanel {...defaultProps} {...props} />)
}

describe('TransactionListPanel', () => {
  it('shows loading spinner', () => {
    renderPanel({ isLoading: true })
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('shows empty message when there are no items', () => {
    renderPanel()
    expect(screen.getByText('No transactions yet.')).toBeTruthy()
  })

  it('renders item with related and affected account descriptions', () => {
    renderPanel({
      items: [
        { id: 1, amount: 100, note: 'Groceries', related_account_desc: 'Checking', affected_account_desc: 'Savings', entrydate: '2026-01-01T00:00:00' },
      ],
    })
    expect(screen.getByText('From Checking → To Savings')).toBeTruthy()
    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('formatted:2026-01-01T00:00:00:medium')).toBeTruthy()
  })

  it('renders item with only related account description', () => {
    renderPanel({
      items: [
        { id: 1, amount: 50, note: '', related_account_desc: 'Main', affected_account_desc: null, entrydate: '2026-01-02T00:00:00' },
      ],
    })
    expect(screen.getByText('From Main')).toBeTruthy()
  })

  it('hides delete button when locked', () => {
    renderPanel({
      locked: true,
      items: [{ id: 1, amount: 10, entrydate: '2026-01-01T00:00:00', entry_kind: 'manual' }],
    })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('hides delete button for budget_adjustment and status_change entries', () => {
    renderPanel({
      items: [
        { id: 1, amount: 10, entrydate: '2026-01-01T00:00:00', entry_kind: 'budget_adjustment' },
        { id: 2, amount: 20, entrydate: '2026-01-01T00:00:00', entry_kind: 'status_change' },
      ],
    })
    expect(screen.queryAllByRole('button').length).toBe(0)
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = jest.fn()
    renderPanel({
      items: [{ id: 7, amount: 99, entrydate: '2026-01-01T00:00:00', entry_kind: 'manual' }],
      onDelete,
    })
    fireEvent.click(screen.getByRole('button'))
    expect(onDelete).toHaveBeenCalledWith(7)
  })

  it('shows total row when totalValue is provided', () => {
    renderPanel({
      items: [{ id: 1, amount: 30, entrydate: '2026-01-01T00:00:00', entry_kind: 'manual' }],
      totalValue: 30,
      totalClassName: 'text-green-600',
    })
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('$30')).toBeTruthy()
  })

  it('omits total row when items are empty even if totalValue is provided', () => {
    renderPanel({ totalValue: 0, items: [] })
    expect(screen.queryByText('Total')).toBeNull()
  })
})
