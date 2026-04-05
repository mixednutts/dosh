import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays } from 'date-fns'
import {
  LockClosedIcon, LockOpenIcon, ChevronRightIcon, PlusIcon,
  MinusIcon, TrashIcon, ListBulletIcon, Bars2Icon,
} from '@heroicons/react/24/outline'
import {
  getPeriodDetail, getBudget, setPeriodLock,
  getIncomeTransactions, addIncomeTransaction, deleteIncomeTransaction,
  addExpenseToPeriod, addIncomeToPeriod, savingsTransfer,
  getExpenseItems, getIncomeTypes, createExpenseItem,
  getExpenseEntries, addExpenseEntry, deleteExpenseEntry,
  reorderPeriodExpenses, getBalanceTransactions,
  getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction,
  setPeriodExpenseStatus, updatePeriodExpenseBudget, removePeriodExpense,
  updatePeriodInvestmentBudget, getBalanceTypes, removePeriodIncome, updatePeriodIncomeBudget,
  setPeriodInvestmentStatus, getPeriodCloseoutPreview, closeOutPeriod,
} from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const fmt = v => Number(v ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function balanceTransactionDelta(tx, balancedesc) {
  if (tx.source === 'transfer') {
    if (tx.affected_account_desc === balancedesc) return Number(tx.amount ?? 0)
    if (tx.related_account_desc === balancedesc) return -Number(tx.amount ?? 0)
    return 0
  }
  if (tx.affected_account_desc !== balancedesc) return 0
  if (tx.source === 'expense') return -Number(tx.amount ?? 0)
  return Number(tx.amount ?? 0)
}

function balanceTransactionLabel(tx, balancedesc) {
  if (tx.source === 'transfer') {
    if (tx.affected_account_desc === balancedesc) {
      return tx.related_account_desc ? `Transfer from ${tx.related_account_desc}` : 'Transfer in'
    }
    if (tx.related_account_desc === balancedesc) {
      return tx.affected_account_desc ? `Transfer to ${tx.affected_account_desc}` : 'Transfer out'
    }
  }

  if (tx.source === 'expense') return `Expense: ${tx.source_label || tx.source_key || 'Unknown'}`
  if (tx.source === 'investment') return `Investment: ${tx.source_label || tx.source_key || 'Unknown'}`
  if (tx.source === 'income') return `Income: ${tx.source_label || tx.source_key || 'Unknown'}`
  if (tx.source === 'balance') return `System: ${tx.source_label || tx.source_key || 'Balance adjustment'}`
  return tx.source_label || tx.source_key || tx.source
}

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

function IncomeTransactionsModal({ periodId, incomedesc, budgetamount, actualamount, locked, onClose, defaultType = 'credit' }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType) // credit | debit

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['income-transactions', periodId, incomedesc],
    queryFn: () => getIncomeTransactions(periodId, incomedesc),
  })

  const add = useMutation({
    mutationFn: data => addIncomeTransaction(periodId, incomedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount('')
      setNote('')
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: txId => deleteIncomeTransaction(periodId, incomedesc, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
    },
  })

  const handleAdd = e => {
    e.preventDefault()
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) return
    add.mutate({ amount: type === 'credit' ? n : -n, note: note || null })
  }

  const runningTotal = transactions
    .filter(tx => tx.entry_kind !== 'budget_adjustment')
    .reduce((s, tx) => s + Number(tx.amount), 0)
  const variance = Number(actualamount) - Number(budgetamount)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[
          { label: 'Budget', value: budgetamount, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: actualamount, cls: 'text-success-700 dark:text-success-400 font-bold' },
          { label: 'Variance', value: variance, cls: variance >= 0 ? 'text-success-600' : 'text-red-600' },
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
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                  ${tx.entry_kind === 'budget_adjustment'
                    ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-300'
                    : Number(tx.amount) >= 0
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                  {tx.entry_kind === 'budget_adjustment' ? 'Adj' : Number(tx.amount) >= 0 ? '+' : '−'}
                </span>
                <div className="flex-1 min-w-0">
                  {tx.entry_kind === 'budget_adjustment' ? (
                    <p className="text-sm font-medium text-dosh-700 dark:text-dosh-300">
                      Budget {fmt(tx.budget_before_amount)} {'->'} {fmt(tx.budget_after_amount)}
                    </p>
                  ) : (
                    <p className={`text-sm font-medium ${Number(tx.amount) >= 0 ? 'text-success-700 dark:text-success-400' : 'text-red-700 dark:text-red-400'}`}>
                      {fmt(Math.abs(tx.amount))}
                    </p>
                  )}
                  {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.note}</p>}
                  <p className="text-xs text-gray-400">{format(parseISO(tx.entrydate), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {!locked && tx.entry_kind !== 'budget_adjustment' && (
                  <button onClick={() => remove.mutate(tx.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {transactions.length > 0 && (
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">Total</span>
            <span className={runningTotal >= 0 ? 'text-success-700 dark:text-success-400' : 'text-red-700 dark:text-red-400'}>{fmt(runningTotal)}</span>
          </div>
        )}
      </div>

      {!locked && (
        <form onSubmit={handleAdd} className="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add Transaction</p>
          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
            {[['credit', 'Income (+)'], ['debit', 'Correction (−)']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setType(val)}
                className={`flex-1 py-1.5 font-medium transition-colors ${type === val ? (val === 'credit' ? 'bg-success-600 text-white' : 'bg-red-600 text-white') : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
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
              className={type === 'credit' ? 'btn-primary' : 'btn-danger'}>
              {add.isPending ? 'Saving…' : (type === 'credit' ? 'Add Income' : 'Add Correction')}
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

function BalanceTransactionsModal({ periodId, balancedesc, movementAmount }) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['balance-transactions', periodId, balancedesc],
    queryFn: () => getBalanceTransactions(periodId, balancedesc),
  })

  const runningTotal = transactions.reduce((sum, tx) => sum + balanceTransactionDelta(tx, balancedesc), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs text-center">
        {[
          { label: 'Movement', value: movementAmount, cls: Number(movementAmount ?? 0) >= 0 ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400' },
          { label: 'Transactions Total', value: runningTotal, cls: runningTotal >= 0 ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card p-2">
            <p className="text-gray-400">{label}</p>
            <p className={`font-semibold ${cls}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex justify-between">
          <span>Movement Details</span>
          <span>{transactions.length} rows</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner className="w-4 h-4" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4 italic">No supporting transactions for this account in this budget cycle</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {transactions.map(tx => {
              const delta = balanceTransactionDelta(tx, balancedesc)
              const isPositive = delta >= 0
              return (
                <div key={tx.id} className="flex items-start gap-3 px-3 py-2">
                  <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isPositive
                      ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  }`}>
                    {isPositive ? '+' : '−'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{balanceTransactionLabel(tx, balancedesc)}</p>
                      <span className="badge-gray">{tx.type}</span>
                      {tx.is_system && <span className="badge-amber">System</span>}
                    </div>
                    {tx.system_reason && <p className="text-xs text-amber-700 dark:text-amber-400">{tx.system_reason}</p>}
                    {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400">{tx.note}</p>}
                    <p className="text-xs text-gray-400">{format(parseISO(tx.entrydate), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                  <div className={`text-sm font-semibold ${isPositive ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400'}`}>
                    {fmt(Math.abs(delta))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
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

  const runningTotal = entries.filter(entry => entry.entry_kind !== 'budget_adjustment').reduce((s, e) => s + Number(e.amount), 0)

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
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                  ${entry.entry_kind === 'budget_adjustment'
                    ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-300'
                    : Number(entry.amount) >= 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      : 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400'}`}>
                  {entry.entry_kind === 'budget_adjustment' ? 'Adj' : Number(entry.amount) >= 0 ? '+' : '−'}
                </span>
                <div className="flex-1 min-w-0">
                  {entry.entry_kind === 'budget_adjustment' ? (
                    <p className="text-sm font-medium text-dosh-700 dark:text-dosh-300">
                      Budget {fmt(entry.budget_before_amount)} {'->'} {fmt(entry.budget_after_amount)}
                    </p>
                  ) : (
                    <p className={`text-sm font-medium ${Number(entry.amount) >= 0 ? 'text-red-700 dark:text-red-400' : 'text-dosh-700 dark:text-dosh-400'}`}>
                      {fmt(Math.abs(entry.amount))}
                    </p>
                  )}
                  {entry.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.note}</p>}
                  <p className="text-xs text-gray-400">{format(parseISO(entry.entrydate), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {!locked && entry.entry_kind !== 'budget_adjustment' && (
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
function InvestmentTxModal({ periodId, investmentdesc, openingValue, closingValue, budgetedAmount, locked, onClose, defaultType = 'increase' }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['investment-tx', periodId, investmentdesc],
    queryFn: () => getInvestmentTransactions(periodId, investmentdesc),
  })

  const add = useMutation({
    mutationFn: data => addInvestmentTransaction(periodId, investmentdesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount(''); setNote('')
      onClose()
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
    add.mutate({ amount: type === 'increase' ? n : -n, note: note || null })
  }

  // Derive actual from transactions total for live display
  const txTotal = transactions.filter(tx => tx.entry_kind !== 'budget_adjustment').reduce((s, t) => s + Number(t.amount), 0)
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
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                  ${tx.entry_kind === 'budget_adjustment'
                    ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-300'
                    : Number(tx.amount) >= 0
                      ? 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                  {tx.entry_kind === 'budget_adjustment' ? 'Adj' : Number(tx.amount) >= 0 ? '+' : '−'}
                </span>
                <div className="flex-1 min-w-0">
                  {tx.entry_kind === 'budget_adjustment' ? (
                    <p className="text-sm font-medium text-dosh-700 dark:text-dosh-300">
                      Budget {fmt(tx.budget_before_amount)} {'->'} {fmt(tx.budget_after_amount)}
                    </p>
                  ) : (
                    <p className={`text-sm font-medium ${Number(tx.amount) >= 0 ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400'}`}>
                      {fmt(Math.abs(tx.amount))}
                    </p>
                  )}
                  {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.note}</p>}
                  <p className="text-xs text-gray-400">{format(parseISO(tx.entrydate), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {!locked && tx.entry_kind !== 'budget_adjustment' && (
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
            {[['increase', 'Add (+)'], ['decrease', 'Subtract (−)']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setType(val)}
                className={`flex-1 py-1.5 font-medium transition-colors ${type === val ? (val === 'increase' ? 'bg-dosh-600 text-white' : 'bg-red-600 text-white') : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input type="number" step="0.01" min="0.01" required value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="Amount"
              className="input flex-1" />
            {Number(budgetedAmount ?? 0) > 0 && (
              <button type="button"
                onClick={() => setAmount(String(Number(budgetedAmount ?? 0)))}
                className="text-xs btn-secondary whitespace-nowrap"
                title="Allocate full budget amount">
                Full ({fmt(budgetedAmount ?? 0)})
              </button>
            )}
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)" className="input flex-[2]" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" disabled={add.isPending}
              className={type === 'increase' ? 'btn-primary' : 'btn-danger'}>
              {add.isPending ? 'Saving…' : (type === 'increase' ? 'Add' : 'Subtract')}
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

function BudgetAdjustmentModal({ title, currentAmount, onSubmit, onClose }) {
  const [budgetamount, setBudgetAmount] = useState(String(Number(currentAmount ?? 0)))
  const [scope, setScope] = useState('current')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = e => {
    e.preventDefault()
    const amount = parseFloat(budgetamount)
    if (Number.isNaN(amount) || amount < 0) {
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
        <label className="label">Budget Amount ($)</label>
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          className="input"
          value={budgetamount}
          onChange={e => setBudgetAmount(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Apply to</label>
        <div className="space-y-1.5 mt-1">
          {[['current', 'Current period only'], ['future', 'Current + future unlocked periods']].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="budget-adjust-scope" value={value} checked={scope === value} onChange={() => setScope(value)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Comment</label>
        <textarea
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

function ExpenseStatusPill({ expense, onMarkPaid, onRevise }) {
  const budget = Number(expense.budgetamount ?? 0)
  const actual = Number(expense.actualamount ?? 0)
  const remaining = Number(expense.remaining_amount ?? 0)
  const rawPercent = budget > 0 ? (actual / budget) * 100 : 0
  const clampedPercent = Math.max(0, Math.min(rawPercent, 100))
  const isOver = rawPercent > 100
  const isNearLimit = rawPercent >= 90 && rawPercent <= 100
  const revisionComment = expense.revision_comment?.trim()
  const title = budget > 0
    ? `${Math.round(rawPercent)}% spent • ${fmt(actual)} of ${fmt(budget)} • Remaining ${fmt(remaining)}`
    : `No budget set • Actual ${fmt(actual)}`

  if (expense.status === 'Paid') {
    const paidCls = isOver
      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
      : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-300 dark:hover:bg-dosh-900/60'
    return (
      <button
        onClick={onRevise}
        title={`${title} • Click to revise with a comment`}
        className={`inline-flex min-w-[108px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${paidCls}`}>
        Paid
      </button>
    )
  }

  const trackCls = isOver
    ? 'bg-red-100 dark:bg-red-900/30'
    : isNearLimit
      ? 'bg-amber-100 dark:bg-amber-900/30'
      : 'bg-gray-200 dark:bg-gray-700'
  const fillCls = isOver
    ? 'bg-red-500'
    : isNearLimit
      ? 'bg-amber-500'
      : 'bg-dosh-500'
  const labelCls = isOver
    ? 'text-red-700 dark:text-red-300'
    : expense.status === 'Revised'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-gray-700 dark:text-gray-200'

  return (
    <button
      onClick={onMarkPaid}
      title={`${title}${revisionComment ? ` • Revision: ${revisionComment}` : ''} • Click to mark Paid`}
      className="inline-flex min-w-[108px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-left text-xs transition-colors hover:border-dosh-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-dosh-700 dark:hover:bg-gray-700">
      <span className={`w-10 flex-shrink-0 font-semibold ${labelCls}`}>
        {expense.status === 'Revised' ? 'Rev' : 'Spent'}
      </span>
      <span className={`relative h-2 flex-1 overflow-hidden rounded-full ${trackCls}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`} style={{ width: `${clampedPercent}%` }} />
        {isOver && <span className="absolute inset-y-0 right-0 w-1 bg-red-700 dark:bg-red-400" />}
      </span>
    </button>
  )
}

function ReviseExpenseModal({ periodId, expensedesc, onClose }) {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const revise = useMutation({
    mutationFn: () => setPeriodExpenseStatus(periodId, expensedesc, 'Revised', comment.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to revise expense'),
  })

  const handleSubmit = e => {
    e.preventDefault()
    if (!comment.trim()) {
      setError('A revision comment is required')
      return
    }
    setError('')
    revise.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Revision Comment</label>
        <textarea
          className="input w-full resize-none"
          rows={4}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Why does this paid expense need to be revised?"
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={revise.isPending}>
          {revise.isPending ? 'Saving…' : 'Revise Expense'}
        </button>
      </div>
    </form>
  )
}

function ConfirmPaidExpenseModal({ expense, onConfirm, onClose }) {
  const remaining = Number(expense.remaining_amount ?? 0)
  const isOver = remaining < 0
  const delta = fmt(Math.abs(remaining))

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-200">
        {isOver
          ? `This expense is ${delta} over budget. Mark it as paid anyway?`
          : `This expense still has ${delta} remaining against budget. Mark it as paid anyway?`}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Paid expenses are locked until revised.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onConfirm}>Mark Paid</button>
      </div>
    </div>
  )
}

function InvestmentStatusPill({ investment, onMarkPaid, onRevise }) {
  const budget = Number(investment.budgeted_amount ?? 0)
  const actual = Number(investment.actualamount ?? 0)
  const remaining = Number(investment.remaining_amount ?? 0)
  const rawPercent = budget > 0 ? (actual / budget) * 100 : 0
  const clampedPercent = Math.max(0, Math.min(rawPercent, 100))
  const isOver = rawPercent > 100
  const isNearLimit = rawPercent >= 90 && rawPercent <= 100
  const revisionComment = investment.revision_comment?.trim()
  const title = budget > 0
    ? `${Math.round(rawPercent)}% spent • ${fmt(actual)} of ${fmt(budget)} • Remaining ${fmt(remaining)}`
    : `No budget set • Actual ${fmt(actual)}`

  if (investment.status === 'Paid') {
    const paidCls = isOver
      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
      : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-300 dark:hover:bg-dosh-900/60'
    return (
      <button
        onClick={onRevise}
        title={`${title} • Click to revise with a comment`}
        className={`inline-flex min-w-[108px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${paidCls}`}
      >
        Paid
      </button>
    )
  }

  const trackCls = isOver
    ? 'bg-red-100 dark:bg-red-900/30'
    : isNearLimit
      ? 'bg-amber-100 dark:bg-amber-900/30'
      : 'bg-gray-200 dark:bg-gray-700'
  const fillCls = isOver
    ? 'bg-red-500'
    : isNearLimit
      ? 'bg-amber-500'
      : 'bg-dosh-500'
  const labelCls = isOver
    ? 'text-red-700 dark:text-red-300'
    : investment.status === 'Revised'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-gray-700 dark:text-gray-200'

  return (
    <button
      onClick={onMarkPaid}
      title={`${title}${revisionComment ? ` • Revision: ${revisionComment}` : ''} • Click to mark Paid`}
      className="inline-flex min-w-[108px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-left text-xs transition-colors hover:border-dosh-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-dosh-700 dark:hover:bg-gray-700"
    >
      <span className={`w-10 flex-shrink-0 font-semibold ${labelCls}`}>
        {investment.status === 'Revised' ? 'Rev' : 'Spent'}
      </span>
      <span className={`relative h-2 flex-1 overflow-hidden rounded-full ${trackCls}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`} style={{ width: `${clampedPercent}%` }} />
        {isOver && <span className="absolute inset-y-0 right-0 w-1 bg-red-700 dark:bg-red-400" />}
      </span>
    </button>
  )
}

function ReviseInvestmentModal({ periodId, investmentdesc, onClose }) {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const revise = useMutation({
    mutationFn: () => setPeriodInvestmentStatus(periodId, investmentdesc, 'Revised', comment.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to revise investment'),
  })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (!comment.trim()) {
        setError('A revision comment is required')
        return
      }
      revise.mutate()
    }} className="space-y-3">
      <div>
        <label className="label">Revision Comment</label>
        <textarea className="input w-full resize-none" rows={4} value={comment} onChange={e => setComment(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={revise.isPending}>{revise.isPending ? 'Saving…' : 'Revise Investment'}</button>
      </div>
    </form>
  )
}

function ConfirmPaidInvestmentModal({ investment, onConfirm, onClose }) {
  const remaining = Number(investment.remaining_amount ?? 0)
  const isOver = remaining < 0
  const delta = fmt(Math.abs(remaining))

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-200">
        {isOver
          ? `This investment is ${delta} over budget. Mark it as paid anyway?`
          : `This investment still has ${delta} remaining against budget. Mark it as paid anyway?`}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Paid investments are locked until revised.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onConfirm}>Mark Paid</button>
      </div>
    </div>
  )
}

function CloseoutModal({ periodId, onClose }) {
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [goals, setGoals] = useState('')
  const [createNextCycle, setCreateNextCycle] = useState(false)
  const { data: preview, isLoading } = useQuery({
    queryKey: ['period-closeout-preview', periodId],
    queryFn: () => getPeriodCloseoutPreview(periodId),
  })

  const closeout = useMutation({
    mutationFn: () => closeOutPeriod(periodId, { comments, goals, create_next_cycle: createNextCycle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['periods'] })
      qc.invalidateQueries({ queryKey: ['period-summaries'] })
      qc.invalidateQueries({ queryKey: ['budgets'] })
      onClose()
    },
  })

  if (isLoading || !preview) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(preview.totals).map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label.replaceAll('_', ' ')}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(value)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dosh-200 bg-dosh-50 px-4 py-3 text-sm text-dosh-900 dark:border-dosh-800 dark:bg-dosh-900/20 dark:text-dosh-100">
        <p className="font-semibold">Carry Forward</p>
        <p className="mt-1">{fmt(preview.carry_forward_amount)} will be placed into the next cycle as a `Carried Forward` income budget line.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.health.summary}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Score {preview.health.score} • {preview.health.status}</p>
      </div>
      {!preview.next_cycle_exists && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={createNextCycle} onChange={e => setCreateNextCycle(e.target.checked)} />
          Create the next budget cycle automatically during close-out
        </label>
      )}
      <div>
        <label className="label">Comments / Observations</label>
        <textarea className="input w-full resize-none" rows={4} value={comments} onChange={e => setComments(e.target.value)} />
      </div>
      <div>
        <label className="label">Goals Going Forward</label>
        <textarea className="input w-full resize-none" rows={4} value={goals} onChange={e => setGoals(e.target.value)} />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
        Closing this cycle makes it read-only. Any later corrections should be handled through reconciliation.
      </div>
      {closeout.isError && <p className="text-sm text-red-600">{closeout.error?.response?.data?.detail || 'Unable to close out this cycle right now.'}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={closeout.isPending || (!preview.next_cycle_exists && !createNextCycle)} onClick={() => closeout.mutate()}>
          {closeout.isPending ? 'Closing…' : 'Close Out Cycle'}
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
  const [note, setNote] = useState('')
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
      add.mutate({ budgetid: budgetId, incomedesc: selected, budgetamount: parseFloat(amount) || 0, scope, note: note || null })
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
              {mode === 'savings' ? 'No savings accounts available. Add a Savings account in budget settings.' : 'All income types already in this budget cycle.'}
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
          <label className="label">Comment / Note</label>
          <textarea className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
        </div>
      )}
      {mode === 'existing' && (
        <div>
          <label className="label">Include in</label>
          <div className="space-y-1.5 mt-1">
            {[['oneoff', 'This budget cycle only'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
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
  const [note, setNote] = useState('')
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
        addToperiod.mutate({ budgetid: budgetId, expensedesc: newDesc.trim(), budgetamount: parseFloat(amount) || 0, scope, note: note || null })
      } else {
        if (!selected) { setError('Select an expense item'); return }
        addToperiod.mutate({ budgetid: budgetId, expensedesc: selected, budgetamount: parseFloat(amount) || 0, scope, note: note || null })
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
            ? <p className="text-sm text-gray-500 italic">All items already in this budget cycle. Use "New item".</p>
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
        <label className="label">Comment / Note</label>
        <textarea className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
      </div>
      <div>
        <label className="label">Include in</label>
        <div className="space-y-1.5 mt-1">
          {[['oneoff', 'This budget cycle only (one-off)'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
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
  const [incomeModal, setIncomeModal] = useState(null) // { incomedesc, budgetamount, actualamount, readOnly, defaultType }
  const [entriesModal, setEntriesModal] = useState(null) // { expensedesc, budgetamount, actualamount }
  const [budgetAdjustModal, setBudgetAdjustModal] = useState(null) // { category, desc, budgetamount, title }
  const [reviseModal, setReviseModal] = useState(null) // { expensedesc }
  const [confirmPaidModal, setConfirmPaidModal] = useState(null) // { expense }
  const [reviseInvestmentModal, setReviseInvestmentModal] = useState(null)
  const [confirmPaidInvestmentModal, setConfirmPaidInvestmentModal] = useState(null)
  const [balanceModal, setBalanceModal] = useState(null) // { balancedesc, movementAmount }
  const [showCloseout, setShowCloseout] = useState(false)

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
  const setExpenseStatus = useMutation({ mutationFn: ({ desc, status, revisionComment = null }) => setPeriodExpenseStatus(id, desc, status, revisionComment), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const setInvestmentStatus = useMutation({ mutationFn: ({ desc, status, revisionComment = null }) => setPeriodInvestmentStatus(id, desc, status, revisionComment), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const editIncomeBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodIncomeBudget(id, desc, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const editExpenseBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodExpenseBudget(id, desc, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const deleteExpenseLine = useMutation({ mutationFn: desc => removePeriodExpense(id, desc), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const deleteIncomeLine = useMutation({ mutationFn: desc => removePeriodIncome(id, desc), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })
  const editInvBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodInvestmentBudget(id, desc, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['period', id] }) })

  // Reset local drag-reorder when server data refreshes
  useEffect(() => { setLocalExpenses(null) }, [data])

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (isError) return <p className="text-red-500 p-4">Failed to load budget cycle. <Link to="/budgets" className="underline">Back to Budgets</Link></p>
  if (!data) return <p className="text-gray-500">Budget cycle not found.</p>

  const { period, incomes, balances = [], investments = [] } = data
  const expenses = localExpenses ?? data.expenses
  let closeoutHealth = null
  try {
    closeoutHealth = data.closeout_snapshot?.health_snapshot_json ? JSON.parse(data.closeout_snapshot.health_snapshot_json) : null
  } catch {
    closeoutHealth = null
  }
  const budgetLockEnabled = budget?.allow_cycle_lock !== false
  const locked = budgetLockEnabled && period.islocked
  const closed = period.cycle_status === 'CLOSED'
  const activeCycle = period.cycle_status === 'ACTIVE'

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
    if (si < 0 || ti < 0) return
    if (locked || closed || cur[si]?.status === 'Paid' || cur[ti]?.status === 'Paid') return
    const [moved] = cur.splice(si, 1)
    cur.splice(ti, 0, moved)
    setLocalExpenses(cur)
    const items = cur.map((x, i) => ({ expensedesc: x.expensedesc, sort_order: i }))
    reorderPeriodExpenses(id, items).catch(() => setLocalExpenses(null))
  }
  const totalIncomeBudget    = incomes.reduce((s, i) => s + Number(i.budgetamount), 0)
  const totalIncomeActual    = incomes.reduce((s, i) => s + Number(i.actualamount), 0)
  const effectiveExpenseBudget = expenses.reduce((s, e) => s + Number(e.status === 'Paid' ? e.actualamount : e.budgetamount), 0)
  const totalExpenseActual   = expenses.reduce((s, e) => s + Number(e.actualamount), 0)
  const effectiveInvestmentBudget = investments.reduce((s, inv) => s + Number(inv.status === 'Paid' ? inv.actualamount : inv.budgeted_amount ?? 0), 0)
  const totalInvestmentActual = investments.reduce((s, inv) => s + Number(inv.actualamount ?? 0), 0)
  const totalInvestmentRemaining = investments.reduce((s, inv) => s + Number(inv.remaining_amount ?? 0), 0)
  const totalExpenseRemaining = expenses.reduce((s, e) => s + Number(e.remaining_amount ?? 0), 0)
  const totalBalanceOpening = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0), 0)
  const totalBalanceClosing = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0) + Number(b.movement_amount ?? 0), 0)
  const surplusBudget = totalIncomeBudget - effectiveExpenseBudget - effectiveInvestmentBudget
  const surplusActual = totalIncomeActual - totalExpenseActual - totalInvestmentActual
  const projectedSavings = Number(data.projected_savings ?? 0)

  const handleMarkPaid = expense => {
    const remaining = Number(expense.remaining_amount ?? 0)
    if (remaining !== 0) {
      setConfirmPaidModal({ expense })
      return
    }
    setExpenseStatus.mutate({ desc: expense.expensedesc, status: 'Paid' })
  }

  const handleMarkInvestmentPaid = investment => {
    const remaining = Number(investment.remaining_amount ?? 0)
    if (remaining !== 0) {
      setConfirmPaidInvestmentModal({ investment })
      return
    }
    setInvestmentStatus.mutate({ desc: investment.investmentdesc, status: 'Paid' })
  }

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
            <span className="text-gray-800 dark:text-gray-200">Budget Cycle Details</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {format(parseISO(period.startdate), 'dd MMM yyyy')} – {format(parseISO(period.enddate), 'dd MMM yyyy')}
          </h1>
          {budget && <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budget_frequency} · {budget.budgetowner} · {period.cycle_status}</p>}
        </div>
        <div className="flex gap-2">
          {activeCycle && !closed && (
            <button className="btn-primary" onClick={() => setShowCloseout(true)}>
              Close Out
            </button>
          )}
          {budgetLockEnabled && !closed && (
            <button className="btn-secondary" onClick={() => lock.mutate(!locked)} title={locked ? 'Unlock' : 'Lock'}>
              {locked ? <><LockClosedIcon className="w-4 h-4 text-amber-500" /> Locked</> : <><LockOpenIcon className="w-4 h-4" /> Unlocked</>}
            </button>
          )}
        </div>
      </div>

      {closed && (
        <div className="rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-900/30 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
          This budget cycle is closed. Values are frozen for historical reporting, and later corrections should happen through reconciliation.
        </div>
      )}

      {locked && !closed && (
        <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          Budget cycle is locked. You can still record actuals and transactions, but budget amounts and cycle line structure are protected until you unlock it.
        </div>
      )}

      {closed && data.closeout_snapshot && (
        <div className="card p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Close-out Snapshot</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Carry Forward: {fmt(data.closeout_snapshot.carry_forward_amount)}</p>
          </div>
          {closeoutHealth && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{closeoutHealth.summary}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Health snapshot: {closeoutHealth.score} • {closeoutHealth.status}</p>
            </div>
          )}
          {data.closeout_snapshot.comments && <p className="text-sm text-gray-600 dark:text-gray-300">{data.closeout_snapshot.comments}</p>}
          {data.closeout_snapshot.goals && <p className="text-sm text-dosh-700 dark:text-dosh-300">Next cycle goals: {data.closeout_snapshot.goals}</p>}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Income Budget',  value: totalIncomeBudget,  cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Income Actual',  value: totalIncomeActual,  cls: 'text-success-700 dark:text-success-400' },
          { label: 'Expense Budget', value: effectiveExpenseBudget, cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Expense Actual', value: totalExpenseActual, cls: 'text-red-700 dark:text-red-400' },
          { label: 'Remaining Expenses', value: totalExpenseRemaining, cls: totalExpenseRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Projected Savings', value: projectedSavings },
          { label: 'Surplus (Budget)', value: surplusBudget },
          { label: 'Surplus (Actual)', value: surplusActual },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-lg font-bold ${cls || (value >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400')}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Income */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Income</span>
          {!locked && !closed && (
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
              <th className="table-header-cell text-right col-actual">
                <span title="Sum of all transactions — read-only">Actual ∑</span>
              </th>
              <th className="table-header-cell text-right">Variance</th>
              <th className="table-header-cell"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {incomes.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 italic text-sm">No income entries</td></tr>}
            {incomes.map(i => (
              <tr key={i.incomedesc} className="table-row">
                <td className="table-cell font-medium">
                  <div className="flex items-center gap-2">
                    <span>{i.incomedesc}</span>
                    {i.system_key === 'carry_forward' && <span className="badge-blue">System</span>}
                  </div>
                </td>
                <td className="table-cell-muted text-right col-budget">
                  <div className="flex items-center justify-end gap-2">
                    <span>{fmt(i.budgetamount)}</span>
                    {!locked && !closed && i.system_key !== 'carry_forward' && (
                      <button
                        type="button"
                        className="text-xs font-medium text-dosh-700 hover:underline dark:text-dosh-400"
                        onClick={() => setBudgetAdjustModal({ category: 'income', desc: i.incomedesc, budgetamount: i.budgetamount, title: i.incomedesc })}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </td>
                <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(i.actualamount)}</td>
                <td className="table-cell text-right">
                  <span className={`font-medium ${Number(i.actualamount) >= Number(i.budgetamount) ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                    {fmt(Number(i.actualamount) - Number(i.budgetamount))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <button
                      disabled={closed}
                      onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit' })}
                      title="Add income transaction"
                      className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/40 dark:text-success-400 dark:hover:bg-success-900/60'}`}>
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      disabled={closed}
                      onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'debit' })}
                      title="Add income correction"
                      className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60'}`}>
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit', readOnly: closed })}
                      title="View transactions"
                      className="flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <ListBulletIcon className="w-4 h-4" />
                    </button>
                    {!locked && !closed && i.system_key !== 'carry_forward' && (
                      <button
                        onClick={() => { if (window.confirm(`Remove "${i.incomedesc}" from this budget cycle?`)) deleteIncomeLine.mutate(i.incomedesc) }}
                        title="Remove from budget cycle"
                        className="flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Income</td>
              <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(totalIncomeBudget)}</td>
              <td className="px-4 py-2 text-right text-success-700 dark:text-success-400 text-sm">{fmt(totalIncomeActual)}</td>
              <td className="px-4 py-2 text-right text-sm">
                <span className={totalIncomeActual >= totalIncomeBudget ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}>{fmt(totalIncomeActual - totalIncomeBudget)}</span>
              </td>
              <td className="px-3 py-2" aria-hidden="true"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expenses */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Expenses</span>
          {!locked && !closed && (
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
                const isPaid = e.status === 'Paid'
                const canDelete = !locked && !closed && Number(e.actualamount) === 0 && Number(e.budgetamount) === 0
                const canEditBudget = !locked && !closed && !isPaid
                return (
                  <tr
                    key={e.expensedesc}
                    draggable={!locked && !closed && !isPaid}
                    onDragStart={() => handleDragStart(e.expensedesc)}
                    onDragOver={ev => handleDragOver(ev, e.expensedesc)}
                    onDragLeave={handleDragLeave}
                    onDrop={ev => handleDrop(ev, e.expensedesc)}
                    className={`table-row transition-colors ${isOver ? 'bg-dosh-50 dark:bg-dosh-900/20 border-t-2 border-dosh-400' : ''}`}
                  >
                    <td className={`w-6 px-2 ${isPaid || locked || closed ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing'}`}>
                      <Bars2Icon className="w-4 h-4" />
                    </td>
                    <td className="table-cell font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{e.expensedesc}</span>
                      </div>
                    </td>
                    <td className="table-cell-muted text-right col-budget">
                      {canEditBudget ? (
                        <div className="flex items-center justify-end gap-2">
                          <span>{fmt(e.budgetamount)}</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-dosh-700 hover:underline dark:text-dosh-400"
                            onClick={() => setBudgetAdjustModal({ category: 'expense', desc: e.expensedesc, budgetamount: e.budgetamount, title: e.expensedesc })}
                          >
                            Edit
                          </button>
                        </div>
                      ) : fmt(e.budgetamount)}
                    </td>
                    <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">
                      {fmt(e.actualamount)}
                    </td>
                    <td className="table-cell text-right">
                      {e.status === 'Paid' ? (
                        <span className="font-medium text-success-600 dark:text-success-400">Paid</span>
                      ) : (
                        <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
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
                        <ExpenseStatusPill
                          expense={e}
                          onMarkPaid={() => handleMarkPaid(e)}
                          onRevise={() => setReviseModal({ expensedesc: e.expensedesc })}
                        />
                        <button
                          disabled={closed || isPaid}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit' })}
                          title="Add expense transaction"
                          className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed || isPaid ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60'}`}>
                          <PlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          disabled={closed || isPaid}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'credit' })}
                          title="Add refund/credit"
                          className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed || isPaid ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60'}`}>
                          <MinusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit', readOnly: closed || isPaid })}
                          title="View transactions"
                          className="flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <ListBulletIcon className="w-4 h-4" />
                        </button>
                        {canDelete && !isPaid && (
                          <button
                            onClick={() => { if (window.confirm(`Remove "${e.expensedesc}" from this budget cycle?`)) deleteExpenseLine.mutate(e.expensedesc) }}
                            title="Remove from budget cycle (no actuals, zero budget)"
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
                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(effectiveExpenseBudget)}</td>
                <td className="px-4 py-2 text-right text-red-700 dark:text-red-400 text-sm">{fmt(totalExpenseActual)}</td>
                <td className="px-4 py-2 text-right text-sm">
                  <span className={`font-medium ${totalExpenseRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalExpenseRemaining)}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header-cell text-left">Investment</th>
                  <th className="table-header-cell text-right col-budget">Budget</th>
                  <th className="table-header-cell text-right col-actual">Actual ∑</th>
                  <th className="table-header-cell text-right">Remaining</th>
                  <th className="table-header-cell text-left">Account</th>
                  <th className="table-header-cell text-center">Status / Txns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {investments.map(inv => {
                  const remaining = Number(inv.remaining_amount ?? 0)
                  return (
                    <tr key={inv.investmentdesc} className="table-row">
                      <td className="table-cell font-medium">{inv.investmentdesc}</td>
                      <td className="table-cell-muted text-right col-budget">
                        {!locked && !closed && inv.status !== 'Paid' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span>{fmt(inv.budgeted_amount)}</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-dosh-700 hover:underline dark:text-dosh-400"
                              onClick={() => setBudgetAdjustModal({ category: 'investment', desc: inv.investmentdesc, budgetamount: inv.budgeted_amount, title: inv.investmentdesc })}
                            >
                              Edit
                            </button>
                          </div>
                        ) : fmt(inv.budgeted_amount)}
                      </td>
                      <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(inv.actualamount)}</td>
                      <td className="table-cell text-right">
                        <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</span>
                      </td>
                      <td className="table-cell-muted text-sm">
                        {inv.linked_account_desc ? <span className="text-purple-600 dark:text-purple-400">{inv.linked_account_desc}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <InvestmentStatusPill
                            investment={inv}
                            onMarkPaid={() => handleMarkInvestmentPaid(inv)}
                            onRevise={() => setReviseInvestmentModal({ investmentdesc: inv.investmentdesc })}
                          />
                          <button
                            disabled={closed || inv.status === 'Paid'}
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase' })}
                            title="Add investment transaction"
                            className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed || inv.status === 'Paid' ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60'}`}>
                            <PlusIcon className="w-4 h-4" />
                          </button>
                          <button
                            disabled={closed || inv.status === 'Paid'}
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'decrease' })}
                            title="Add subtraction/withdrawal"
                            className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${closed || inv.status === 'Paid' ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60'}`}>
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase', readOnly: closed || inv.status === 'Paid' })}
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
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Investments</td>
                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(effectiveInvestmentBudget)}</td>
                  <td className="px-4 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{fmt(totalInvestmentActual)}</td>
                  <td className="px-4 py-2 text-right text-sm">
                    <span className={`font-medium ${totalInvestmentRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalInvestmentRemaining)}</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Balances */}
      {balances.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm">Account Balances</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header-cell text-left">Account</th>
                  <th className="table-header-cell text-left">Type</th>
                  <th className="table-header-cell text-right">Opening</th>
                  <th className="table-header-cell text-right col-actual">
                    <span title="Calculated from account-linked transactions and transfers">Movement</span>
                  </th>
                  <th className="table-header-cell text-right">Closing</th>
                  <th className="table-header-cell text-center">Details</th>
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
                        <span className={`font-medium ${Number(b.movement_amount ?? 0) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmt(b.movement_amount ?? 0)}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`font-medium ${closing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(closing)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => setBalanceModal({ balancedesc: b.balancedesc, movementAmount: b.movement_amount ?? 0 })}
                            title="View supporting transactions"
                            className="flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <ListBulletIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Balances</td>
                  <td />
                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(totalBalanceOpening)}</td>
                  <td className="px-4 py-2 text-center text-xs text-gray-400 dark:text-gray-500" title="Movement is shown per account only and is not totaled across accounts">—</td>
                  <td className="px-4 py-2 text-right text-sm">
                    <span className={`font-medium ${totalBalanceClosing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalBalanceClosing)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {incomeModal && (
        <Modal title={`Transactions — ${incomeModal.incomedesc}`} onClose={() => setIncomeModal(null)} size="lg">
          <IncomeTransactionsModal
            periodId={id}
            incomedesc={incomeModal.incomedesc}
            budgetamount={incomeModal.budgetamount}
            actualamount={incomeModal.actualamount}
            locked={closed || incomeModal.readOnly}
            defaultType={incomeModal.defaultType ?? 'credit'}
            onClose={() => setIncomeModal(null)}
          />
        </Modal>
      )}
      {entriesModal && (
        <Modal title={`Transactions — ${entriesModal.expensedesc}`} onClose={() => setEntriesModal(null)} size="lg">
          <ExpenseEntriesModal
            periodId={id}
            budgetId={period.budgetid}
            expensedesc={entriesModal.expensedesc}
            budgetamount={entriesModal.budgetamount}
            actualamount={entriesModal.actualamount}
            locked={closed || entriesModal.readOnly}
            defaultType={entriesModal.defaultType ?? 'debit'}
            onClose={() => setEntriesModal(null)}
          />
        </Modal>
      )}
      {showAddExpense && (
        <Modal title="Add Expense to Budget Cycle" onClose={() => setShowAddExpense(false)} size="lg">
          <AddExpenseModal periodId={id} budgetId={period.budgetid} existingDescs={expenses.map(e => e.expensedesc)} onClose={() => setShowAddExpense(false)} />
        </Modal>
      )}
      {showAddIncome && (
        <Modal title="Add Income to Budget Cycle" onClose={() => setShowAddIncome(false)}>
          <AddIncomeModal periodId={id} budgetId={period.budgetid} existingDescs={incomes.map(i => i.incomedesc)} onClose={() => setShowAddIncome(false)} />
        </Modal>
      )}
      {budgetAdjustModal && (
        <Modal title={`Edit Line Budget — ${budgetAdjustModal.title}`} onClose={() => setBudgetAdjustModal(null)}>
          <BudgetAdjustmentModal
            title={budgetAdjustModal.title}
            currentAmount={budgetAdjustModal.budgetamount}
            onClose={() => setBudgetAdjustModal(null)}
            onSubmit={data => {
              const mutation = budgetAdjustModal.category === 'income'
                ? editIncomeBudget
                : budgetAdjustModal.category === 'expense'
                  ? editExpenseBudget
                  : editInvBudget
              mutation.mutate({ desc: budgetAdjustModal.desc, data }, { onSuccess: () => setBudgetAdjustModal(null) })
            }}
          />
        </Modal>
      )}
      {balanceModal && (
        <Modal title={`Movement Details — ${balanceModal.balancedesc}`} onClose={() => setBalanceModal(null)} size="lg">
          <BalanceTransactionsModal
            periodId={id}
            balancedesc={balanceModal.balancedesc}
            movementAmount={balanceModal.movementAmount}
          />
        </Modal>
      )}
      {reviseModal && (
        <Modal title={`Revise Expense — ${reviseModal.expensedesc}`} onClose={() => setReviseModal(null)}>
          <ReviseExpenseModal periodId={id} expensedesc={reviseModal.expensedesc} onClose={() => setReviseModal(null)} />
        </Modal>
      )}
      {confirmPaidModal && (
        <Modal title="Mark Expense as Paid?" onClose={() => setConfirmPaidModal(null)}>
          <ConfirmPaidExpenseModal
            expense={confirmPaidModal.expense}
            onClose={() => setConfirmPaidModal(null)}
            onConfirm={() => {
              setExpenseStatus.mutate({ desc: confirmPaidModal.expense.expensedesc, status: 'Paid' })
              setConfirmPaidModal(null)
            }}
          />
        </Modal>
      )}
      {reviseInvestmentModal && (
        <Modal title={`Revise Investment — ${reviseInvestmentModal.investmentdesc}`} onClose={() => setReviseInvestmentModal(null)}>
          <ReviseInvestmentModal periodId={id} investmentdesc={reviseInvestmentModal.investmentdesc} onClose={() => setReviseInvestmentModal(null)} />
        </Modal>
      )}
      {confirmPaidInvestmentModal && (
        <Modal title="Mark Investment as Paid?" onClose={() => setConfirmPaidInvestmentModal(null)}>
          <ConfirmPaidInvestmentModal
            investment={confirmPaidInvestmentModal.investment}
            onClose={() => setConfirmPaidInvestmentModal(null)}
            onConfirm={() => {
              setInvestmentStatus.mutate({ desc: confirmPaidInvestmentModal.investment.investmentdesc, status: 'Paid' })
              setConfirmPaidInvestmentModal(null)
            }}
          />
        </Modal>
      )}
      {investmentModal && (
        <Modal title={`Transactions — ${investmentModal.investmentdesc}`} onClose={() => setInvestmentModal(null)} size="lg">
          <InvestmentTxModal
            periodId={id}
            investmentdesc={investmentModal.investmentdesc}
            openingValue={investmentModal.openingValue}
            closingValue={investmentModal.closingValue}
            budgetedAmount={investmentModal.budgetedAmount}
            locked={investmentModal.readOnly || closed}
            defaultType={investmentModal.defaultType ?? 'increase'}
            onClose={() => setInvestmentModal(null)}
          />
        </Modal>
      )}
      {showCloseout && (
        <Modal title="Close Out Budget Cycle" onClose={() => setShowCloseout(false)} size="lg">
          <CloseoutModal periodId={id} onClose={() => setShowCloseout(false)} />
        </Modal>
      )}
    </div>
  )
}
