import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import PersonalisationTab from '../pages/tabs/PersonalisationTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  updateBudget: jest.fn(),
}))

const client = require('../api/client')

describe('PersonalisationTab', () => {
  const budget = {
    acceptable_expense_overrun_pct: 10,
    comfortable_surplus_buffer_pct: 5,
    maximum_deficit_amount: null,
    revision_sensitivity: 50,
    savings_priority: 50,
    period_criticality_bias: 50,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    client.updateBudget.mockResolvedValue({ budgetid: 1, ...budget })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('renders budget-backed values and resets back to defaults', async () => {
    const customBudget = {
      ...budget,
      acceptable_expense_overrun_pct: 15,
      comfortable_surplus_buffer_pct: 20,
      maximum_deficit_amount: 75,
    }

    renderWithProviders(<PersonalisationTab budgetId={1} budget={customBudget} />)

    const overrunInput = screen.getByLabelText('When would an expense going over budget start to feel uncomfortable?')
    const deficitInput = screen.getByLabelText('At what point will a budget deficit start raising a budget health concern?')
    const amountInput = screen.getByLabelText('Maximum deficit amount')

    expect(overrunInput.value).toBe('15')
    expect(deficitInput.value).toBe('20')
    expect(amountInput.value).toBe('75')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    expect(overrunInput.value).toBe('10')
    expect(deficitInput.value).toBe('5')
    expect(amountInput.value).toBe('')
  })

  it('autosaves meaningful changes and ignores invalid maximum deficit input', async () => {
    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    const amountInput = screen.getByLabelText('Maximum deficit amount')
    fireEvent.change(amountInput, { target: { value: '12.345' } })
    expect(amountInput.value).toBe('')

    fireEvent.change(amountInput, { target: { value: '12.34' } })

    await act(async () => {
      jest.advanceTimersByTime(450)
    })

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, expect.objectContaining({
        maximum_deficit_amount: '12.34',
      }))
    })
  })

  it('shows the save error message when autosave fails', async () => {
    client.updateBudget.mockRejectedValue({
      response: {
        data: {
          detail: 'Unable to save preferences right now.',
        },
      },
    })

    renderWithProviders(<PersonalisationTab budgetId={1} budget={budget} />)

    fireEvent.change(
      screen.getByLabelText('How quickly should repeated plan changes start to feel like a warning sign?'),
      { target: { value: '8' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(450)
    })

    expect(await screen.findByText('Unable to save preferences right now.')).toBeTruthy()
  })
})
