import React from 'react'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import { format } from 'date-fns'

import CycleFilter from '../components/reports/CycleFilter'

jest.mock('../components/DateField', () => {
  const ReactForMock = require('react')
  return ReactForMock.forwardRef(function MockDateField({ selected, onChange, placeholderText }, ref) {
    return (
      <input
        ref={ref}
        data-testid={placeholderText}
        value={selected ? selected.toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val ? new Date(val + 'T00:00:00') : null)
        }}
        placeholder={placeholderText}
      />
    )
  })
})

const mockPeriods = [
  { finperiodid: 1, startdate: '2025-01-01', enddate: '2025-01-31' },
  { finperiodid: 2, startdate: '2025-02-01', enddate: '2025-02-28' },
  { finperiodid: 3, startdate: '2025-03-01', enddate: '2025-03-31' },
  { finperiodid: 4, startdate: '2025-04-01', enddate: '2025-04-30' },
  { finperiodid: 5, startdate: '2025-05-01', enddate: '2025-05-31' },
  { finperiodid: 6, startdate: '2025-06-01', enddate: '2025-06-30' },
  { finperiodid: 7, startdate: '2025-07-01', enddate: '2025-07-31' },
  { finperiodid: 8, startdate: '2025-08-01', enddate: '2025-08-31' },
]

describe('CycleFilter', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function renderFilter(props = {}) {
    return render(
      <CycleFilter
        budgetPeriods={mockPeriods}
        onChange={mockOnChange}
        defaultPreset="last12"
        {...props}
      />
    )
  }

  it('renders preset buttons', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: 'Last 12 Periods' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last 6 Periods' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All Periods' })).toBeTruthy()
  })

  it('applies last12 preset on mount with all periods when fewer than 12 exist', async () => {
    renderFilter()
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
    expect(lastCall.fromDate).toBeInstanceOf(Date)
    expect(lastCall.toDate).toBeInstanceOf(Date)
    expect(format(lastCall.fromDate, 'yyyy-MM-dd')).toBe('2025-01-01')
    expect(format(lastCall.toDate, 'yyyy-MM-dd')).toBe('2025-08-31')
  })

  it('applies all time preset with null dates', async () => {
    renderFilter({ defaultPreset: 'all' })
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ fromDate: null, toDate: null })
    })
  })

  it('switches preset when a different button is clicked', async () => {
    renderFilter({ defaultPreset: 'all' })
    await waitFor(() => expect(mockOnChange).toHaveBeenCalled())
    mockOnChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Last 6 Periods' }))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
    expect(lastCall.fromDate).toBeInstanceOf(Date)
    expect(lastCall.toDate).toBeInstanceOf(Date)
    expect(format(lastCall.fromDate, 'yyyy-MM-dd')).toBe('2025-03-01')
    expect(format(lastCall.toDate, 'yyyy-MM-dd')).toBe('2025-08-31')
  })

  it('sets custom preset and filters by entered period count', async () => {
    renderFilter({ defaultPreset: 'all' })
    await waitFor(() => expect(mockOnChange).toHaveBeenCalled())
    mockOnChange.mockClear()

    const customInput = screen.getByPlaceholderText('#')
    fireEvent.change(customInput, { target: { value: '3' } })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
    expect(lastCall.fromDate).toBeInstanceOf(Date)
    expect(lastCall.toDate).toBeInstanceOf(Date)
    expect(format(lastCall.fromDate, 'yyyy-MM-dd')).toBe('2025-06-01')
    expect(format(lastCall.toDate, 'yyyy-MM-dd')).toBe('2025-08-31')
  })

  it('limits custom count to available periods', async () => {
    renderFilter({ defaultPreset: 'all' })
    await waitFor(() => expect(mockOnChange).toHaveBeenCalled())
    mockOnChange.mockClear()

    const customInput = screen.getByPlaceholderText('#')
    fireEvent.change(customInput, { target: { value: '99' } })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
    expect(format(lastCall.fromDate, 'yyyy-MM-dd')).toBe('2025-01-01')
    expect(format(lastCall.toDate, 'yyyy-MM-dd')).toBe('2025-08-31')
  })

  it('sets custom preset when from date is changed', () => {
    renderFilter({ defaultPreset: 'all' })
    mockOnChange.mockClear()

    const fromInput = screen.getByTestId('Start date')
    fireEvent.change(fromInput, { target: { value: '2025-02-01' } })

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      fromDate: expect.any(Date),
    }))
  })

  it('sets custom preset when to date is changed', () => {
    renderFilter({ defaultPreset: 'all' })
    mockOnChange.mockClear()

    const toInput = screen.getByTestId('End date')
    fireEvent.change(toInput, { target: { value: '2025-02-28' } })

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      toDate: expect.any(Date),
    }))
  })

  it('shows validation error when from date is after to date', () => {
    renderFilter({ defaultPreset: 'all' })

    const fromInput = screen.getByTestId('Start date')
    const toInput = screen.getByTestId('End date')

    fireEvent.change(fromInput, { target: { value: '2025-03-01' } })
    fireEvent.change(toInput, { target: { value: '2025-01-31' } })

    expect(screen.getByText('From date must be before or equal to To date')).toBeTruthy()
  })

  it('clears validation error when dates become valid', () => {
    renderFilter({ defaultPreset: 'all' })

    const fromInput = screen.getByTestId('Start date')
    const toInput = screen.getByTestId('End date')

    fireEvent.change(fromInput, { target: { value: '2025-03-01' } })
    fireEvent.change(toInput, { target: { value: '2025-01-31' } })
    expect(screen.getByText('From date must be before or equal to To date')).toBeTruthy()

    fireEvent.change(fromInput, { target: { value: '2025-01-01' } })
    expect(screen.queryByText('From date must be before or equal to To date')).toBeNull()
  })

  it('handles empty budget periods gracefully', () => {
    renderFilter({ budgetPeriods: [], defaultPreset: 'all' })
    expect(screen.getByRole('button', { name: 'All Periods' })).toBeTruthy()
  })
})
