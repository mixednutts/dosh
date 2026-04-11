import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenseItems, createExpenseItem, addExpenseToPeriod } from '../../api/client'
import AmountExpressionInput from '../AmountExpressionInput'
import ExpenseItemSchedulingFields from '../ExpenseItemSchedulingFields'
import { getResolvedAmountValue } from '../../utils/transactionHelpers'

export function AddExpenseLineModal({ periodId, budgetId, existingDescs, onClose }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('existing')
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [scope, setScope] = useState('oneoff')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFreqtype, setNewFreqtype] = useState('Fixed Day of Month')
  const [newFreqVal, setNewFreqVal] = useState('')
  const [newPaytype, setNewPaytype] = useState('AUTO')
  const [newEffDate, setNewEffDate] = useState('')

  const { data: expenseItems = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })

  const available = expenseItems.filter(e => !existingDescs.includes(e.expensedesc))

  const createItem = useMutation({ mutationFn: data => createExpenseItem(budgetId, data) })
  const addToperiod = useMutation({
    mutationFn: data => addExpenseToPeriod(periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed'),
  })

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    try {
      const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
      if (resolvedValue == null) { setError('Enter a valid budget amount'); return }
      if (mode === 'new') {
        if (!newDesc.trim()) { setError('Enter a description'); return }
        await createItem.mutateAsync({
          expensedesc: newDesc.trim(),
          active: true,
          freqtype: newFreqtype || null,
          frequency_value: newFreqtype === 'Always' ? null : (newFreqVal ? Number.parseInt(newFreqVal, 10) : null),
          paytype: newFreqtype === 'Always' ? 'MANUAL' : (newPaytype || 'MANUAL'),
          effectivedate: newFreqtype === 'Always' ? null : (newEffDate || null),
          expenseamount: resolvedValue,
        })
        addToperiod.mutate({ budgetid: budgetId, expensedesc: newDesc.trim(), budgetamount: resolvedValue, scope, note: note || null })
      } else {
        if (!selected) { setError('Select an expense item'); return }
        addToperiod.mutate({ budgetid: budgetId, expensedesc: selected, budgetamount: resolvedValue, scope, note: note || null })
      }
    } catch (err) { setError(err.response?.data?.detail ?? 'Failed') }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
        {[['existing', 'Existing item'], ['new', 'New item']].map(([val, label]) => (
          <button key={val} type="button" onClick={() => setMode(val)}
            className={`flex-1 py-1.5 font-medium transition-colors ${mode === val ? 'bg-dosh-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'existing' ? (
        <div>
          <label className="label" htmlFor="add-expense-existing-select">Expense Item</label>
          {available.length === 0
            ? <p className="text-sm text-gray-500 italic">All items already in this budget cycle. Use "New item".</p>
            : <select id="add-expense-existing-select" required className="input" value={selected} onChange={e => { setSelected(e.target.value); const ei = expenseItems.find(i => i.expensedesc === e.target.value); if (ei) setAmount(String(ei.expenseamount)) }}>
                <option value="">— select —</option>
                {available.map(e => <option key={e.expensedesc} value={e.expensedesc}>{e.expensedesc}</option>)}
              </select>}
        </div>
      ) : (
        <ExpenseItemSchedulingFields
          formIdPrefix="add-expense"
          description={newDesc}
          onDescriptionChange={setNewDesc}
          freqtype={newFreqtype}
          onFreqtypeChange={setNewFreqtype}
          frequencyValue={newFreqVal}
          onFrequencyValueChange={setNewFreqVal}
          paytype={newPaytype}
          onPaytypeChange={setNewPaytype}
          effectivedate={newEffDate}
          onEffectivedateChange={setNewEffDate}
        />
      )}
      <div>
        <label className="label" htmlFor="add-expense-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="add-expense-amount"
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
        <label className="label" htmlFor="add-expense-note">Comment / Note</label>
        <textarea id="add-expense-note" className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
      </div>
      <div>
        <p className="label">Include in</p>
        <div className="space-y-1.5 mt-1">
          {[['oneoff', 'This budget cycle only (one-off)'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
            <label key={val} htmlFor={`expense-scope-${val}`} className="flex items-center gap-2 text-sm cursor-pointer">
              <input id={`expense-scope-${val}`} type="radio" name="exp-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={createItem.isPending || addToperiod.isPending}>{createItem.isPending || addToperiod.isPending ? 'Adding…' : 'Add'}</button>
      </div>
    </form>
  )
}

AddExpenseLineModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  existingDescs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
}
