import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { format, parseISO, addDays } from 'date-fns'
import { getExpenseItems, createExpenseItem, updateExpenseItem, deleteExpenseItem, reorderExpenseItems } from '../../api/client'
import Modal from '../../components/Modal'

const FREQTYPES = ['Always', 'Fixed Day of Month', 'Every N Days']
const PAYTYPES = ['AUTO', 'MANUAL']

const emptyForm = {
  expensedesc: '', active: true, freqtype: 'Always',
  frequency_value: '', paytype: 'AUTO', effectivedate: '', expenseamount: '',
}

/**
 * Calculate the next due date after `today` for a given expense item.
 * Returns a Date or null.
 */
function calcNextDue(freqtype, frequencyValue, effectivedate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (freqtype === 'Always') return null  // always in period, no specific date

  if (freqtype === 'Fixed Day of Month') {
    const day = parseInt(frequencyValue)
    if (!day) return null
    // Try this month, then next month
    let candidate = new Date(today.getFullYear(), today.getMonth(), day)
    if (candidate < today) candidate = new Date(today.getFullYear(), today.getMonth() + 1, day)
    return candidate
  }

  if (freqtype === 'Every N Days') {
    const interval = parseInt(frequencyValue)
    if (!interval || !effectivedate) return null
    let cursor = parseISO(effectivedate)
    cursor.setHours(0, 0, 0, 0)
    if (cursor < today) {
      const delta = Math.ceil((today - cursor) / (interval * 86400000))
      cursor = addDays(cursor, delta * interval)
    }
    return cursor
  }

  return null
}

