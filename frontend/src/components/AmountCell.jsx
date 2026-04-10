/**
 * Inline editable amount cell — shows value, click to edit.
 * Calls onSave(newValue) when blurred or Enter pressed.
 */
import { useState } from 'react'
import PropTypes from 'prop-types'
import LocalizedAmountInput from './LocalizedAmountInput'
import { useLocalisation } from './LocalisationContext'

export default function AmountCell({ value, onSave, disabled = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const { formatCurrency } = useLocalisation()

  if (!editing || disabled) {
    return (
      <button
        type="button"
        onClick={() => { if (!disabled) { setDraft(String(value ?? 0)); setEditing(true) } }}
        className={`rounded px-1 text-left hover:bg-gray-100 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        disabled={disabled}
      >
        {formatCurrency(value ?? 0)}
      </button>
    )
  }

  return (
    <LocalizedAmountInput
      autoFocus
      value={draft}
      onChange={setDraft}
      onBlur={() => { setEditing(false); onSave(Number.parseFloat(draft) || 0) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { setEditing(false); onSave(Number.parseFloat(draft) || 0) }
        if (e.key === 'Escape') setEditing(false)
      }}
      className="w-28 rounded border border-dosh-400 px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-dosh-500"
    />
  )
}

AmountCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSave: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}
