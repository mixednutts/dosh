import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import jsep from 'jsep'
import LocalizedAmountInput from './LocalizedAmountInput'
import { useLocalisation } from './LocalisationContext'
import { DEFAULT_LOCALISATION, parseLocalizedAmountInput } from '../utils/localisation'

const ALLOWED_EXPRESSION_PATTERN = /^[\d\s.+\-*/()]+$/
const EXPRESSION_PREVIEW_PATTERN = /[+\-*/()]/
const TRAILING_OPERATOR_PATTERN = /[+\-*/(]\s*$/
const FORMULA_PREFIX = '='

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

function isArithmeticExpression(value) {
  const trimmed = (value ?? '').trim()
  if (trimmed.startsWith(FORMULA_PREFIX)) return true
  return EXPRESSION_PREVIEW_PATTERN.test(trimmed)
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

export function evaluateAmountExpression(rawValue, localisation = DEFAULT_LOCALISATION) {
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

  if (!isArithmeticExpression(trimmed)) {
    const resolvedValue = parseLocalizedAmountInput(trimmed, localisation)
    if (resolvedValue === null) {
      return {
        state: 'invalid',
        resolvedValue: null,
        error: 'Enter a valid amount',
        shouldShowPreview: false,
        previewText: '',
      }
    }

    return {
      state: 'valid',
      resolvedValue: roundCurrency(resolvedValue),
      error: '',
      shouldShowPreview: false,
      previewText: '',
    }
  }

  const expression = trimmed.startsWith(FORMULA_PREFIX) ? trimmed.slice(1).trim() : trimmed

  if (!expression) {
    return {
      state: 'incomplete',
      resolvedValue: null,
      error: '',
      shouldShowPreview: true,
      previewText: trimmed.startsWith(FORMULA_PREFIX) ? '=' : '',
    }
  }

  if (!ALLOWED_EXPRESSION_PATTERN.test(expression)) {
    return {
      state: 'invalid',
      resolvedValue: null,
      error: 'Enter a valid calculation',
      shouldShowPreview: false,
      previewText: '',
    }
  }

  try {
    const ast = jsep(expression)
    const numericValue = Number(evaluateArithmeticAst(ast))

    if (!Number.isFinite(numericValue)) {
      throw new Error('Invalid result')
    }

    return {
      state: 'valid',
      resolvedValue: roundCurrency(numericValue),
      error: '',
      shouldShowPreview: true,
      previewText: '',
    }
  } catch {
    if (EXPRESSION_PREVIEW_PATTERN.test(expression) && isIncompleteExpression(expression)) {
      return {
        state: 'incomplete',
        resolvedValue: null,
        error: '',
        shouldShowPreview: true,
        previewText: `= ${expression}`,
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

function applyMinimum(evaluation, min) {
  if (
    evaluation.state !== 'valid'
    || min === undefined
    || min === null
    || evaluation.resolvedValue === null
    || evaluation.resolvedValue >= min
  ) {
    return evaluation
  }

  return {
    state: 'invalid',
    resolvedValue: null,
    error: `Enter an amount of ${min} or more`,
    shouldShowPreview: false,
    previewText: '',
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
  const localisation = useLocalisation()
  const evaluation = applyMinimum(evaluateAmountExpression(value, localisation), min)
  const previousNotificationRef = useRef()
  const previousIsExpressionRef = useRef(false)
  const formulaInputRef = useRef(null)
  const isExpression = isArithmeticExpression(value)

  useEffect(() => {
    const nextNotification = `${evaluation.state}:${evaluation.resolvedValue ?? 'null'}`
    if (previousNotificationRef.current === nextNotification) return
    previousNotificationRef.current = nextNotification
    onResolvedChange(evaluation.resolvedValue, evaluation.state)
  }, [evaluation.resolvedValue, evaluation.state, onResolvedChange])

  useEffect(() => {
    const justEnteredExpressionMode = isExpression && !previousIsExpressionRef.current
    previousIsExpressionRef.current = isExpression

    if (!justEnteredExpressionMode) return

    const input = formulaInputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [isExpression])

  return (
    <div className="space-y-1">
      {isExpression ? (
        <input
          ref={formulaInputRef}
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
      ) : (
        <LocalizedAmountInput
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          className={className || 'input'}
          onFormulaStart={() => onChange('=')}
        />
      )}
      {(evaluation.state === 'valid' || evaluation.state === 'incomplete') && evaluation.shouldShowPreview && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {evaluation.state === 'valid' ? `= ${localisation.formatCurrency(evaluation.resolvedValue)}` : evaluation.previewText}
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
