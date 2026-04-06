import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import jsep from 'jsep'

const fmt = value => Number(value ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

const ALLOWED_EXPRESSION_PATTERN = /^[\d\s.+\-*/()]+$/
const EXPRESSION_PREVIEW_PATTERN = /[+\-*/()]/
const TRAILING_OPERATOR_PATTERN = /[+\-*/(]\s*$/

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function hasUnclosedParenthesis(value) {
  let balance = 0
  for (const char of value) {
    if (char === '(') balance += 1
    if (char === ')') balance -= 1
  }
  return balance > 0
}

function isIncompleteExpression(value) {
  return TRAILING_OPERATOR_PATTERN.test(value) || hasUnclosedParenthesis(value)
}

function evaluateArithmeticAst(node) {
  switch (node.type) {
    case 'Literal':
      if (typeof node.value !== 'number' || !Number.isFinite(node.value)) {
        throw new Error('Invalid literal')
      }
      return node.value
    case 'UnaryExpression': {
      const argument = evaluateArithmeticAst(node.argument)
      if (node.operator === '+') return argument
      if (node.operator === '-') return -argument
      throw new Error('Invalid unary operator')
    }
    case 'BinaryExpression': {
      const left = evaluateArithmeticAst(node.left)
      const right = evaluateArithmeticAst(node.right)
      switch (node.operator) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          return left / right
        default:
          throw new Error('Invalid binary operator')
      }
    }
    default:
      throw new Error('Unsupported expression')
  }
}

export function evaluateAmountExpression(rawValue) {
  const trimmed = (rawValue ?? '').trim()

  if (!trimmed) {
    return {
      state: 'empty',
      resolvedValue: null,
      error: '',
      shouldShowPreview: false,
      previewText: '',
    }
  }

  if (!ALLOWED_EXPRESSION_PATTERN.test(trimmed)) {
    return {
      state: 'invalid',
      resolvedValue: null,
      error: 'Enter a valid calculation',
      shouldShowPreview: false,
      previewText: '',
    }
  }

  try {
    const ast = jsep(trimmed)
    const numericValue = Number(evaluateArithmeticAst(ast))

    if (!Number.isFinite(numericValue)) {
      throw new Error('Invalid result')
    }

    return {
      state: 'valid',
      resolvedValue: roundCurrency(numericValue),
      error: '',
      shouldShowPreview: EXPRESSION_PREVIEW_PATTERN.test(trimmed),
      previewText: '',
    }
  } catch {
    if (EXPRESSION_PREVIEW_PATTERN.test(trimmed) && isIncompleteExpression(trimmed)) {
      return {
        state: 'incomplete',
        resolvedValue: null,
        error: '',
        shouldShowPreview: true,
        previewText: `= ${trimmed}`,
      }
    }

    return {
      state: 'invalid',
      resolvedValue: null,
      error: 'Enter a valid calculation',
      shouldShowPreview: false,
      previewText: '',
    }
  }
}

export default function AmountExpressionInput({
  value,
  onChange,
  onResolvedChange,
  min,
  placeholder,
  autoFocus = false,
  required = false,
  id,
  className = '',
}) {
  const evaluation = evaluateAmountExpression(value)
  const previousNotificationRef = useRef()

  useEffect(() => {
    const nextNotification = `${evaluation.state}:${evaluation.resolvedValue ?? 'null'}`
    if (previousNotificationRef.current === nextNotification) return
    previousNotificationRef.current = nextNotification
    onResolvedChange(evaluation.resolvedValue, evaluation.state)
  }, [evaluation.resolvedValue, evaluation.state, onResolvedChange])

  return (
    <div className="space-y-1">
      <input
        id={id}
        autoFocus={autoFocus}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={evaluation.state === 'invalid'}
        data-min={min}
        className={className || 'input'}
      />
      {(evaluation.state === 'valid' || evaluation.state === 'incomplete') && evaluation.shouldShowPreview && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {evaluation.state === 'valid' ? `= ${fmt(evaluation.resolvedValue)}` : evaluation.previewText}
        </p>
      )}
      {evaluation.state === 'invalid' && (
        <p className="text-sm text-red-600 dark:text-red-400">{evaluation.error}</p>
      )}
    </div>
  )
}

AmountExpressionInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onResolvedChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  placeholder: PropTypes.string,
  autoFocus: PropTypes.bool,
  required: PropTypes.bool,
  id: PropTypes.string,
  className: PropTypes.string,
}
