import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncomeTypes, getBalanceTypes, createIncomeType, addIncomeToPeriod, savingsTransfer } from '../../api/client'
import AmountExpressionInput from '../AmountExpressionInput'
import { getResolvedAmountValue } from '../../utils/transactionHelpers'

export function AddIncomeLineModal({ periodId, budgetId, existingDescs, onClose }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('existing') // 'existing' | 'new' | 'savings'
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [scope, setScope] = useState('oneoff')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLinkedAccount, setNewLinkedAccount] = useState('')
  const [newAutoInclude, setNewAutoInclude] = useState(true)

  const { data: incomeTypes = [] } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
    enabled: mode === 'new' || mode === 'savings',
  })

  const available = incomeTypes.filter(i => !existingDescs.includes(i.incomedesc))

  // Savings accounts not yet transferred in this period
  const savingsAccounts = balanceTypes.filter(bt =>
    bt.balance_type === 'Savings' &&
    !existingDescs.includes(`Transfer from ${bt.balancedesc}`)
  )

  const currentList = mode === 'savings' ? savingsAccounts : available

  const createItem = useMutation({ mutationFn: data => createIncomeType(budgetId, data) })

  const add = useMutation({
    mutationFn: data => addIncomeToPeriod(periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['income-types', budgetId] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to add income'),
  })

  const addTransfer = useMutation({
    mutationFn: data => savingsTransfer(periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to record transfer'),
  })

  const isPending = createItem.isPending || add.isPending || addTransfer.isPending

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    try {
      if (mode === 'savings') {
        const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
        if (resolvedValue == null) { setError('Enter a valid budget amount'); return }
        if (!selected) { setError('Select a savings account'); return }
        addTransfer.mutate({ budgetid: budgetId, balancedesc: selected, amount: resolvedValue })
        return
      }

      const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
      if (resolvedValue == null) { setError('Enter a valid budget amount'); return }

      if (mode === 'new') {
        const trimmedDesc = newDesc.trim()
        if (!trimmedDesc) { setError('Enter a description'); return }
        await createItem.mutateAsync({
          incomedesc: trimmedDesc,
          issavings: false,
          autoinclude: newAutoInclude,
          amount: resolvedValue,
          linked_account: newLinkedAccount || null,
        })
        add.mutate({ budgetid: budgetId, incomedesc: trimmedDesc, budgetamount: resolvedValue, scope, note: note || null })
        return
      }

      if (!selected) { setError('Select an income source'); return }
      add.mutate({ budgetid: budgetId, incomedesc: selected, budgetamount: resolvedValue, scope, note: note || null })
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to add income')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
        {[['existing', 'Existing income'], ['new', 'New income'], ['savings', 'Transfer from Savings']].map(([val, label]) => (
          <button key={val} type="button" onClick={() => { setMode(val); setSelected(''); setAmount(''); setError('') }}
            className={`flex-1 py-1.5 font-medium transition-colors ${mode === val ? 'bg-dosh-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'new' ? (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="add-income-new-desc">Description</label>
            <input id="add-income-new-desc" required className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Bonus" />
          </div>
          <div>
            <label className="label" htmlFor="add-income-linked-account">Paid into Account</label>
            <select id="add-income-linked-account" className="input" value={newLinkedAccount} onChange={e => setNewLinkedAccount(e.target.value)}>
              <option value="">— none —</option>
              {balanceTypes.map(bt => (
                <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="new-income-auto-include" className="flex items-start gap-3 text-sm cursor-pointer">
              <input id="new-income-auto-include" type="checkbox" checked={newAutoInclude} onChange={e => setNewAutoInclude(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
              <span className="space-y-0.5">
                <span className="block font-medium text-gray-800 dark:text-gray-100">Auto-include</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Will automatically add this to any new budget cycles generated. Uncheck this if you only want to add it manually when needed.</span>
              </span>
            </label>
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="add-income-existing-select">{mode === 'savings' ? 'Savings Account' : 'Income Source'}</label>
          {currentList.length === 0
            ? <p className="text-sm text-gray-500 italic">
                {mode === 'savings' ? 'No savings accounts available. Add a Savings account in budget settings.' : 'All income sources already in this budget cycle. Use "New income".'}
              </p>
            : <select id="add-income-existing-select" required className="input" value={selected} onChange={e => {
                setSelected(e.target.value)
                if (mode !== 'savings') {
                  const it = incomeTypes.find(i => i.incomedesc === e.target.value)
                  if (it) setAmount(String(it.amount))
                }
              }}>
                <option value="">— select —</option>
                {mode === 'savings'
                  ? currentList.map(bt => <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>)
                  : currentList.map(i => <option key={i.incomedesc} value={i.incomedesc}>{i.incomedesc}</option>)}
              </select>}
        </div>
      )}
      <div>
        <label className="label" htmlFor="add-income-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="add-income-amount"
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
      {mode !== 'savings' && (
        <div>
          <label className="label" htmlFor="add-income-note">Comment / Note</label>
          <textarea id="add-income-note" className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
        </div>
      )}
      {mode !== 'savings' && (
        <div>
          <p className="label">Include in</p>
          <div className="space-y-1.5 mt-1">
            {[['oneoff', 'This budget cycle only'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
              <label key={val} htmlFor={`income-scope-${val}`} className="flex items-center gap-2 text-sm cursor-pointer">
                <input id={`income-scope-${val}`} type="radio" name="income-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isPending || (mode !== 'new' && currentList.length === 0)}>{isPending ? 'Adding…' : 'Add'}</button>
      </div>
    </form>
  )
}

AddIncomeLineModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  existingDescs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
}
