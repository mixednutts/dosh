import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { CloseoutModal } from '../components/modals/CloseoutModal'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getPeriodCloseoutPreview: jest.fn(),
  closeOutPeriod: jest.fn(),
}))

const client = require('../api/client')

describe('CloseoutModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows preview data and disables close-out when next cycle is missing', async () => {
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: { finperiodid: 10, cycle_status: 'ACTIVE' },
      next_period: null,
      carry_forward_amount: '250.00',
      totals: { income_budget: '1000.00', surplus_budget: '250.00' },
      health: { summary: 'Tracking well.', score: 85, status: 'Strong' },
      next_cycle_exists: false,
      can_close_early: true,
    })

    renderWithProviders(<CloseoutModal periodId={10} budgetId={1} onClose={jest.fn()} />)

    expect(await screen.findByText('Tracking well.')).toBeTruthy()
    expect(screen.getByText(/Carry Forward/i)).toBeTruthy()
    // Carry-forward amount appears in the carry-forward banner
    const banner = screen.getByText(/Carry Forward/i).closest('div')
    expect(banner.textContent).toMatch(/\$250\.00/)
    expect(screen.getByText(/Create the next budget cycle automatically during close-out/i)).toBeTruthy()

    const closeButton = screen.getByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(closeButton.disabled).toBe(false)
  })

  it('submits close-out when next cycle exists', async () => {
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: { finperiodid: 11, cycle_status: 'ACTIVE' },
      next_period: { finperiodid: 12 },
      carry_forward_amount: '100.00',
      totals: {},
      health: { summary: 'Okay.', score: 70, status: 'Watch' },
      next_cycle_exists: true,
      can_close_early: true,
    })
    client.closeOutPeriod.mockResolvedValue({})

    renderWithProviders(<CloseoutModal periodId={11} budgetId={1} onClose={jest.fn()} />)

    const closeButton = await screen.findByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(false)

    fireEvent.change(screen.getByLabelText(/Comments \/ Observations/i), {
      target: { value: 'Good month.' },
    })
    fireEvent.change(screen.getByLabelText(/Goals Going Forward/i), {
      target: { value: 'Save more.' },
    })

    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(client.closeOutPeriod).toHaveBeenCalledWith(1, 11, {
        comments: 'Good month.',
        goals: 'Save more.',
        create_next_cycle: false,
      })
    })
  })

  it('shows error message when close-out fails', async () => {
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: { finperiodid: 12, cycle_status: 'ACTIVE' },
      next_period: { finperiodid: 13 },
      carry_forward_amount: '0.00',
      totals: {},
      health: { summary: 'Okay.', score: 60, status: 'Watch' },
      next_cycle_exists: true,
      can_close_early: true,
    })
    client.closeOutPeriod.mockRejectedValue({
      response: { data: { detail: 'Close-out is blocked.' } },
    })

    renderWithProviders(<CloseoutModal periodId={12} budgetId={1} onClose={jest.fn()} />)

    fireEvent.click(await screen.findByText('Close Out Cycle'))

    expect(await screen.findByText('Close-out is blocked.')).toBeTruthy()
  })
})
