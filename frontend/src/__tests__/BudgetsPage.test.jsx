import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import BudgetsPage from '../pages/BudgetsPage'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getBudgets: jest.fn(),
  createBudget: jest.fn(),
  createDemoBudget: jest.fn(),
  deleteBudget: jest.fn(),
  getPeriodsForBudget: jest.fn(),
  getBudgetHealth: jest.fn(),
  getPeriodDetail: jest.fn(),
}))

const client = require('../api/client')

describe('BudgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.__DEV_MODE__ = false
    client.getBudgets.mockResolvedValue([])
    client.createBudget.mockResolvedValue({
      budgetid: 21,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.createDemoBudget.mockResolvedValue({
      budgetid: 88,
      budgetowner: 'Dosh Demo',
      description: 'Demo Household Budget',
      budget_frequency: 'Monthly',
    })
  })

  it('hides the demo budget action when dev mode is disabled', async () => {
    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    expect(screen.queryByRole('button', { name: 'Create Demo Budget' })).toBeNull()
  })

  it('shows and runs the demo budget action when dev mode is enabled', async () => {
    global.__DEV_MODE__ = true

    renderWithProviders(<BudgetsPage />, {
      route: '/budgets',
      path: '/budgets',
    })

    fireEvent.click(await screen.findByText('Create Budget'))

    const demoButton = screen.getByRole('button', { name: 'Create Demo Budget' })
    fireEvent.click(demoButton)

    await waitFor(() => {
      expect(client.createDemoBudget).toHaveBeenCalledTimes(1)
    })
  })
})
