import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays } from 'date-fns'
import {
  LockClosedIcon, LockOpenIcon, ChevronRightIcon, PlusIcon,
  MinusIcon, TrashIcon, ListBulletIcon, XMarkIcon, Bars2Icon,
  ChatBubbleOvalLeftEllipsisIcon,
} from '@heroicons/react/24/outline'
import {
  getPeriodDetail, getBudget, setPeriodLock,
  updateIncomeActual, addToIncomeActual,
  addExpenseToPeriod, addIncomeToPeriod, savingsTransfer,
  getExpenseItems, getIncomeTypes, createExpenseItem,
  getExpenseEntries, addExpenseEntry, deleteExpenseEntry,
  updatePeriodBalance, reorderPeriodExpenses,
  getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction,
  setPeriodExpenseStatus, updatePeriodExpenseBudget, removePeriodExpense,
  updatePeriodInvestmentBudget, getBalanceTypes, updateExpenseNote, removePeriodIncome,
} from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const fmt = v => Number(v ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function calcNextDue(freqtype, frequencyValue, effectivedate) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (!freqtype || freqtype === 'Always') return null
  if (freqtype === 'Fixed Day of Month') {
    const day = parseInt(frequencyValue); if (!day) return null
    let c = new Date(today.getFullYear(), today.getMonth(), day)
    if (c < today) c = new Date(today.getFullYear(), today.getMonth() + 1, day)
    return c
  }
  if (freqtype === 'Every N Days') {
    const n = parseInt(frequencyValue); if (!n || !effectivedate) return null
    let cursor = parseISO(effectivedate); cursor.setHours(0, 0, 0, 0)
    if (cursor < today) {
      const delta = Math.ceil((today - cursor) / (n * 86400000))
      cursor = addDays(cursor, delta * n)
    }
    return cursor
  }
  return null
}

function freqLabel(freqtype, frequencyValue) {
  if (!freqtype) return null
  if (freqtype === 'Always') return 'Always'
  if (freqtype === 'Fixed Day of Month') return `Recurring: Day ${frequencyValue}`
  if (freqtype === 'Every N Days') return `Recurring: Every ${frequencyValue}d`
  return freqtype
}

// ── Income actual cell (set or add) ──────────────────────────────────────────
function IncomeActualCell({ value, onSet, onAdd }) {
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState('')

  const save = () => {
    const n = parseFloat(draft)
    if (!isNaN(n)) mode === 'set' ? onSet(n) : onAdd(n)
    setMode(null); setDraft('')
  }

  if (mode) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-gray-400">{mode === 'add' ? '+' : '='}</span>
        <input autoFocus type="number" step="0.01" min="0" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setMode(null); setDraft('') } }}
          onBlur={save}
          className="w-24 rounded border border-dosh-400 px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-dosh-500 dark:bg-gray-800 dark:text-white"
          placeholder="0.00" />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 group">
      <span onClick={() => { setDraft(String(Number(value ?? 0))); setMode('set') }}
        className="cursor-pointer rounded px-1.5 py-0.5 bg-dosh-50 border border-dosh-200 hover:border-dosh-400 text-dosh-800 font-medium transition-colors dark:bg-dosh-900/30 dark:border-dosh-700 dark:text-dosh-300"
        title="Click to set">
        {fmt(value ?? 0)}
      </span>
      <button onClick={() => { setDraft(''); setMode('add') }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-dosh-500 hover:bg-dosh-100 dark:hover:bg-dosh-900/40"
        title="Add to total">
        <PlusIcon className="w-3 h-3" />
      </button>
    </span>
  )
}

