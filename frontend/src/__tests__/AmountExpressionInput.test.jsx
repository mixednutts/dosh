import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import AmountExpressionInput, { evaluateAmountExpression } from '../components/AmountExpressionInput'

describe('AmountExpressionInput', () => {
  it('evaluates valid arithmetic expressions and rounds to 2 decimals', () => {
    expect(evaluateAmountExpression('1000/4+25')).toMatchObject({
      state: 'valid',
      resolvedValue: 275,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('12.5*2')).toMatchObject({
      state: 'valid',
      resolvedValue: 25,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('(200-50)/3')).toMatchObject({
      state: 'valid',
      resolvedValue: 50,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('10/3')).toMatchObject({
      state: 'valid',
      resolvedValue: 3.33,
      shouldShowPreview: true,
    })
  })

  it('rejects invalid expressions', () => {
    expect(evaluateAmountExpression('1000//4')).toMatchObject({
      state: 'invalid',
      resolvedValue: null,
    })
    expect(evaluateAmountExpression('abc')).toMatchObject({
      state: 'invalid',
      resolvedValue: null,
    })
  })

  it('treats incomplete expressions as in-progress instead of invalid', () => {
    expect(evaluateAmountExpression('100+')).toMatchObject({
      state: 'incomplete',
      resolvedValue: null,
      shouldShowPreview: true,
      previewText: '= 100+',
    })
    expect(evaluateAmountExpression('(100+20')).toMatchObject({
      state: 'incomplete',
      resolvedValue: null,
      shouldShowPreview: true,
      previewText: '= (100+20',
    })
  })

  it('shows preview only when the input contains an expression', () => {
    const onResolvedChange = jest.fn()
    const { rerender } = render(
      <AmountExpressionInput
        value="125"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(screen.queryByText(/=/)).toBeNull()

    rerender(
      <AmountExpressionInput
        value="1000/4+25"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(screen.getByText('= $275.00')).toBeTruthy()
  })

  it('reports invalid state and renders inline validation feedback', () => {
    const onChange = jest.fn()
    const onResolvedChange = jest.fn()

    render(
      <AmountExpressionInput
        value="1000//4"
        onChange={onChange}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(screen.getByText('Enter a valid calculation')).toBeTruthy()
    expect(onResolvedChange).toHaveBeenCalledWith(null, 'invalid')
  })

  it('shows an in-progress summary instead of an error for incomplete calculations', () => {
    const onResolvedChange = jest.fn()

    render(
      <AmountExpressionInput
        value="100+"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(screen.getByText('= 100+')).toBeTruthy()
    expect(screen.queryByText('Enter a valid calculation')).toBeNull()
    expect(onResolvedChange).toHaveBeenCalledWith(null, 'incomplete')
  })

  it('keeps the raw expression visible while editing', () => {
    function Wrapper() {
      const [value, setValue] = React.useState('')

      return (
        <AmountExpressionInput
          value={value}
          onChange={setValue}
          onResolvedChange={() => {}}
          className="input"
        />
      )
    }

    render(<Wrapper />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '1000/4+25' } })

    expect(input.value).toBe('1000/4+25')
    expect(screen.getByText('= $275.00')).toBeTruthy()
  })
})
