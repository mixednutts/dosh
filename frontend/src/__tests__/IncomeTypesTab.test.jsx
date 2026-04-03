import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import IncomeTypesTab from '../pages/tabs/IncomeTypesTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getIncomeTypes: jest.fn(),
  createIncomeType: jest.fn(),
  updateIncomeType: jest.fn(),
  deleteIncomeType: jest.fn(),
  getBalanceTypes: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('IncomeTypesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('auto-sets auto-include when a fixed income type is created', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Bank' }])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Type'))
    expect(await screen.findByRole('heading', { name: 'Add Income Type' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Salary' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2500' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Everyday' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])

    expect(toggles[1].checked).toBe(true)
    expect(screen.getByText('(auto-set when fixed)')).toBeTruthy()

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      })
    })
  })

  it('still allows an income type to be created when no linked account exists', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Type'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Casual Work' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '300' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Casual Work',
        issavings: false,
        isfixed: false,
        autoinclude: false,
        amount: 300,
        linked_account: null,
      })
    })
  })

  it('updates an existing income type and can remove its linked account', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      },
    ])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Bank' }])
    client.updateIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByRole('heading', { name: 'Edit Income Type' })).toBeTruthy()

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2600' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateIncomeType).toHaveBeenCalledWith(1, 'Salary', {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2600,
        linked_account: null,
      })
    })
  })
})
