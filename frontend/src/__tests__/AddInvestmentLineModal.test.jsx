import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { AddInvestmentLineModal } from '../components/period-lines/AddInvestmentLineModal'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getInvestmentItems: jest.fn(),
  addInvestmentToPeriod: jest.fn(),
}))

const client = require('../api/client')

describe('AddInvestmentLineModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders available investment items and submits', async () => {
    client.getInvestmentItems.mockResolvedValue([
      { investmentdesc: 'Emergency Fund', planned_amount: 100 },
      { investmentdesc: 'Holiday Fund', planned_amount: 200 },
    ])
    client.addInvestmentToPeriod.mockResolvedValue({})

    const onClose = jest.fn()
    renderWithProviders(
      <AddInvestmentLineModal
        periodId={1}
        budgetId={1}
        existingDescs={['Emergency Fund']}
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Holiday Fund')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Investment Item'), {
      target: { value: 'Holiday Fund' },
    })

    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(client.addInvestmentToPeriod).toHaveBeenCalledWith(1, 1, {
        budgetid: 1,
        investmentdesc: 'Holiday Fund',
        budgeted_amount: 200,
        scope: 'oneoff',
        note: null,
      })
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty message when all investments already in period', async () => {
    client.getInvestmentItems.mockResolvedValue([
      { investmentdesc: 'Emergency Fund', planned_amount: 100 },
    ])

    renderWithProviders(
      <AddInvestmentLineModal
        periodId={1}
        budgetId={1}
        existingDescs={['Emergency Fund']}
        onClose={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/All investments already in this budget cycle/i)).toBeTruthy()
    })

    expect(screen.getByText('Add').hasAttribute('disabled')).toBe(true)
  })

  it('shows error when api call fails', async () => {
    client.getInvestmentItems.mockResolvedValue([
      { investmentdesc: 'Holiday Fund', planned_amount: 100 },
    ])
    client.addInvestmentToPeriod.mockRejectedValue({
      response: { data: { detail: 'Investment not found' } },
    })

    renderWithProviders(
      <AddInvestmentLineModal
        periodId={1}
        budgetId={1}
        existingDescs={[]}
        onClose={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Holiday Fund')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Investment Item'), {
      target: { value: 'Holiday Fund' },
    })

    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(screen.getByText('Investment not found')).toBeTruthy()
    })
  })

  it('calls onClose when cancel is clicked', async () => {
    client.getInvestmentItems.mockResolvedValue([])
    const onClose = jest.fn()

    renderWithProviders(
      <AddInvestmentLineModal
        periodId={1}
        budgetId={1}
        existingDescs={[]}
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
