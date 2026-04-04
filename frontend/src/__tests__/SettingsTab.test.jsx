import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import SettingsTab from '../pages/tabs/SettingsTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  updateBudget: jest.fn(),
}))

const client = require('../api/client')

describe('SettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows primary investment allocation help and saves the surplus toggle', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: true,
      allow_cycle_lock: true,
      account_naming_preference: 'Transaction',
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
        }}
      />
    )

    fireEvent.click(screen.getByLabelText('More information about primary investment allocation'))
    expect(await screen.findByText('Will only assign to the primary investment line.')).toBeTruthy()
    expect(screen.getByText(/Set one active investment line as primary to control where this automatic allocation goes\./)).toBeTruthy()

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { auto_add_surplus_to_investment: true })
    })
  })

  it('saves the manual cycle lock setting toggle', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: false,
      allow_cycle_lock: false,
      account_naming_preference: 'Transaction',
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
        }}
      />
    )

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[1])

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { allow_cycle_lock: false })
    })
  })

  it('saves the preferred primary account naming setting', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: false,
      allow_cycle_lock: true,
      account_naming_preference: 'Checking',
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
        }}
      />
    )

    fireEvent.change(screen.getByLabelText('Preferred Primary Account Naming'), {
      target: { value: 'Checking' },
    })

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { account_naming_preference: 'Checking' })
    })
  })
})
