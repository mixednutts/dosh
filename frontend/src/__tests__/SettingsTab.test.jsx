import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import SettingsTab from '../pages/tabs/SettingsTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getLocalisationOptions: jest.fn(),
  updateBudget: jest.fn(),
}))

const client = require('../api/client')

describe('SettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.getLocalisationOptions.mockResolvedValue({
      locales: ['en-AU', 'en-US', 'en-GB', 'en-NZ', 'de-DE'],
      currencies: ['AUD', 'USD', 'GBP', 'NZD', 'EUR', 'CAD'],
      timezones: [
        'Australia/Sydney',
        'Australia/Perth',
        'Pacific/Auckland',
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Berlin',
        'UTC',
      ],
      date_formats: ['compact', 'short', 'medium', 'numeric', 'MM-dd-yy', 'MMM-dd-yyyy'],
    })
  })

  it('shows primary investment allocation help and saves the surplus toggle', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: true,
      allow_cycle_lock: true,
      account_naming_preference: 'Transaction',
      locale: 'en-AU',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      date_format: 'medium',
      auto_expense_enabled: false,
      auto_expense_offset_days: 0,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          locale: 'en-AU',
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'medium',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
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
      locale: 'en-AU',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      date_format: 'medium',
      auto_expense_enabled: false,
      auto_expense_offset_days: 0,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          locale: 'en-AU',
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'medium',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
        }}
      />
    )

    fireEvent.click(screen.getByLabelText('Allow manual lock/unlock on budget cycles?'))

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
      locale: 'en-AU',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      date_format: 'medium',
      auto_expense_enabled: false,
      auto_expense_offset_days: 0,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          locale: 'en-AU',
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'medium',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
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

  it('saves locale, currency, timezone, and date format preferences', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: false,
      allow_cycle_lock: true,
      account_naming_preference: 'Transaction',
      locale: 'en-US',
      currency: 'USD',
      timezone: 'America/New_York',
      date_format: 'numeric',
      auto_expense_enabled: false,
      auto_expense_offset_days: 0,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          locale: 'en-AU',
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'medium',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
        }}
      />
    )

    fireEvent.change(screen.getByLabelText('Locale'), { target: { value: 'en-US' } })
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } })
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'America/New_York' } })
    fireEvent.change(screen.getByLabelText('Date Format'), { target: { value: 'numeric' } })
    fireEvent.blur(screen.getByLabelText('Date Format'))

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { locale: 'en-US' })
      expect(client.updateBudget).toHaveBeenCalledWith(1, { currency: 'USD' })
      expect(client.updateBudget).toHaveBeenCalledWith(1, { timezone: 'America/New_York' })
      expect(client.updateBudget).toHaveBeenCalledWith(1, { date_format: 'numeric' })
    })
  })

  it('saves a custom date format preference from the dropdown', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: false,
      allow_cycle_lock: true,
      account_naming_preference: 'Transaction',
      locale: 'en-AU',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      date_format: 'MMM-dd-yyyy',
      auto_expense_enabled: false,
      auto_expense_offset_days: 0,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          locale: 'en-AU',
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'medium',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
        }}
      />
    )

    fireEvent.change(screen.getByLabelText('Date Format'), { target: { value: 'MMM-dd-yyyy' } })

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { date_format: 'MMM-dd-yyyy' })
    })
  })

  it('saves auto expense settings and offset days', async () => {
    client.updateBudget.mockResolvedValue({
      budgetid: 1,
      auto_add_surplus_to_investment: false,
      allow_cycle_lock: true,
      account_naming_preference: 'Transaction',
      locale: 'en-AU',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      date_format: 'medium',
      auto_expense_enabled: true,
      auto_expense_offset_days: 3,
    })

    renderWithProviders(
      <SettingsTab
        budgetId={1}
        budget={{
          budgetid: 1,
          auto_add_surplus_to_investment: false,
          allow_cycle_lock: true,
          account_naming_preference: 'Transaction',
          auto_expense_enabled: false,
          auto_expense_offset_days: 0,
        }}
      />
    )

    fireEvent.click(screen.getByLabelText('Enable Auto Expense?'))

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { auto_expense_enabled: true })
    })

    fireEvent.change(screen.getByLabelText('Offset Days'), {
      target: { value: '3' },
    })

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, { auto_expense_offset_days: 3 })
    })
  })
})
