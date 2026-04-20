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
    // Carry-forward checkbox shown because surplus > 0
    expect(screen.getByLabelText(/Carry this amount forward/i)).toBeTruthy()
    expect(screen.getByText(/Create the next budget cycle automatically during close-out/i)).toBeTruthy()

    const closeButton = screen.getByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(true)

    // Check both required checkboxes
    fireEvent.click(screen.getByLabelText(/Carry this amount forward/i))
    fireEvent.click(screen.getByLabelText(/Create the next budget cycle automatically during close-out/i))
    expect(closeButton.disabled).toBe(false)
  })

  it('hides carry-forward checkbox when surplus is zero or negative', async () => {
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: { finperiodid: 10, cycle_status: 'ACTIVE' },
      next_period: null,
      carry_forward_amount: '0.00',
      totals: { income_budget: '1000.00', surplus_budget: '0.00' },
      health: { summary: 'Tracking well.', score: 85, status: 'Strong' },
      next_cycle_exists: false,
      can_close_early: true,
    })

    renderWithProviders(<CloseoutModal periodId={10} budgetId={1} onClose={jest.fn()} />)

    await screen.findByText('Tracking well.')
    expect(screen.queryByLabelText(/Carry this amount forward/i)).toBeNull()

    const closeButton = screen.getByText('Close Out Cycle')
    expect(closeButton.disabled).toBe(true)

    fireEvent.click(screen.getByLabelText(/Create the next budget cycle automatically during close-out/i))
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
    fireEvent.click(screen.getByLabelText(/Carry this amount forward/i))

    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(client.closeOutPeriod).toHaveBeenCalledWith(1, 11, {
        comments: 'Good month.',
        goals: '',
        create_next_cycle: false,
        carry_forward: true,
      })
    })
  })

  it('dismisses the warning via a button', async () => {
    client.getPeriodCloseoutPreview.mockResolvedValue({
      period: { finperiodid: 13, cycle_status: 'ACTIVE' },
      next_period: { finperiodid: 14 },
      carry_forward_amount: '0.00',
      totals: {},
      health: { summary: 'Okay.', score: 70, status: 'Watch' },
      next_cycle_exists: true,
      can_close_early: true,
    })

    renderWithProviders(<CloseoutModal periodId={13} budgetId={1} onClose={jest.fn()} />)

    await screen.findByText(/Closing a budget cycle makes it read-only/i)
    const dismissBtn = screen.getByText('Dismiss')
    fireEvent.click(dismissBtn)
    expect(screen.queryByText(/Closing a budget cycle makes it read-only/i)).toBeNull()
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
