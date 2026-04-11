import { useState } from 'react'
import PropTypes from 'prop-types'
import AmountExpressionInput from '../../components/AmountExpressionInput'
import { getResolvedAmountValue } from '../../utils'

export function BudgetAdjustmentModal({ title, currentAmount, onSubmit, onClose }) {
  const [budgetamount, setBudgetAmount] = useState(String(Number(currentAmount ?? 0)))
  const [resolvedAmount, setResolvedAmount] = useState({ value: Number(currentAmount ?? 0), state: 'valid' })
  const [scope, setScope] = useState('current')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = e => {
    e.preventDefault()
    const amount = getResolvedAmountValue(resolvedAmount, 0)
    if (amount == null) {
      setError('Enter a valid budget amount')
      return
    }
    if (!note.trim()) {
      setError('A comment is required')
      return
    }
    setError('')
    onSubmit({ budgetamount: amount, scope, note: note.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Future unlocked updates also refresh the setup amount for later cycles.</p>
      </div>
      <div>
        <label className="label" htmlFor="budget-adjustment-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="budget-adjustment-amount"
          autoFocus
          value={budgetamount}
          onChange={nextValue => {
            setBudgetAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0}
          className="input w-full"
          required
        />
      </div>
      <div>
        <p className="label">Apply to</p>
        <div className="space-y-1.5 mt-1">
          {[['current', 'Current period only'], ['future', 'Current + future unlocked periods']].map(([value, label]) => (
            <label key={value} htmlFor={`budget-adjust-scope-${value}`} className="flex items-center gap-2 text-sm cursor-pointer">
              <input id={`budget-adjust-scope-${value}`} type="radio" name="budget-adjust-scope" value={value} checked={scope === value} onChange={() => setScope(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="budget-adjustment-comment">Comment</label>
        <textarea
          id="budget-adjustment-comment"
          className="input w-full resize-none"
          rows={4}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Why is this budget changing?"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Save Budget Change</button>
      </div>
    </form>
  )
}

BudgetAdjustmentModal.propTypes = {
  title: PropTypes.string.isRequired,
  currentAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}