// ── Expense Entry Modal (view + add + delete entries) ─────────────────────────
function ExpenseEntriesModal({ periodId, budgetId, expensedesc, budgetamount, actualamount, locked, onClose, defaultType = 'debit' }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType) // 'debit' | 'credit'

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['expense-entries', periodId, expensedesc],
    queryFn: () => getExpenseEntries(periodId, expensedesc),
  })

  const add = useMutation({
    mutationFn: data => addExpenseEntry(periodId, expensedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount(''); setNote('')
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: entryId => deleteExpenseEntry(periodId, expensedesc, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
    },
  })

  const handleAdd = e => {
    e.preventDefault()
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) return
    add.mutate({ amount: type === 'debit' ? n : -n, note: note || null })
  }

  const runningTotal = entries.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[
          { label: 'Budget', value: budgetamount, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: actualamount, cls: 'text-dosh-700 dark:text-dosh-400 font-bold' },
          { label: 'Variance', value: Number(budgetamount) - Number(actualamount), cls: Number(budgetamount) - Number(actualamount) >= 0 ? 'text-dosh-600' : 'text-red-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card p-2">
            <p className="text-gray-400">{label}</p>
            <p className={`font-semibold ${cls}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Entry list */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex justify-between">
          <span>Transactions</span>
          <span>{entries.length} entries</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner className="w-4 h-4" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4 italic">No transactions yet</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-52 overflow-y-auto">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-2 px-3 py-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${Number(entry.amount) >= 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400'}`}>
                  {Number(entry.amount) >= 0 ? '+' : '−'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${Number(entry.amount) >= 0 ? 'text-red-700 dark:text-red-400' : 'text-dosh-700 dark:text-dosh-400'}`}>
                    {fmt(Math.abs(entry.amount))}
                  </p>
                  {entry.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.note}</p>}
                  <p className="text-xs text-gray-400">{format(parseISO(entry.entrydate), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {!locked && (
                  <button onClick={() => remove.mutate(entry.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {entries.length > 0 && (
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">Total</span>
            <span className={runningTotal >= 0 ? 'text-red-700 dark:text-red-400' : 'text-dosh-600 dark:text-dosh-400'}>{fmt(runningTotal)}</span>
          </div>
        )}
      </div>

      {/* Add entry form */}
      {!locked && (
        <form onSubmit={handleAdd} className="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add Transaction</p>
          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
            {[['debit', 'Expense (+)', 'text-red-600'], ['credit', 'Refund (−)', 'text-dosh-600']].map(([val, label, cls]) => (
              <button key={val} type="button" onClick={() => setType(val)}
                className={`flex-1 py-1.5 font-medium transition-colors ${type === val ? (val === 'debit' ? 'bg-red-600 text-white' : 'bg-dosh-600 text-white') : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input type="number" step="0.01" min="0.01" required value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="Amount"
              className="input flex-1" />
            {Number(budgetamount) > 0 && (
              <button type="button"
                onClick={() => setAmount(String(Number(budgetamount)))}
                className="text-xs btn-secondary whitespace-nowrap"
                title="Allocate full budget amount">
                Full ({fmt(budgetamount)})
              </button>
            )}
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)" className="input flex-[2]" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" disabled={add.isPending}
              className={type === 'debit' ? 'btn-danger' : 'btn-primary'}>
              {add.isPending ? 'Saving…' : `Add ${type === 'debit' ? 'Expense' : 'Refund'}`}
            </button>
          </div>
        </form>
      )}
      {locked && (
        <div className="flex justify-end">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  )
}

// ── Investment Transaction Modal ──────────────────────────────────────────────
function InvestmentTxModal({ periodId, budgetId, investmentdesc, openingValue, closingValue, budgetedAmount, locked, onClose }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState('increase')
  const [linkedIncome, setLinkedIncome] = useState('')

  const { data: incomeTypes = [] } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })
  const savingsIncomes = incomeTypes.filter(i => i.issavings)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['investment-tx', periodId, investmentdesc],
    queryFn: () => getInvestmentTransactions(periodId, investmentdesc),
  })

  const add = useMutation({
    mutationFn: data => addInvestmentTransaction(periodId, investmentdesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount(''); setNote(''); setLinkedIncome('')
    },
  })

  const remove = useMutation({
    mutationFn: txId => deleteInvestmentTransaction(periodId, investmentdesc, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
    },
  })

  const handleAdd = e => {
    e.preventDefault()
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) return
    add.mutate({ amount: type === 'increase' ? n : -n, note: note || null, linked_incomedesc: linkedIncome || null })
  }

  // Derive actual from transactions total for live display
  const txTotal = transactions.reduce((s, t) => s + Number(t.amount), 0)
  const liveRemaining = Number(budgetedAmount ?? 0) - txTotal

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[
          { label: 'Budget', value: budgetedAmount ?? 0, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: txTotal, cls: 'text-dosh-700 dark:text-dosh-400 font-bold' },
          { label: 'Remaining', value: liveRemaining, cls: liveRemaining >= 0 ? 'text-dosh-600' : 'text-red-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card p-2">
            <p className="text-gray-400">{label}</p>
            <p className={`font-semibold ${cls}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex justify-between">
          <span>Transactions</span>
          <span>{transactions.length} entries</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner className="w-4 h-4" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4 italic">No transactions yet</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-52 overflow-y-auto">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-2 px-3 py-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${Number(tx.amount) >= 0
                    ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                  {Number(tx.amount) >= 0 ? '+' : '−'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${Number(tx.amount) >= 0 ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400'}`}>
                    {fmt(Math.abs(tx.amount))}
                  </p>
                  {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.note}</p>}
                  <p className="text-xs text-gray-400">{format(parseISO(tx.entrydate), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {!locked && (
                  <button onClick={() => remove.mutate(tx.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!locked && (
        <form onSubmit={handleAdd} className="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add Transaction</p>
          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
            {[['increase', 'Increase (+)', 'text-dosh-600'], ['decrease', 'Decrease (−)', 'text-red-600']].map(([val, label, cls]) => (
              <button key={val} type="button" onClick={() => setType(val)}
                className={`flex-1 py-1.5 font-medium transition-colors ${type === val ? (val === 'increase' ? 'bg-dosh-600 text-white' : 'bg-red-600 text-white') : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" step="0.01" min="0.01" required value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="Amount"
              className="input flex-1" />
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)" className="input flex-[2]" />
          </div>
          {savingsIncomes.length > 0 && (
            <div>
              <label className="label">Link to Savings Income (optional)</label>
              <select className="input" value={linkedIncome} onChange={e => setLinkedIncome(e.target.value)}>
                <option value="">— none —</option>
                {savingsIncomes.map(i => <option key={i.incomedesc} value={i.incomedesc}>{i.incomedesc}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">If selected, the linked income actual will also be updated.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" disabled={add.isPending}
              className={type === 'increase' ? 'btn-primary' : 'btn-danger'}>
              {add.isPending ? 'Saving…' : `Add ${type === 'increase' ? 'Increase' : 'Decrease'}`}
            </button>
          </div>
        </form>
      )}
      {locked && (
        <div className="flex justify-end">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  )
}

// ── Inline Budget / Movement Cell (click to edit) ────────────────────────────
function BudgetEditCell({ value, onSave, allowNegative = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const save = () => {
    const n = parseFloat(draft)
    if (!isNaN(n)) onSave(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input autoFocus type="number" step="0.01" min={allowNegative ? undefined : '0'} value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={save}
        className="w-24 rounded border border-dosh-400 px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-dosh-500 dark:bg-gray-800 dark:text-white" />
    )
  }

  return (
    <span onClick={() => { setDraft(String(Number(value ?? 0))); setEditing(true) }}
      className="cursor-pointer rounded px-1.5 py-0.5 text-gray-600 dark:text-gray-400 border border-transparent hover:border-dosh-300 hover:bg-dosh-50 dark:hover:bg-dosh-900/20 transition-colors"
      title="Click to edit">
      {fmt(value ?? 0)}
    </span>
  )
}

// ── Expense Note Modal ────────────────────────────────────────────────────────
function ExpenseNoteModal({ periodId, expensedesc, initialNote, onClose }) {
  const qc = useQueryClient()
  const [note, setNote] = useState(initialNote ?? '')

  const save = useMutation({
    mutationFn: () => updateExpenseNote(periodId, expensedesc, note.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); onClose() },
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{expensedesc}</p>
      <textarea
        className="input w-full resize-none"
        rows={5}
        placeholder="Add a note…"
        value={note}
        onChange={e => setNote(e.target.value)}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}


// ── Add Income Modal ──────────────────────────────────────────────────────────
function AddIncomeModal({ periodId, budgetId, existingDescs, onClose }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('existing') // 'existing' | 'savings'
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [scope, setScope] = useState('oneoff')
  const [error, setError] = useState('')

  const { data: incomeTypes = [] } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
    enabled: mode === 'savings',
  })

  const available = incomeTypes.filter(i => !existingDescs.includes(i.incomedesc))

  // Savings accounts not yet transferred in this period
  const savingsAccounts = balanceTypes.filter(bt =>
    bt.balance_type === 'Savings' &&
    !existingDescs.includes(`Transfer from ${bt.balancedesc}`)
  )

  const currentList = mode === 'savings' ? savingsAccounts : available

  const add = useMutation({
    mutationFn: data => addIncomeToPeriod(periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to add income'),
  })

  const addTransfer = useMutation({
    mutationFn: data => savingsTransfer(periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to record transfer'),
  })

  const isPending = add.isPending || addTransfer.isPending

  const handleSubmit = e => {
    e.preventDefault(); setError('')
    if (!selected) { setError(mode === 'savings' ? 'Select a savings account' : 'Select an income type'); return }
    if (mode === 'savings') {
      addTransfer.mutate({ budgetid: budgetId, balancedesc: selected, amount: parseFloat(amount) || 0 })
    } else {
      add.mutate({ budgetid: budgetId, incomedesc: selected, budgetamount: parseFloat(amount) || 0, scope })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
        {[['existing', 'Existing income'], ['savings', 'Transfer from Savings']].map(([val, label]) => (
          <button key={val} type="button" onClick={() => { setMode(val); setSelected(''); setAmount('') }}
            className={`flex-1 py-1.5 font-medium transition-colors ${mode === val ? 'bg-dosh-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>
      <div>
        <label className="label">{mode === 'savings' ? 'Savings Account' : 'Income Type'}</label>
        {currentList.length === 0
          ? <p className="text-sm text-gray-500 italic">
              {mode === 'savings' ? 'No savings accounts available. Add a Savings account in budget settings.' : 'All income types already in this period.'}
            </p>
          : <select required className="input" value={selected} onChange={e => {
              setSelected(e.target.value)
              if (mode !== 'savings') {
                const it = incomeTypes.find(i => i.incomedesc === e.target.value)
                if (it?.isfixed) setAmount(String(it.amount))
              }
            }}>
              <option value="">— select —</option>
              {mode === 'savings'
                ? currentList.map(bt => <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>)
                : currentList.map(i => <option key={i.incomedesc} value={i.incomedesc}>{i.incomedesc}</option>)}
            </select>}
      </div>
      <div>
        <label className="label">{mode === 'savings' ? 'Budget Amount ($)' : 'Budget Amount ($)'}</label>
        <input type="number" step="0.01" min="0" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      {mode === 'existing' && (
        <div>
          <label className="label">Include in</label>
          <div className="space-y-1.5 mt-1">
            {[['oneoff', 'This period only'], ['future', 'This + future unlocked periods']].map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="income-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isPending || currentList.length === 0}>{isPending ? 'Adding…' : 'Add'}</button>
      </div>
    </form>
  )
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ periodId, budgetId, existingDescs, onClose }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('existing')
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [scope, setScope] = useState('oneoff')
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFreqtype, setNewFreqtype] = useState('Fixed Day of Month')
  const [newFreqVal, setNewFreqVal] = useState('')
  const [newPaytype, setNewPaytype] = useState('MANUAL')
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
      if (mode === 'new') {
        if (!newDesc.trim()) { setError('Enter a description'); return }
        await createItem.mutateAsync({ expensedesc: newDesc.trim(), active: true, freqtype: newFreqtype || null, frequency_value: newFreqVal ? parseInt(newFreqVal) : null, paytype: newPaytype || null, effectivedate: newEffDate || null, expenseamount: parseFloat(amount) || 0 })
        addToperiod.mutate({ budgetid: budgetId, expensedesc: newDesc.trim(), budgetamount: parseFloat(amount) || 0, scope })
      } else {
        if (!selected) { setError('Select an expense item'); return }
        addToperiod.mutate({ budgetid: budgetId, expensedesc: selected, budgetamount: parseFloat(amount) || 0, scope })
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
          <label className="label">Expense Item</label>
          {available.length === 0
            ? <p className="text-sm text-gray-500 italic">All items already in this period. Use "New item".</p>
            : <select required className="input" value={selected} onChange={e => { setSelected(e.target.value); const ei = expenseItems.find(i => i.expensedesc === e.target.value); if (ei) setAmount(String(ei.expenseamount)) }}>
                <option value="">— select —</option>
                {available.map(e => <option key={e.expensedesc} value={e.expensedesc}>{e.expensedesc}</option>)}
              </select>}
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="label">Description <span className="text-red-500">*</span></label><input required className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Netflix" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Freq Type</label><select className="input" value={newFreqtype} onChange={e => setNewFreqtype(e.target.value)}><option>Always</option><option>Fixed Day of Month</option><option>Every N Days</option></select></div>
            <div><label className="label">{newFreqtype === 'Every N Days' ? 'Interval (days)' : 'Day of Month'}</label><input type="number" min="1" className="input" value={newFreqVal} onChange={e => setNewFreqVal(e.target.value)} disabled={newFreqtype === 'Always'} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Pay Type</label><select className="input" value={newPaytype} onChange={e => setNewPaytype(e.target.value)}><option>AUTO</option><option>MANUAL</option></select></div>
            <div><label className="label">Eff. Date</label><input type="date" className="input" value={newEffDate} onChange={e => setNewEffDate(e.target.value)} /></div>
          </div>
        </div>
      )}
      <div><label className="label">Budget Amount ($)</label><input type="number" step="0.01" min="0" className="input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div>
        <label className="label">Include in</label>
        <div className="space-y-1.5 mt-1">
          {[['oneoff', 'This period only (one-off)'], ['future', 'This + future unlocked periods']].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="exp-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
              {label}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PeriodDetailPage() {
  const { periodId } = useParams()
  const id = parseInt(periodId)
  const qc = useQueryClient()
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [entriesModal, setEntriesModal] = useState(null) // { expensedesc, budgetamount, actualamount }
  const [noteModal, setNoteModal] = useState(null) // { expensedesc, note }

  const [investmentModal, setInvestmentModal] = useState(null)

  const [localExpenses, setLocalExpenses] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragSrc = useRef(null)

  const { data, isLoading, isError } = useQuery({ queryKey: ['period', id], queryFn: () => getPeriodDetail(id) })
  const { data: budget } = useQuery({
    queryKey: ['budget', data?.period?.budgetid],
    queryFn: () => getBudget(data.period.budgetid),
    enabled: !!data?.period?.budgetid,
  })

  const lock = useMutation({ mutationFn: islocked => setPeriodLock(id, islocked), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const setIncome = useMutation({ mutationFn: ({ desc, val }) => updateIncomeActual(id, desc, val), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const addIncome = useMutation({ mutationFn: ({ desc, val }) => addToIncomeActual(id, desc, val), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const updateBalance = useMutation({ mutationFn: ({ desc, movement }) => updatePeriodBalance(id, desc, movement), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const setExpenseStatus = useMutation({ mutationFn: ({ desc, status }) => setPeriodExpenseStatus(id, desc, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const editExpenseBudget = useMutation({ mutationFn: ({ desc, budgetamount }) => updatePeriodExpenseBudget(id, desc, budgetamount), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const deleteExpenseLine = useMutation({ mutationFn: desc => removePeriodExpense(id, desc), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const deleteIncomeLine = useMutation({ mutationFn: desc => removePeriodIncome(id, desc), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const editInvBudget = useMutation({ mutationFn: ({ desc, budgetamount }) => updatePeriodInvestmentBudget(id, desc, budgetamount), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })

  // Reset local drag-reorder when server data refreshes
  useEffect(() => { setLocalExpenses(null) }, [data])

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (isError) return <p className="text-red-500 p-4">Failed to load period. <Link to="/budgets" className="underline">Back to Budgets</Link></p>
  if (!data) return <p className="text-gray-500">Period not found.</p>

  const { period, incomes, balances = [], investments = [] } = data
  const expenses = localExpenses ?? data.expenses

  const handleDragStart = (desc) => { dragSrc.current = desc }
  const handleDragOver  = (e, desc) => { e.preventDefault(); setDragOver(desc) }
  const handleDragLeave = () => setDragOver(null)
  const handleDrop = (e, targetDesc) => {
    e.preventDefault()
    setDragOver(null)
    const src = dragSrc.current
    if (!src || src === targetDesc) return
    const cur = [...expenses]
    const si = cur.findIndex(x => x.expensedesc === src)
    const ti = cur.findIndex(x => x.expensedesc === targetDesc)
    const [moved] = cur.splice(si, 1)
    cur.splice(ti, 0, moved)
    setLocalExpenses(cur)
    const items = cur.map((x, i) => ({ expensedesc: x.expensedesc, sort_order: i }))
    reorderPeriodExpenses(id, items).catch(() => setLocalExpenses(null))
  }
  const locked = period.islocked

  const totalIncomeBudget    = incomes.reduce((s, i) => s + Number(i.budgetamount), 0)
  const totalIncomeActual    = incomes.reduce((s, i) => s + Number(i.actualamount), 0)
  const totalExpenseBudget   = expenses.reduce((s, e) => s + Number(e.budgetamount), 0)
  const totalExpenseActual   = expenses.reduce((s, e) => s + Number(e.actualamount), 0)
  const totalExpenseRemaining = expenses.reduce((s, e) => s + Number(e.remaining_amount ?? 0), 0)
  const surplusBudget = totalIncomeBudget - totalExpenseBudget
  const surplusActual = totalIncomeActual - totalExpenseActual

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link to="/budgets" className="hover:underline">Budgets</Link>
            <ChevronRightIcon className="w-3 h-3" />
            {budget && <Link to={`/budgets/${budget.budgetid}`} className="hover:underline">{budget.description}</Link>}
            <ChevronRightIcon className="w-3 h-3" />
            <span className="text-gray-800 dark:text-gray-200">Expense Tracking</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {format(parseISO(period.startdate), 'dd MMM yyyy')} – {format(parseISO(period.enddate), 'dd MMM yyyy')}
          </h1>
          {budget && <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budget_frequency} · {budget.budgetowner}</p>}
        </div>
        <button className="btn-secondary" onClick={() => lock.mutate(!locked)} title={locked ? 'Unlock' : 'Lock'}>
          {locked ? <><LockClosedIcon className="w-4 h-4 text-amber-500" /> Locked</> : <><LockOpenIcon className="w-4 h-4" /> Unlocked</>}
        </button>
      </div>

      {locked && (
        <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          Period is locked. Income actuals can still be updated. To add expense transactions, unlock first.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Income Budget',  value: totalIncomeBudget,  cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Income Actual',  value: totalIncomeActual,  cls: 'text-dosh-700 dark:text-dosh-400' },
          { label: 'Expense Budget', value: totalExpenseBudget, cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Expense Actual', value: totalExpenseActual, cls: 'text-red-700 dark:text-red-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[{ label: 'Surplus (Budget)', value: surplusBudget }, { label: 'Surplus (Actual)', value: surplusActual }].map(({ label, value }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-lg font-bold ${value >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Income */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Income</span>
          {!locked && (
            <button className="btn-secondary text-xs" onClick={() => setShowAddIncome(true)}>
              <PlusIcon className="w-3.5 h-3.5" /> Add New Income Line Item
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="table-header-cell text-left">Description</th>
              <th className="table-header-cell text-right col-budget">Budget</th>
              <th className="table-header-cell text-right col-actual">Actual ✎</th>
              <th className="table-header-cell text-right">Variance</th>
              <th className="table-header-cell"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {incomes.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 italic text-sm">No income entries</td></tr>}
            {incomes.map(i => (
              <tr key={i.incomedesc} className="table-row">
                <td className="table-cell font-medium">{i.incomedesc}</td>
                <td className="table-cell-muted text-right col-budget">{fmt(i.budgetamount)}</td>
                <td className="table-cell text-right col-actual">
                  <IncomeActualCell value={i.actualamount} onSet={val => setIncome.mutate({ desc: i.incomedesc, val })} onAdd={val => addIncome.mutate({ desc: i.incomedesc, val })} />
                </td>
                <td className="table-cell text-right">
                  <span className={`font-medium ${Number(i.actualamount) >= Number(i.budgetamount) ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>
                    {fmt(Number(i.actualamount) - Number(i.budgetamount))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {!locked && (
                    <button
                      onClick={() => { if (window.confirm(`Remove "${i.incomedesc}" from this period?`)) deleteIncomeLine.mutate(i.incomedesc) }}
                      title="Remove from period"
                      className="flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Income</td>
              <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(totalIncomeBudget)}</td>
              <td className="px-4 py-2 text-right text-dosh-700 dark:text-dosh-400 text-sm">{fmt(totalIncomeActual)}</td>
              <td className="px-4 py-2 text-right text-sm">
                <span className={totalIncomeActual >= totalIncomeBudget ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}>{fmt(totalIncomeActual - totalIncomeBudget)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expenses */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Expenses</span>
          {!locked && (
            <button className="btn-secondary text-xs" onClick={() => setShowAddExpense(true)}>
              <PlusIcon className="w-3.5 h-3.5" /> Add New Expense Line Item
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="w-6 px-2"></th>
                <th className="table-header-cell text-left">Description</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">
                  <span title="Sum of all transactions — read-only">Actual ∑</span>
                </th>
                <th className="table-header-cell text-right">Remaining</th>
                <th className="table-header-cell text-left">Schedule</th>
                <th className="table-header-cell text-center">Status / Txns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {expenses.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-400 italic text-sm">No expense line items</td></tr>}
              {expenses.map(e => {
                const remaining = Number(e.remaining_amount ?? 0)
                const label = e.is_oneoff ? null : freqLabel(e.freqtype, e.frequency_value)
                const nextDue = e.is_oneoff ? null : calcNextDue(e.freqtype, e.frequency_value, e.effectivedate)
                const isOver = dragOver === e.expensedesc
                const canDelete = !locked && Number(e.actualamount) === 0 && Number(e.budgetamount) === 0
                const canEditBudget = !locked && (e.freqtype === 'Always' || e.is_oneoff)
                const nextStatus = e.status === 'Current' ? 'Paid' : e.status === 'Paid' ? 'Revised' : 'Current'
                const statusCls = e.status === 'Paid' ? 'badge-green' : e.status === 'Revised' ? 'badge-amber' : 'badge-gray'
                return (
                  <tr
                    key={e.expensedesc}
                    draggable
                    onDragStart={() => handleDragStart(e.expensedesc)}
                    onDragOver={ev => handleDragOver(ev, e.expensedesc)}
                    onDragLeave={handleDragLeave}
                    onDrop={ev => handleDrop(ev, e.expensedesc)}
                    className={`table-row transition-colors ${isOver ? 'bg-dosh-50 dark:bg-dosh-900/20 border-t-2 border-dosh-400' : ''}`}
                  >
                    <td className="w-6 px-2 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing">
                      <Bars2Icon className="w-4 h-4" />
                    </td>
                    <td className="table-cell font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{e.expensedesc}</span>
                        <button
                          onClick={() => setNoteModal({ expensedesc: e.expensedesc, note: e.note ?? '' })}
                          title={e.note ? 'View/edit note' : 'Add note'}
                          className={`flex-shrink-0 transition-colors ${e.note ? 'text-dosh-500 dark:text-dosh-400 hover:text-dosh-700' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}>
                          <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="table-cell-muted text-right col-budget">
                      {canEditBudget ? (
                        <BudgetEditCell value={e.budgetamount} onSave={val => editExpenseBudget.mutate({ desc: e.expensedesc, budgetamount: val })} />
                      ) : fmt(e.budgetamount)}
                    </td>
                    <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">
                      {fmt(e.actualamount)}
                    </td>
                    <td className="table-cell text-right">
                      {e.status === 'Paid' ? (
                        <span className="font-medium text-dosh-600 dark:text-dosh-400">Paid</span>
                      ) : (
                        <span className={`font-medium ${remaining >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmt(remaining)}
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {e.is_oneoff ? <span className="badge-amber">One-off</span> : label ? <span className="badge-blue" title={nextDue ? `Next: ${format(nextDue, 'dd MMM yyyy')}` : undefined}>{label}</span> : <span className="badge-gray">—</span>}
                        {e.paytype && <span className={e.paytype === 'AUTO' ? 'badge-green' : 'badge-gray'}>{e.paytype}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => setExpenseStatus.mutate({ desc: e.expensedesc, status: nextStatus })}
                          title={`Status: ${e.status} → click to mark ${nextStatus}`}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium cursor-pointer ${statusCls}`}>
                          {e.status}
                        </button>
                        <button
                          disabled={locked}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit' })}
                          title="Add expense transaction"
                          className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${locked ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60'}`}>
                          <PlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          disabled={locked}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'credit' })}
                          title="Add refund/credit"
                          className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${locked ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60'}`}>
                          <MinusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit' })}
                          title="View transactions"
                          className="flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <ListBulletIcon className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => { if (window.confirm(`Remove "${e.expensedesc}" from this period?`)) deleteExpenseLine.mutate(e.expensedesc) }}
                            title="Remove from period (no actuals, zero budget)"
                            className="flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
                <td />
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Expenses</td>
                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(totalExpenseBudget)}</td>
                <td className="px-4 py-2 text-right text-red-700 dark:text-red-400 text-sm">{fmt(totalExpenseActual)}</td>
                <td className="px-4 py-2 text-right text-sm">
                  <span className={`font-medium ${totalExpenseRemaining >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalExpenseRemaining)}</span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Investments */}
      {investments.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm">Investments</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header-cell text-left">Investment</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">Actual ∑</th>
                <th className="table-header-cell text-right">Remaining</th>
                <th className="table-header-cell text-left">Account</th>
                <th className="table-header-cell text-center">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {investments.map(inv => {
                const remaining = Number(inv.remaining_amount ?? 0)
                return (
                  <tr key={inv.investmentdesc} className="table-row">
                    <td className="table-cell font-medium">{inv.investmentdesc}</td>
                    <td className="table-cell-muted text-right col-budget">
                      {!locked ? (
                        <BudgetEditCell value={inv.budgeted_amount} onSave={val => editInvBudget.mutate({ desc: inv.investmentdesc, budgetamount: val })} />
                      ) : fmt(inv.budgeted_amount)}
                    </td>
                    <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(inv.actualamount)}</td>
                    <td className="table-cell text-right">
                      <span className={`font-medium ${remaining >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</span>
                    </td>
                    <td className="table-cell-muted text-sm">
                      {inv.linked_account_desc ? <span className="text-purple-600 dark:text-purple-400">{inv.linked_account_desc}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={locked}
                          onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase' })}
                          title="Add contribution"
                          className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${locked ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60'}`}>
                          <PlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase' })}
                          title="View transactions"
                          className="flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <ListBulletIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Balances */}
      {balances.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm">Account Balances</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header-cell text-left">Account</th>
                <th className="table-header-cell text-left">Type</th>
                <th className="table-header-cell text-right">Opening</th>
                <th className="table-header-cell text-right col-actual">Movement ✎</th>
                <th className="table-header-cell text-right">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {balances.map(b => {
                const closing = Number(b.opening_amount) + Number(b.movement_amount ?? 0)
                return (
                  <tr key={b.balancedesc} className="table-row">
                    <td className="table-cell font-medium">{b.balancedesc}</td>
                    <td className="table-cell-muted">{b.balance_type || '—'}</td>
                    <td className="table-cell-muted text-right">{fmt(b.opening_amount)}</td>
                    <td className="table-cell text-right col-actual">
                      {!locked ? (
                        <BudgetEditCell value={b.movement_amount ?? 0} onSave={val => updateBalance.mutate({ desc: b.balancedesc, movement: val })} allowNegative />
                      ) : <span className={`font-medium ${Number(b.movement_amount ?? 0) >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(b.movement_amount ?? 0)}</span>}
                    </td>
                    <td className="table-cell text-right">
                      <span className={`font-medium ${closing >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(closing)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {entriesModal && (
        <Modal title={`Transactions — ${entriesModal.expensedesc}`} onClose={() => setEntriesModal(null)} size="lg">
          <ExpenseEntriesModal
            periodId={id}
            budgetId={period.budgetid}
            expensedesc={entriesModal.expensedesc}
            budgetamount={entriesModal.budgetamount}
            actualamount={entriesModal.actualamount}
            locked={locked}
            defaultType={entriesModal.defaultType ?? 'debit'}
            onClose={() => setEntriesModal(null)}
          />
        </Modal>
      )}
      {showAddExpense && (
        <Modal title="Add Expense to Period" onClose={() => setShowAddExpense(false)} size="lg">
          <AddExpenseModal periodId={id} budgetId={period.budgetid} existingDescs={expenses.map(e => e.expensedesc)} onClose={() => setShowAddExpense(false)} />
        </Modal>
      )}
      {showAddIncome && (
        <Modal title="Add Income to Period" onClose={() => setShowAddIncome(false)}>
          <AddIncomeModal periodId={id} budgetId={period.budgetid} existingDescs={incomes.map(i => i.incomedesc)} onClose={() => setShowAddIncome(false)} />
        </Modal>
      )}
      {noteModal && (
        <Modal title="Expense Note" onClose={() => setNoteModal(null)}>
          <ExpenseNoteModal periodId={id} expensedesc={noteModal.expensedesc} initialNote={noteModal.note} onClose={() => setNoteModal(null)} />
        </Modal>
      )}
      {investmentModal && (
        <Modal title={`Transactions — ${investmentModal.investmentdesc}`} onClose={() => setInvestmentModal(null)} size="lg">
          <InvestmentTxModal
            periodId={id}
            budgetId={period.budgetid}
            investmentdesc={investmentModal.investmentdesc}
            openingValue={investmentModal.openingValue}
            closingValue={investmentModal.closingValue}
            budgetedAmount={investmentModal.budgetedAmount}
            locked={locked}
            onClose={() => setInvestmentModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
