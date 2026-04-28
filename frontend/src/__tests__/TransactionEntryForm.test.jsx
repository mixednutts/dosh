import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TransactionEntryForm } from '../components/transaction/TransactionEntryForm'

const defaultProps = {
  kind: 'expense',
  locked: false,
  amount: '',
  setAmount: jest.fn(),
  note: '',
  setNote: jest.fn(),
  entrydate: "2026-04-28T15:00:00",
  setEntrydate: jest.fn(),
  error: '',
  setError: jest.fn(),
  setResolvedAmount: jest.fn(),
  budgetAmount: 1000,
  type: 'debit',
  setType: jest.fn(),
  typeOptions: [
    { value: 'debit', label: 'Expense (+)', activeClassName: 'bg-red-600' },
    { value: 'credit', label: 'Refund (−)', activeClassName: 'bg-dosh-600' },
  ],
  onSubmit: jest.fn(),
  submitLabel: (t) => `Add ${t === 'debit' ? 'Expense' : 'Refund'}`,
  isPending: false,
  onClose: jest.fn(),
  actualAmount: 0,
  periodStartDate: '2026-04-01T00:00:00',
  periodEndDate: '2026-04-30T00:00:00',
}

function renderForm(props = {}) {
  return render(<TransactionEntryForm {...defaultProps} {...props} />)
}

describe('TransactionEntryForm date validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows error and blocks submit when date is empty', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: '' } })
    fireEvent.blur(dateInput)

    expect(defaultProps.setError).toHaveBeenCalledWith('Enter a transaction date')
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('shows error and blocks submit when date format is unparseable', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: 'not a date' } })
    fireEvent.blur(dateInput)

    expect(defaultProps.setError).toHaveBeenCalledWith(
      'Invalid date. Try: 28 Apr 2026, 3:29 PM or 2026-04-28 15:29'
    )
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('shows error and blocks submit when date is before the period start', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: '28 Mar 2026, 3:00 PM' } })
    fireEvent.blur(dateInput)

    expect(defaultProps.setError).toHaveBeenCalledWith(
      'Transaction date must be between 01 Apr 2026 and 30 Apr 2026'
    )
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('shows error and blocks submit when date is after the period end', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: '28 May 2026, 3:00 PM' } })
    fireEvent.blur(dateInput)

    expect(defaultProps.setError).toHaveBeenCalledWith(
      'Transaction date must be between 01 Apr 2026 and 30 Apr 2026'
    )
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('accepts a valid date within the period and submits with overrideEntrydate', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: '15 Apr 2026, 3:00 PM' } })

    fireEvent.submit(container.querySelector('form'))

    expect(defaultProps.setError).toHaveBeenCalledWith('')
    expect(defaultProps.setEntrydate).toHaveBeenCalledWith("2026-04-15T15:00:00")
    expect(defaultProps.onSubmit).toHaveBeenCalled()
    // The second argument to onSubmit should be the ISO override
    const submitCall = defaultProps.onSubmit.mock.calls[0]
    expect(submitCall[1]).toBe("2026-04-15T15:00:00")
  })

  it('blocks submit via form when date is invalid without requiring blur first', () => {
    const { container } = renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')
    fireEvent.change(dateInput, { target: { value: 'bad date' } })

    fireEvent.submit(container.querySelector('form'))

    expect(defaultProps.setError).toHaveBeenCalledWith(
      'Invalid date. Try: 28 Apr 2026, 3:29 PM or 2026-04-28 15:29'
    )
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('sets native input validity on invalid blur', () => {
    renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')

    fireEvent.change(dateInput, { target: { value: '' } })
    fireEvent.blur(dateInput)

    expect(dateInput.validationMessage).toBe('Enter a transaction date')
  })

  it('clears native input validity when user starts typing again', () => {
    renderForm()
    const dateInput = screen.getByPlaceholderText('28 Apr 2026, 3:29 PM')

    fireEvent.change(dateInput, { target: { value: '' } })
    fireEvent.blur(dateInput)
    expect(dateInput.validationMessage).toBe('Enter a transaction date')

    fireEvent.change(dateInput, { target: { value: '15 Apr 2026, 3:00 PM' } })
    expect(dateInput.validationMessage).toBe('')
  })
})
