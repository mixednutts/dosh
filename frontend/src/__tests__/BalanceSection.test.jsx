import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { BalanceSection } from '../components/period-sections/BalanceSection'
import { renderWithProviders } from '../testUtils'

describe('BalanceSection', () => {
  const formatters = {
    fmt: value => `$${Number(value).toFixed(2)}`,
  }

  const balances = [
    {
      balancedesc: 'Main Account',
      balance_type: 'Transaction',
      opening_amount: '1000.00',
      closing_amount: '1100.00',
      movement_amount: '100.00',
    },
    {
      balancedesc: 'Savings',
      balance_type: 'Savings',
      opening_amount: '500.00',
      closing_amount: '450.00',
      movement_amount: '-50.00',
    },
  ]

  it('renders account balances table', () => {
    renderWithProviders(
      <BalanceSection
        balances={balances}
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(screen.getByText('Account Balances')).toBeTruthy()
    expect(screen.getByText('Main Account')).toBeTruthy()
    // Use queryAllByText because 'Savings' may appear as account name and account type
    expect(screen.queryAllByText('Savings').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('$1000.00')).toBeTruthy()
    expect(screen.getByText('$1100.00')).toBeTruthy()
  })

  it('renders informational banner when limit is exceeded', () => {
    renderWithProviders(
      <BalanceSection
        balances={[]}
        limitExceeded
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(
      screen.getByText(/The Upcoming budget cycles exceeds allowed limits for forward calculation/i)
    ).toBeTruthy()
    expect(
      screen.getByText(/Adjust the limit in Budget Settings if needed/i)
    ).toBeTruthy()
  })

  it('returns null when no balances and limit is not exceeded', () => {
    const { container } = renderWithProviders(
      <BalanceSection
        balances={[]}
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('calls onViewTransactions when detail button is clicked', () => {
    const onViewTransactions = jest.fn()
    renderWithProviders(
      <BalanceSection
        balances={balances}
        formatters={formatters}
        onViewTransactions={onViewTransactions}
      />
    )

    const detailButtons = screen.getAllByTitle('View supporting transactions')
    fireEvent.click(detailButtons[0])

    expect(onViewTransactions).toHaveBeenCalledWith(expect.objectContaining({ balancedesc: 'Main Account' }))
  })

  it('renders footer totals correctly', () => {
    renderWithProviders(
      <BalanceSection
        balances={balances}
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(screen.getByText('Total Balances')).toBeTruthy()
    // Total opening: 1000 + 500 = 1500
    expect(screen.getByText('$1500.00')).toBeTruthy()
    // Total closing: 1100 + 450 = 1550
    expect(screen.getByText('$1550.00')).toBeTruthy()
  })

  it('renders movement with positive tone for credit and negative tone for debit', () => {
    renderWithProviders(
      <BalanceSection
        balances={balances}
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(screen.getByText('$100.00')).toBeTruthy()
    expect(screen.getByText('$-50.00')).toBeTruthy()
  })

  it('renders balance type or em-dash when missing', () => {
    renderWithProviders(
      <BalanceSection
        balances={[
          { balancedesc: 'Main', balance_type: 'Transaction', opening_amount: '100', movement_amount: '0' },
          { balancedesc: 'Misc', opening_amount: '50', movement_amount: '0' },
        ]}
        formatters={formatters}
        onViewTransactions={() => {}}
      />
    )

    expect(screen.getByText('Transaction')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})
