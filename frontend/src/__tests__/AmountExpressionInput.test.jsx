import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import AmountExpressionInput, { evaluateAmountExpression } from '../components/AmountExpressionInput'
import { LocalisationProvider } from '../components/LocalisationContext'

describe('AmountExpressionInput', () => {
  it('returns an empty state for blank input', () => {
    expect(evaluateAmountExpression('')).toMatchObject({
      state: 'empty',
      resolvedValue: null,
      shouldShowPreview: false,
      previewText: '',
    })
  })

  it('evaluates valid arithmetic expressions and rounds to 2 decimals', () => {
    expect(evaluateAmountExpression('=1000/4+25')).toMatchObject({
      state: 'valid',
      resolvedValue: 275,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('=12.5*2')).toMatchObject({
      state: 'valid',
      resolvedValue: 25,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('=(200-50)/3')).toMatchObject({
      state: 'valid',
      resolvedValue: 50,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('=10/3')).toMatchObject({
      state: 'valid',
      resolvedValue: 3.33,
      shouldShowPreview: true,
    })
    expect(evaluateAmountExpression('=-25+5')).toMatchObject({
      state: 'valid',
      resolvedValue: -20,
      shouldShowPreview: true,
    })
  })

  it('rejects invalid expressions', () => {
    expect(evaluateAmountExpression('=1000//4')).toMatchObject({
      state: 'invalid',
      resolvedValue: null,
    })
    expect(evaluateAmountExpression('abc')).toMatchObject({
      state: 'invalid',
      resolvedValue: null,
    })
    expect(evaluateAmountExpression('=10/0')).toMatchObject({
      state: 'invalid',
      resolvedValue: null,
    })
  })

  it('treats incomplete expressions as in-progress instead of invalid', () => {
    expect(evaluateAmountExpression('=100+')).toMatchObject({
      state: 'incomplete',
      resolvedValue: null,
      shouldShowPreview: true,
      previewText: '= 100+',
    })
    expect(evaluateAmountExpression('=(100+20')).toMatchObject({
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
        value="=1000/4+25"
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
        value="=1000//4"
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
        value="=100+"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(screen.getByText('= 100+')).toBeTruthy()
    expect(screen.queryByText('Enter a valid calculation')).toBeNull()
    expect(onResolvedChange).toHaveBeenCalledWith(null, 'incomplete')
  })

  it('does not notify resolved state repeatedly when the evaluation result is unchanged', () => {
    const onResolvedChange = jest.fn()
    const { rerender } = render(
      <AmountExpressionInput
        value="125"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(onResolvedChange).toHaveBeenCalledTimes(1)
    expect(onResolvedChange).toHaveBeenLastCalledWith(125, 'valid')

    rerender(
      <AmountExpressionInput
        value="125"
        onChange={() => {}}
        onResolvedChange={onResolvedChange}
        className="input"
      />
    )

    expect(onResolvedChange).toHaveBeenCalledTimes(1)
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
    fireEvent.change(input, { target: { value: '=1000/4+25' } })

    expect(input.value).toBe('=1000/4+25')
    expect(screen.getByText('= $275.00')).toBeTruthy()
  })

  it('does not render currency symbols or codes inside normal amount entry fields', () => {
    render(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'GBP', timezone: 'Australia/Sydney' }}>
        <AmountExpressionInput
          value="1"
          onChange={() => {}}
          onResolvedChange={() => {}}
          className="input"
        />
      </LocalisationProvider>
    )

    const input = screen.getByRole('textbox')

    expect(input.value).not.toContain('GBP')
    expect(input.value).not.toContain('£')
    expect(input.value).toContain('1')
  })

  it('does not pad a typed whole number to fixed decimals while editing', () => {
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
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1' } })

    expect(input.value).toBe('1')
    expect(input.value).not.toBe('1.00')
  })

  it('does not apply grouping while typing a whole number', () => {
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
    input.focus()
    fireEvent.change(input, { target: { value: '1' } })
    expect(input.value).toBe('1')

    fireEvent.change(input, { target: { value: '12' } })
    expect(input.value).toBe('12')

    fireEvent.change(input, { target: { value: '120' } })
    expect(input.value).toBe('120')

    fireEvent.change(input, { target: { value: '1200' } })
    expect(input.value).toBe('1200')
    expect(input.value).not.toBe('1,200')
  })

  it('applies localized grouping only after the amount field loses focus', () => {
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
    input.focus()
    fireEvent.change(input, { target: { value: '1200' } })
    fireEvent.blur(input)

    expect(input.value).toBe('1,200.00')
  })

  it('shows grouped display on initial render and editable text on focus', () => {
    render(
      <AmountExpressionInput
        value="1200"
        onChange={() => {}}
        onResolvedChange={() => {}}
        className="input"
      />
    )

    const input = screen.getByRole('textbox')
    expect(input.value).toBe('1,200.00')

    fireEvent.focus(input)
    expect(input.value).toBe('1200')

    fireEvent.blur(input)
    expect(input.value).toBe('1,200.00')
  })

  it('keeps focus in the value field when formula mode starts from equals', () => {
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
    input.focus()
    fireEvent.keyDown(input, { key: '=' })

    const formulaInput = screen.getByRole('textbox')
    expect(formulaInput.value).toBe('=')
    expect(document.activeElement).toBe(formulaInput)
  })
})
