import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvestmentItems, addInvestmentToPeriod } from '../../api/client'
import AmountExpressionInput from '../AmountExpressionInput'
import { getResolvedAmountValue } from '../../utils/transactionHelpers'

export function AddInvestmentLineModal({ periodId, budgetId, existingDescs, onClose }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const { data: investmentItems = [] } = useQuery({
    queryKey: ['investment-items', budgetId],
    queryFn: () => getInvestmentItems(budgetId),
  })

  const available = investmentItems.filter(item => !existingDescs.includes(item.investmentdesc))

  const addToPeriod = useMutation({
    mutationFn: data => addInvestmentToPeriod(budgetId, periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      qc.invalidateQueries({ queryKey: ['investment-items', budgetId] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed'),
  })

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
    if (resolvedValue == null) {
      setError('Enter a valid budget amount')
      return
    }
    if (!selected) {
      setError('Select an investment item')
      return
    }
    addToPeriod.mutate({
      budgetid: budgetId,
      investmentdesc: selected,
      budgeted_amount: resolvedValue,
      scope: 'oneoff',
      note: note || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="add-investment-existing-select">Investment Item</label>
        {available.length === 0
          ? <p className="text-sm text-gray-500 italic">All investments already in this budget cycle. Add a new investment in Budget Setup first.</p>
          : (
            <select
              id="add-investment-existing-select"
              required
              className="input"
              value={selected}
              onChange={e => {
                setSelected(e.target.value)
                const item = investmentItems.find(i => i.investmentdesc === e.target.value)
                if (item) setAmount(String(item.planned_amount ?? 0))
              }}
            >
              <option value="">— select —</option>
              {available.map(item => (
                <option key={item.investmentdesc} value={item.investmentdesc}>{item.investmentdesc}</option>
              ))}
            </select>
          )}
      </div>
      <div>
        <label className="label" htmlFor="add-investment-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="add-investment-amount"
          value={amount}
          onChange={nextValue => {
            setAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0}
          className="input w-full"
        />
      </div>
      <div>
        <label className="label" htmlFor="add-investment-note">Comment / Note</label>
        <textarea
          id="add-investment-note"
          className="input w-full resize-none"
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Why are you adding this line?"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        This will add the investment to the current budget cycle only. Future cycles get the investment through normal generation if it is active in setup.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          type="submit"
          className="btn-primary"
          disabled={addToPeriod.isPending || available.length === 0}
        >
          {addToPeriod.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  )
}

AddInvestmentLineModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  existingDescs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
}
