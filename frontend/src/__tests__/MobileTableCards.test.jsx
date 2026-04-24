import React from 'react'
import { screen, within } from '@testing-library/react'
import MobileTableCards from '../components/MobileTableCards'
import { renderWithProviders } from '../testUtils'

describe('MobileTableCards', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'amount', label: 'Amount', render: v => `$${v}` },
    { key: 'status', label: 'Status' },
  ]

  const rows = [
    { name: 'Item A', amount: 100, status: 'Active' },
    { name: 'Item B', amount: 200, status: 'Pending' },
  ]

  function renderCards(props = {}) {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      return renderWithProviders(
        <MobileTableCards
          columns={columns}
          rows={rows}
          keyExtractor={row => row.name}
          {...props}
        />
      )
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  }

  it('renders all rows as cards with columns', () => {
    renderCards()

    expect(screen.getByText('Item A')).toBeTruthy()
    expect(screen.getByText('Item B')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()
    expect(screen.getByText('$200')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('renders empty message when no rows', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      renderWithProviders(
        <MobileTableCards
          columns={columns}
          rows={[]}
          keyExtractor={row => row.name}
          emptyMessage="Nothing here"
        />
      )
    } finally {
      process.env.NODE_ENV = originalEnv
    }

    expect(screen.getByText('Nothing here')).toBeTruthy()
  })

  it('renders status slot when provided', () => {
    renderCards({
      status: row => <span data-testid={`status-${row.name}`}>{row.status}</span>,
    })

    expect(screen.getByTestId('status-Item A')).toBeTruthy()
    expect(screen.getByTestId('status-Item B')).toBeTruthy()
  })

  it('renders actions slot when provided', () => {
    renderCards({
      actions: row => <button data-testid={`action-${row.name}`}>Edit</button>,
    })

    expect(screen.getByTestId('action-Item A')).toBeTruthy()
    expect(screen.getByTestId('action-Item B')).toBeTruthy()
  })

  it('renders footer when provided', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      renderWithProviders(
        <MobileTableCards
          columns={columns}
          rows={rows}
          keyExtractor={row => row.name}
          footer={<div data-testid="footer">Total: 2 items</div>}
        />
      )
    } finally {
      process.env.NODE_ENV = originalEnv
    }

    expect(screen.getByTestId('footer')).toBeTruthy()
  })

  it('skips rendering in test environment by default', () => {
    const { container } = renderWithProviders(
      <MobileTableCards
        columns={columns}
        rows={rows}
        keyExtractor={row => row.name}
      />
    )

    expect(container.firstChild).toBeNull()
  })
})
