import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import AmountCell from '../components/AmountCell'

describe('AmountCell', () => {
  it('enters edit mode and saves on blur', () => {
    const onSave = jest.fn()

    render(<AmountCell value={12.5} onSave={onSave} />)

    fireEvent.click(screen.getByText('$12.50'))

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '25.75' } })
    fireEvent.blur(input)

    expect(onSave).toHaveBeenCalledWith(25.75)
    expect(screen.getByText('$12.50')).toBeTruthy()
  })

  it('saves on Enter and cancels on Escape', () => {
    const onSave = jest.fn()

    const { rerender } = render(<AmountCell value={40} onSave={onSave} />)

    fireEvent.click(screen.getByText('$40.00'))
    const firstInput = screen.getByRole('textbox')
    fireEvent.change(firstInput, { target: { value: '50' } })
    fireEvent.keyDown(firstInput, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith(50)

    rerender(<AmountCell value={40} onSave={onSave} />)

    fireEvent.click(screen.getByText('$40.00'))
    const secondInput = screen.getByRole('textbox')
    fireEvent.change(secondInput, { target: { value: '60' } })
    fireEvent.keyDown(secondInput, { key: 'Escape' })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByText('$40.00')).toBeTruthy()
  })

  it('does not enter edit mode when disabled', () => {
    const onSave = jest.fn()

    render(<AmountCell value={99} onSave={onSave} disabled />)

    fireEvent.click(screen.getByText('$99.00'))

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