function ExpenseItemForm({ initial = emptyForm, isEdit = false, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const isAlways = form.freqtype === 'Always'
  const isEveryNDays = form.freqtype === 'Every N Days'
  const freqValueLabel = form.freqtype === 'Fixed Day of Month' ? 'Day of Month (1–31)' : 'Interval (days)'
  const commencementLabel = isEveryNDays ? 'Commencement Date' : 'Effective Date'

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSubmit({
        expensedesc: form.expensedesc,
        active: form.active,
        freqtype: form.freqtype || null,
        frequency_value: (!isAlways && form.frequency_value) ? parseInt(form.frequency_value) : null,
        paytype: form.paytype || null,
        effectivedate: form.effectivedate || null,
        expenseamount: parseFloat(form.expenseamount) || 0,
      })
    }} className="space-y-4">
      <div>
        <label className="label">Description <span className="text-red-500">*</span></label>
        <input required className="input" value={form.expensedesc} onChange={e => set('expensedesc', e.target.value)}
          placeholder="e.g. Netflix" disabled={isEdit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Frequency Type</label>
          <select className="input" value={form.freqtype} onChange={e => set('freqtype', e.target.value)}>
            {FREQTYPES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={`label ${isAlways ? 'opacity-40' : ''}`}>{freqValueLabel}</label>
          <input
            type="number" min="1" max={form.freqtype === 'Fixed Day of Month' ? 31 : undefined}
            className="input" value={form.frequency_value} onChange={e => set('frequency_value', e.target.value)}
            disabled={isAlways}
            placeholder={isAlways ? 'N/A' : ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Pay Type</label>
          <select className="input" value={form.paytype} onChange={e => set('paytype', e.target.value)}>
            <option value="">— none —</option>
            {PAYTYPES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount ($) <span className="text-red-500">*</span></label>
          <input required type="number" step="0.01" min="0" className="input"
            value={form.expenseamount} onChange={e => set('expenseamount', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={`label ${isAlways ? 'opacity-40' : ''}`}>{commencementLabel}</label>
        <input type="date" className="input" value={form.effectivedate} onChange={e => set('effectivedate', e.target.value)}
          disabled={isAlways} />
      </div>
      {isAlways && (
        <p className="text-xs text-dosh-600 dark:text-dosh-400 bg-dosh-50 dark:bg-dosh-900/20 rounded px-3 py-2">
          "Always" — this expense is included in every period at the set amount, regardless of dates.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-dosh-600 focus:ring-dosh-500" />
        <span className="text-gray-700 dark:text-gray-300">Active (include in future generated periods)</span>
      </label>
      {isEdit && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2">
          Saving changes to frequency, amount, or dates will automatically apply a revision and update budget amounts on future unlocked periods.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

const fmt = v => Number(v).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function FreqBadge({ freqtype, frequencyValue }) {
  if (!freqtype) return <span className="badge-gray">—</span>
  if (freqtype === 'Always') return <span className="badge-green">Always</span>
  if (freqtype === 'Fixed Day of Month') return <span className="badge-blue">Day {frequencyValue}</span>
  if (freqtype === 'Every N Days') return <span className="badge-blue">Every {frequencyValue}d</span>
  return <span className="badge-gray">{freqtype}</span>
}

export default function ExpenseItemsTab({ budgetId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })

  const create = useMutation({
    mutationFn: data => createExpenseItem(budgetId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }); setModal(null) },
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateExpenseItem(budgetId, desc, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }); setModal(null) },
  })

  const remove = useMutation({
    mutationFn: desc => deleteExpenseItem(budgetId, desc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }),
  })

  const moveItem = (desc, direction) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.expensedesc.localeCompare(b.expensedesc))
    const idx = sorted.findIndex(i => i.expensedesc === desc)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const reordered = [...sorted]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    const payload = reordered.map((item, i) => ({ expensedesc: item.expensedesc, sort_order: i }))
    reorderExpenseItems(budgetId, payload).then(() => qc.invalidateQueries({ queryKey: ['expense-items', budgetId] }))
  }

  const handleSubmit = form => {
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ desc: modal.item.expensedesc, data: form })
  }

  const displayed = showInactive ? items : items.filter(i => i.active)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-dosh-600" />
          Show inactive
        </label>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Expense Item
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          No expense items{!showInactive ? ' (active)' : ''} defined.
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50">
                <th className="w-16 px-2 py-2 text-center">Order</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Frequency</th>
                <th className="px-3 py-2 text-left">Pay</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Commencement Date</th>
                <th className="px-3 py-2 text-left">Next Due</th>
                <th className="px-3 py-2 text-left">Rev</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {displayed.map((item, idx) => {
                const nextDue = calcNextDue(item.freqtype, item.frequency_value, item.effectivedate)
                const nextDueStr = nextDue ? format(nextDue, 'dd MMM yyyy') : '—'
                const commDate = item.effectivedate ? format(parseISO(item.effectivedate), 'dd MMM yyyy') : '—'
                return (
                  <tr key={item.expensedesc} className="table-row">
                    <td className="px-2 py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => moveItem(item.expensedesc, 'up')} disabled={idx === 0}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20" title="Move up">
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveItem(item.expensedesc, 'down')} disabled={idx === displayed.length - 1}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20" title="Move down">
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{item.expensedesc}</td>
                    <td className="px-3 py-2">
                      <FreqBadge freqtype={item.freqtype} frequencyValue={item.frequency_value} />
                    </td>
                    <td className="px-3 py-2">
                      {item.paytype === 'AUTO' ? <span className="badge-blue">AUTO</span>
                        : item.paytype === 'MANUAL' ? <span className="badge-gray">MANUAL</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100 font-medium">{fmt(item.expenseamount)}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{commDate}</td>
                    <td className="px-3 py-2 text-xs font-medium">
                      {nextDue
                        ? <span className="text-dosh-600 dark:text-dosh-400">{nextDueStr}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{item.revisionnum}</td>
                    <td className="px-3 py-2">
                      {item.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item })}>
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button className="btn-danger" onClick={() => { if (window.confirm(`Delete "${item.expensedesc}"?`)) remove.mutate(item.expensedesc) }}>
                          <TrashIcon className="w-3 h-3" />
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

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Expense Item' : 'Edit Expense Item'} onClose={() => setModal(null)} size="lg">
          <ExpenseItemForm
            initial={modal.item ? {
              expensedesc: modal.item.expensedesc,
              active: modal.item.active,
              freqtype: modal.item.freqtype ?? 'Always',
              frequency_value: modal.item.frequency_value ?? '',
              paytype: modal.item.paytype ?? '',
              effectivedate: modal.item.effectivedate ? format(parseISO(modal.item.effectivedate), 'yyyy-MM-dd') : '',
              expenseamount: modal.item.expenseamount ?? '',
            } : emptyForm}
            isEdit={modal.mode === 'edit'}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
          />
        </Modal>
      )}
    </div>
  )
}
