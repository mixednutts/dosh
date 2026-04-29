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

  it('defaults the first banking account to primary', async () => {
    client.getBalanceTypes.mockResolvedValue([])
    client.createBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Account'))
    expect(await screen.findByRole('heading', { name: 'Add Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Everyday Account' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Banking' },
    })
    fireEvent.change(screen.getByLabelText('Opening Balance'), {
      target: { value: '1250' },
    })

    expect(screen.getByLabelText(/Primary account/i).checked).toBe(true)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createBalanceType).toHaveBeenCalledWith(1, {
        balancedesc: 'Everyday Account',
        balance_type: 'Banking',
        opening_balance: 1250,
        active: true,
        is_primary: true,
        is_savings: false,
      })
    })
  })

  it('warns before switching the primary account during setup edit', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Savings Jar',
        balance_type: 'Banking',
        opening_balance: '250.00',
        active: true,
        is_primary: true,
        is_savings: true,
      },
      {
        balancedesc: 'Holiday Fund',
        balance_type: 'Banking',
        opening_balance: '100.00',
        active: true,
        is_primary: false,
        is_savings: true,
      },
    ])
    client.updateBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click((await screen.findAllByRole('button'))[3])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Holiday Reserve' },
    })
    fireEvent.change(screen.getByLabelText('Opening Balance'), {
      target: { value: '500' },
    })

    fireEvent.click(screen.getByLabelText(/Primary account/i))
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByRole('heading', { name: 'Switch Primary Account?' })).toBeTruthy()
    fireEvent.click(screen.getByText('Switch Primary Account'))

    await waitFor(() => {
      expect(client.updateBalanceType).toHaveBeenCalledWith(1, 'Holiday Fund', {
        balancedesc: 'Holiday Reserve',
        balance_type: 'Banking',
        opening_balance: 500,
        active: true,
        is_primary: true,
        is_savings: true,
      })
    })
  })

  it('shows primary account wording for banking accounts', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
      },
      {
        balancedesc: 'Savings Jar',
        balance_type: 'Banking',
        opening_balance: '250.00',
        active: true,
        is_primary: false,
        is_savings: true,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click((await screen.findAllByRole('button'))[3])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()

    expect(screen.getByLabelText(/Primary account/i)).toBeTruthy()
    expect(screen.getByText(/Expenses are deducted from this account by default/i)).toBeTruthy()
  })

  it('prevents saving when removing the only active primary account', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Main Account')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])

    fireEvent.click(screen.getByLabelText(/Primary account/i))
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
        is_savings: false,
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
        is_savings: false,
      })
    })
  })

  it('deletes an account only after confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Old Savings',
        balance_type: 'Banking',
        opening_balance: '0.00',
        active: false,
        is_primary: false,
        is_savings: true,
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
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
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
    const openingBalanceInput = screen.getByLabelText('Opening Balance')
    expect(openingBalanceInput.disabled).toBe(true)
    expect(screen.getByText(/Opening balance can only be changed before this account is used/i)).toBeTruthy()
  })

  it('disables deleting the active primary account when that would leave no primary', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
      },
      {
        balancedesc: 'Backup Account',
        balance_type: 'Banking',
        opening_balance: '250.00',
        active: true,
        is_primary: false,
        is_savings: false,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Main Account')).toBeTruthy()
    const deleteButtons = screen.getAllByRole('button').filter(button => button.className.includes('btn-danger'))
    expect(deleteButtons[0].disabled).toBe(true)
    expect(deleteButtons[0].title).toContain('Choose another primary account before deleting this one.')
  })

  it('renders banking and cash type options', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Main Account',
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
      },
    ])

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Banking')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Banking' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Cash' })).toBeTruthy()
    expect(screen.getByText(/Primary account/i)).toBeTruthy()
    expect(screen.getByText(/Expenses are deducted from this account by default/i)).toBeTruthy()
  })

  it('includes is_savings in create submission when checked', async () => {
    client.getBalanceTypes.mockResolvedValue([])
    client.createBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Account'))
    expect(await screen.findByRole('heading', { name: 'Add Account' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Everyday Account'), {
      target: { value: 'Holiday Fund' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Banking' },
    })
    fireEvent.change(screen.getByLabelText('Opening Balance'), {
      target: { value: '5000' },
    })
    fireEvent.click(screen.getByLabelText(/Savings account/i))

    expect(screen.getByLabelText(/Savings account/i).checked).toBe(true)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createBalanceType).toHaveBeenCalledWith(1, {
        balancedesc: 'Holiday Fund',
        balance_type: 'Banking',
        opening_balance: 5000,
        active: true,
        is_primary: true,
        is_savings: true,
      })
    })
  })

  it('includes is_savings in update submission when toggled', async () => {
    client.getBalanceTypes.mockResolvedValue([
      {
        balancedesc: 'Everyday Account',
        balance_type: 'Banking',
        opening_balance: '1000.00',
        active: true,
        is_primary: true,
        is_savings: false,
      },
    ])
    client.updateBalanceType.mockResolvedValue({})

    renderWithProviders(<BalanceTypesTab budgetId={1} />)

    expect(await screen.findByText('Everyday Account')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByRole('heading', { name: 'Edit Account' })).toBeTruthy()

    fireEvent.click(screen.getByLabelText(/Savings account/i))
    expect(screen.getByLabelText(/Savings account/i).checked).toBe(true)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateBalanceType).toHaveBeenCalledWith(1, 'Everyday Account', {
        balancedesc: 'Everyday Account',
        balance_type: 'Banking',
        opening_balance: 1000,
        active: true,
        is_primary: true,
        is_savings: true,
      })
    })
  })
})
