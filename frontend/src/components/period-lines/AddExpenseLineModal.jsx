import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { getExpenseItems, createExpenseItem, addExpenseToPeriod, getBalanceTypes, getBudget } from '../../api/client'
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
  const [defaultAccountDesc, setDefaultAccountDesc] = useState('')
  const [showDebitHelp, setShowDebitHelp] = useState(false)

  const { data: expenseItems = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
    enabled: mode === 'new',
  })

  const available = expenseItems.filter(e => !existingDescs.includes(e.expensedesc))

  const createItem = useMutation({ mutationFn: data => createExpenseItem(budgetId, data) })
  const addToperiod = useMutation({
    mutationFn: data => addExpenseToPeriod(budgetId, periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); qc.invalidateQueries({ queryKey: ['period-balances', periodId] }); qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed'),
  })

  const activeAccounts = balanceTypes.filter(bt => bt.active !== false)
  const primaryAccount = activeAccounts.find(bt => bt.is_primary) || activeAccounts[0] || null
  const primaryAccountDesc = primaryAccount?.balancedesc || ''

  const scheduledError = mode === 'new' && newFreqtype !== 'Always' && (!newFreqVal || (newFreqtype === 'Every N Days' && !newEffDate))
    ? (newFreqtype === 'Fixed Day of Month'
        ? 'Day of month is required for Fixed Day of Month expenses.'
        : 'Interval and effective date are required for Every N Days expenses.')
    : ''

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    if (scheduledError) { setError(scheduledError); return }
    try {
      const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
      if (resolvedValue == null) { setError('Enter a valid budget amount'); return }
      if (mode === 'new') {
        if (!newDesc.trim()) { setError('Enter a description'); return }
        const freqValue = newFreqtype === 'Always' ? null : (newFreqVal ? Number.parseInt(newFreqVal, 10) : null)
        const payType = newFreqtype === 'Always' ? 'MANUAL' : (newPaytype || 'MANUAL')
        const effDate = newFreqtype === 'Always' ? null : (newEffDate || null)
        const accountDesc = defaultAccountDesc === primaryAccountDesc ? null : (defaultAccountDesc || null)
        await createItem.mutateAsync({
          expensedesc: newDesc.trim(),
          active: true,
          freqtype: newFreqtype || null,
          frequency_value: freqValue,
          paytype: payType,
          effectivedate: effDate,
          expenseamount: resolvedValue,
          default_account_desc: accountDesc,
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
        <div className="space-y-4">
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label htmlFor="add-expense-debit-account" className="label">Debit Account</label>
              <span className="relative inline-flex">
                <button
                  type="button"
                  aria-label="More information about debit account"
                  className="text-gray-400 transition-colors hover:text-dosh-600 dark:text-gray-500 dark:hover:text-dosh-300"
                  onMouseEnter={() => setShowDebitHelp(true)}
                  onMouseLeave={() => setShowDebitHelp(false)}
                  onFocus={() => setShowDebitHelp(true)}
                  onBlur={() => setShowDebitHelp(false)}
                  onClick={() => setShowDebitHelp(v => !v)}
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </button>
                {showDebitHelp && (
                  <span className="absolute left-1/2 top-6 z-10 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg dark:bg-gray-700">
                    The account where the expense amount will be deducted from.  Defaults to the Primary Banking Account.
                  </span>
                )}
              </span>
            </div>
            {(() => {
              const debitAccountValue = defaultAccountDesc || primaryAccountDesc
              return (
                <>
                  <select
                    id="add-expense-debit-account"
                    required
                    className="input"
                    value={debitAccountValue}
                    onChange={e => setDefaultAccountDesc(e.target.value === primaryAccountDesc ? '' : e.target.value)}
                  >
                    {activeAccounts.map(bt => (
                      <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>
                    ))}
                  </select>
                  {activeAccounts.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No active accounts available.</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
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
