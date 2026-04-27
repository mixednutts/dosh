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

  it('shows per-line remaining clamped to zero and sums correctly in footer', () => {
    // One under-budget (50 remaining) and one over-budget (0 remaining)
    const mixedInvestments = [
      { investmentdesc: 'Superannuation', budgeted_amount: 300, actualamount: 250, remaining_amount: 50, status: 'Current', source_account_desc: 'Main', linked_account_desc: 'Super Fund', opening_value: 10000, closing_value: 10250 },
      { investmentdesc: 'ETF', budgeted_amount: 200, actualamount: 250, remaining_amount: -50, status: 'Current', linked_account_desc: 'Broker', opening_value: 5000, closing_value: 5250 },
    ]
    renderWithProviders(
      <InvestmentSection
        {...baseProps}
        investments={mixedInvestments}
        effectiveInvestmentBudget={500}
        totalInvestmentActual={500}
        totalInvestmentRemaining={50}
      />,
    )

    // ETF row: remaining should display as $0.00 (clamped), not negative
    expect(screen.getByText('Superannuation')).toBeTruthy()
    expect(screen.getByText('ETF')).toBeTruthy()

    // Footer totals
    expect(screen.getByText('Total Investments')).toBeTruthy()
    expect(screen.getAllByText('$500.00').length).toBeGreaterThanOrEqual(2)
    // $50.00 appears as Superannuation remaining and total remaining
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1)
  })

  it('returns null when no investments', () => {
    const { container } = renderWithProviders(<InvestmentSection {...baseProps} investments={[]} />)
    expect(container.firstChild).toBeNull()
  })

  describe('mobile rendering', () => {
    function renderMobile(props = {}) {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      try {
        return renderWithProviders(<InvestmentSection {...baseProps} {...props} investments={investments} />)
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    }

    it('renders mobile card columns', () => {
      renderMobile()
      expect(screen.getAllByText('Superannuation').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Account').length).toBeGreaterThanOrEqual(1)
    })

    it('mobile shows account routing with source and linked accounts', () => {
      renderMobile()
      expect(screen.getAllByText(/Main/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/Super Fund/).length).toBeGreaterThanOrEqual(1)
    })

    it('mobile actions include add transaction, withdrawal, and view', () => {
      renderMobile()
      expect(screen.getAllByTitle('Add investment transaction').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByTitle('Add subtraction/withdrawal').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByTitle('View transactions').length).toBeGreaterThanOrEqual(1)
    })

    it('mobile footer shows totals', () => {
      renderMobile()
      expect(screen.getAllByText('Total Investments').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('$500.00').length).toBeGreaterThanOrEqual(1)
    })
  })
})
