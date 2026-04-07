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

  it('defaults the first transaction account to primary', async () => {
    client.getBalanceTypes.mockResolvedValue([])
    client.createBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Account'))
    expect(await screen.findByRole('heading', { name: 'Add Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Everyday Account' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Transaction' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '1250' },
    })

    expect(screen.getByLabelText(/Primary transaction account/i).checked).toBe(true)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createBalanceType).toHaveBeenCalledWith(1, {
        balancedesc: 'Everyday Account',
        balance_type: 'Transaction',
        opening_balance: 1250,
        active: true,
        is_primary: true,
      })
    })
  })

  it('warns before switching the primary account during setup edit', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Transaction',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
      },
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

    fireEvent.click((await screen.findAllByRole('button'))[3])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Savings Hub' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '500' },
    })

    fireEvent.click(screen.getByLabelText(/Primary transaction account/i))
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByRole('heading', { name: 'Switch Primary Account?' })).toBeTruthy()
    fireEvent.click(screen.getByText('Switch Primary Account'))

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

  it('prevents saving when removing the only active primary account', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Transaction',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Main Account')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])

    fireEvent.click(screen.getByLabelText(/Primary transaction account/i))
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByRole('heading', { name: 'Primary Account Required' })).toBeTruthy()
    expect(client.updateBalanceType).not.toHaveBeenCalled()
  })

  it('allows an existing non-primary account to be deactivated through setup edit', async () => {
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

    fireEvent.click(screen.getByLabelText(/Active/i))
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

  it('disables delete and opening balance edits for an account already in use', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Transaction',
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

    fireEvent.click(screen.getAllByRole('button')[1])
    const openingBalanceInput = screen.getByLabelText('Opening Balance ($)')
    expect(openingBalanceInput.disabled).toBe(true)
    expect(screen.getByText(/Opening balance can only be changed before this account is used/i)).toBeTruthy()
  })

  it('disables deleting the active primary transaction account when that would leave no primary', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Transaction',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
      },
      {
        balancedesc: 'Backup Account',
        balance_type: 'Transaction',
        opening_balance: '250.00',
        active: true,
        is_primary: false,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Main Account')).toBeTruthy()
    const deleteButtons = screen.getAllByRole('button').filter(button => button.className.includes('btn-danger'))
    expect(deleteButtons[0].disabled).toBe(true)
    expect(deleteButtons[0].title).toContain('Choose another primary account before deleting this one.')
  })

  it('uses the preferred transaction naming in the account type UI', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Transaction',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
      },
    ])

    renderWithProviders(
      <BalanceTypesTab
        budgetId={1}
        budget={{ account_naming_preference: 'Checking' }}
      />
    )

    expect(await screen.findByText('Checking')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Checking' })).toBeTruthy()
    expect(screen.getByText(/Primary checking account/i)).toBeTruthy()
    expect(screen.getByText(/Expenses are deducted from this account by default/i)).toBeTruthy()
  })
})
