import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { InvestmentSection } from '../components/period-sections/InvestmentSection'
import { renderWithProviders } from '../testUtils'

describe('InvestmentSection', () => {
  const formatters = {
    fmt: value => `$${Number(value).toFixed(2)}`,
    fmtPercent: value => `${value}%`,
  }

  const baseProps = {
    locked: false,
    closed: false,
    effectiveInvestmentBudget: 500,
    totalInvestmentActual: 400,
    totalInvestmentRemaining: 100,
    formatters,
    onEditBudget: jest.fn(),
    onMarkPaid: jest.fn(),
    onRevise: jest.fn(),
    onAddTransaction: jest.fn(),
    onAddWithdrawal: jest.fn(),
    onViewTransactions: jest.fn(),
    setInvestmentStatus: { mutate: jest.fn() },
    setInvestmentModal: jest.fn(),
  }

  const investments = [
    { investmentdesc: 'Superannuation', budgeted_amount: 300, actualamount: 250, remaining_amount: 50, status: 'Current', source_account_desc: 'Main', linked_account_desc: 'Super Fund', opening_value: 10000, closing_value: 10250 },
    { investmentdesc: 'ETF', budgeted_amount: 200, actualamount: 150, remaining_amount: 50, status: 'Current', linked_account_desc: 'Broker', opening_value: 5000, closing_value: 5150 },
    { investmentdesc: 'Savings Goal', budgeted_amount: 0, actualamount: 0, remaining_amount: 0, status: 'Paid' },
  ]

  it('renders investment rows with budget, actual, and remaining', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    expect(screen.getByText('Superannuation')).toBeTruthy()
    expect(screen.getByText('ETF')).toBeTruthy()
    expect(screen.getByText('Savings Goal')).toBeTruthy()

    expect(screen.getByText('$300.00')).toBeTruthy()
    expect(screen.getByText('$250.00')).toBeTruthy()
    expect(screen.getByText('$200.00')).toBeTruthy()
  })

  it('shows "Paid" for paid investments instead of remaining', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    const paidCells = screen.getAllByText('Paid')
    expect(paidCells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows remaining with tone for current investments', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    // Superannuation remaining: 50
    const remainingCells = screen.getAllByText('$50.00')
    expect(remainingCells.length).toBeGreaterThanOrEqual(1)
  })

  it('displays account routing with source and linked accounts', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    // Superannuation: Main → Super Fund
    expect(screen.getByText(/Main/)).toBeTruthy()
    expect(screen.getByText(/Super Fund/)).toBeTruthy()
  })

  it('displays linked account only when no source account', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    // ETF has linked_account_desc but no source_account_desc
    expect(screen.getByText(/Broker/)).toBeTruthy()
  })

  it('shows em-dash when no account is linked', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    // Savings Goal has no accounts — should show em-dash
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThanOrEqual(1)
  })

  it('allows budget editing for current but not paid investments', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    // Savings Goal is Paid → no edit; Superannuation and ETF are Current → editable
    expect(screen.getByLabelText('Edit budget for Superannuation')).toBeTruthy()
    expect(screen.getByLabelText('Edit budget for ETF')).toBeTruthy()
    expect(screen.queryByLabelText('Edit budget for Savings Goal')).toBeNull()
  })

  it('calls setInvestmentModal with increase args when add-transaction clicked', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    const addButtons = screen.getAllByTitle('Add investment transaction')
    fireEvent.click(addButtons[0])

    expect(baseProps.setInvestmentModal).toHaveBeenCalledWith(expect.objectContaining({
      investmentdesc: 'Superannuation',
      defaultType: 'increase',
    }))
  })

  it('calls setInvestmentModal with decrease args when withdrawal clicked', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    const withdrawalButtons = screen.getAllByTitle('Add subtraction/withdrawal')
    fireEvent.click(withdrawalButtons[0])

    expect(baseProps.setInvestmentModal).toHaveBeenCalledWith(expect.objectContaining({
      investmentdesc: 'Superannuation',
      defaultType: 'decrease',
    }))
  })

  it('calls setInvestmentModal with readOnly when view transactions clicked', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    const viewButtons = screen.getAllByTitle('View transactions')
    fireEvent.click(viewButtons[0])

    expect(baseProps.setInvestmentModal).toHaveBeenCalledWith(expect.objectContaining({
      investmentdesc: 'Superannuation',
      defaultType: 'increase',
      readOnly: true,
    }))
  })

  it('disables add/withdrawal buttons for paid investments', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    const addButtons = screen.getAllByTitle('Add investment transaction')
    // Savings Goal is Paid → 1 disabled
    const disabledButtons = addButtons.filter(b => b.disabled)
    expect(disabledButtons.length).toBe(1)
  })

  it('disables add/withdrawal buttons when cycle is closed', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} closed />)

    const addButtons = screen.getAllByTitle('Add investment transaction')
    expect(addButtons.every(b => b.disabled)).toBe(true)
  })

  it('renders footer totals correctly', () => {
    renderWithProviders(<InvestmentSection {...baseProps} investments={investments} />)

    expect(screen.getByText('Total Investments')).toBeTruthy()
    expect(screen.getByText('$500.00')).toBeTruthy()
    expect(screen.getByText('$400.00')).toBeTruthy()
    expect(screen.getByText('$100.00')).toBeTruthy()
  })

  it('returns null when no investments', () => {
    const { container } = renderWithProviders(<InvestmentSection {...baseProps} investments={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
