import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import BalanceTypesTab from '../pages/tabs/BalanceTypesTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getBalanceTypes: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  createBalanceType: jest.fn(),
  updateBalanceType: jest.fn(),
  deleteBalanceType: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('BalanceTypesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
    })
  })

  it('creates a primary account from setup', async () => {
    client.getBalanceTypes.mockResolvedValue([])
    client.createBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Account'))
    expect(await screen.findByRole('heading', { name: 'Add Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Everyday Account' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Bank' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '1250' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[1])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createBalanceType).toHaveBeenCalledWith(1, {
        balancedesc: 'Everyday Account',
        balance_type: 'Bank',
        opening_balance: 1250,
        active: true,
        is_primary: true,
      })
    })
  })

  it('updates an existing account and can promote it to primary', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Savings Jar',
        balance_type: 'Savings',
        opening_balance: '250.00',
        active: true,
        is_primary: false,
      },
    ])
    client.updateBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click((await screen.findAllByRole('button'))[1])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Savings Hub' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '500' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[1])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateBalanceType).toHaveBeenCalledWith(1, 'Savings Jar', {
        balancedesc: 'Savings Hub',
        balance_type: 'Savings',
        opening_balance: 500,
        active: true,
        is_primary: true,
      })
    })
  })

  it('allows an existing account to be deactivated through setup edit', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Travel Cash',
        balance_type: 'Cash',
        opening_balance: '80.00',
        active: true,
        is_primary: false,
      },
    ])
    client.updateBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Travel Cash')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateBalanceType).toHaveBeenCalledWith(1, 'Travel Cash', {
        balancedesc: 'Travel Cash',
        balance_type: 'Cash',
        opening_balance: 80,
        active: false,
        is_primary: false,
      })
    })
  })

  it('deletes an account only after confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Old Savings',
        balance_type: 'Savings',
        opening_balance: '0.00',
        active: false,
        is_primary: false,
      },
    ])
    client.deleteBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Old Savings')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[2])

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete "Old Savings"?')
      expect(client.deleteBalanceType).toHaveBeenCalledWith(1, 'Old Savings')
    })

    confirmSpy.mockRestore()
  })

  it('disables delete for an account already in use', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Bank',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
      },
    ])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [
        {
          balancedesc: 'Main Account',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_deactivate: false,
          can_edit_structure: false,
        },
      ],
    })

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Main Account')).toBeTruthy()
    expect(screen.getByText('In Use')).toBeTruthy()
    const deleteButton = screen.getAllByRole('button')[2]
    expect(deleteButton.disabled).toBe(true)
  })
})
