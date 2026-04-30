import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AddIncomeLineModal } from '../components/period-lines/AddIncomeLineModal'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getIncomeTypes: jest.fn(),
  getBalanceTypes: jest.fn(),
  createIncomeType: jest.fn(),
  addIncomeToPeriod: jest.fn(),
  accountTransfer: jest.fn(),
}))

jest.mock('../components/AmountExpressionInput', () => ({
  __esModule: true,
  default: function AmountExpressionInput({ id, value, onChange, onResolvedChange, min, className }) {
    return (
      <input
        id={id}
        className={className}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          const num = Number(e.target.value)
          onResolvedChange(Number.isNaN(num) ? null : num, Number.isNaN(num) ? 'invalid' : 'valid')
        }}
        data-testid="amount-input"
      />
    )
  },
}))

const client = require('../api/client')

describe('AddIncomeLineModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.getIncomeTypes.mockResolvedValue([
      { incomedesc: 'Salary', amount: 2000 },
      { incomedesc: 'Bonus', amount: 500 },
    ])
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Main', balance_type: 'Transaction', is_primary: true, active: true },
      { balancedesc: 'Savings', balance_type: 'Savings', is_primary: false, active: true },
    ])
  })

  it('creates a new income type and adds it to the period', async () => {
    client.createIncomeType.mockResolvedValue({})
    client.addIncomeToPeriod.mockResolvedValue({})

    renderWithProviders(
      <AddIncomeLineModal periodId={5} budgetId={1} existingDescs={[]} onClose={jest.fn()} />
    )

    fireEvent.click(await screen.findByText('New income'))
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Side Gig' } })
    await screen.findByRole('option', { name: 'Main' })
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Main' } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, expect.objectContaining({ incomedesc: 'Side Gig', amount: 300, linked_account: 'Main' }))
    })
  })

  it('records an account transfer when transfer mode is selected', async () => {
    client.accountTransfer.mockResolvedValue({})

    renderWithProviders(
      <AddIncomeLineModal periodId={5} budgetId={1} existingDescs={[]} onClose={jest.fn()} />
    )

    fireEvent.click(await screen.findByText('Transfer from Account'))

    const selects = await screen.findAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    fireEvent.change(selects[0], { target: { value: 'Main' } })
    fireEvent.change(selects[1], { target: { value: 'Savings' } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(client.accountTransfer).toHaveBeenCalledWith(1, 5, {
        budgetid: 1,
        source_account: 'Main',
        destination_account: 'Savings',
        amount: 200,
      })
    })
  })

  it('shows a message when all possible transfers already exist', async () => {
    renderWithProviders(
      <AddIncomeLineModal periodId={5} budgetId={1} existingDescs={['Transfer: Main to Savings', 'Transfer: Savings to Main']} onClose={jest.fn()} />
    )

    fireEvent.click(await screen.findByText('Transfer from Account'))
    expect(await screen.findByText(/All possible account transfers already exist/i)).toBeTruthy()
    const addButton = screen.getByText('Add')
    expect(addButton.disabled).toBe(true)
  })
})
