import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocalisation } from './LocalisationContext'
import { formatLocalizedAmountForEdit, getNumericInputOptions, normalizeLocalizedAmountInput, parseLocalizedAmountInput } from '../utils/localisation'

export default function LocalizedAmountInput({
  id,
  value,
  onChange,
  onValueChange,
  disabled = false,
  required = false,
  min = null,
  autoFocus = false,
  className = 'input',
  placeholder,
  onFormulaStart,
  onBlur,
  onKeyDown,
  ariaLabel,
}) {
  const inputRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const localisation = useLocalisation()
  const options = useMemo(
    () => getNumericInputOptions(localisation, { minimumValue: min === undefined ? null : min }),
    [localisation, min]
  )

  const formatDisplayValue = inputValue => {
    if (inputValue === '' || inputValue === null || inputValue === undefined) return ''
    const parsedValue = parseLocalizedAmountInput(inputValue, localisation)
    if (parsedValue === null) return String(inputValue)
    return localisation.formatNumber(parsedValue, {
      minimumFractionDigits: options.decimalPlaces,
      maximumFractionDigits: options.decimalPlaces,
    })
  }
  const [draftValue, setDraftValue] = useState(() => formatDisplayValue(value))

  const emitNormalizedValue = (normalizedValue, nextDraftValue) => {
    onChange(normalizedValue)
    onValueChange?.(Number(normalizedValue))
    if (nextDraftValue !== undefined) {
      setDraftValue(nextDraftValue)
    }
  }

  useEffect(() => {
    if (isFocused) return
    setDraftValue(formatDisplayValue(value))
  }, [isFocused, value, localisation, options.decimalPlaces])

  const handleChange = event => {
    const nextValue = event.target.value
    setDraftValue(nextValue)

    if (nextValue.startsWith('=') && onFormulaStart) {
      onChange(nextValue)
      return
    }

    const normalizedValue = normalizeLocalizedAmountInput(nextValue, localisation)
    if (normalizedValue !== null) {
      emitNormalizedValue(normalizedValue)
    } else {
      onChange(nextValue)
      onValueChange?.(null)
    }
  }

  const handleBlur = event => {
    const normalizedValue = normalizeLocalizedAmountInput(draftValue, localisation)
    if (normalizedValue !== null) {
      setDraftValue(formatDisplayValue(normalizedValue))
      onChange(normalizedValue)
      onValueChange?.(Number(normalizedValue))
    }
    setIsFocused(false)
    onBlur?.(event)
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={draftValue}
      onFocus={() => {
        setIsFocused(true)
        setDraftValue(formatLocalizedAmountForEdit(value, localisation))
      }}
      onKeyDown={event => {
        if (event.key === '=' && onFormulaStart) {
          event.preventDefault()
          onFormulaStart()
          return
        }
        onKeyDown?.(event)
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}

LocalizedAmountInput.propTypes = {
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  onValueChange: PropTypes.func,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  autoFocus: PropTypes.bool,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  onFormulaStart: PropTypes.func,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,
  ariaLabel: PropTypes.string,
}
