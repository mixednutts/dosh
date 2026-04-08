import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, ClockIcon } from '@heroicons/react/24/outline'
import { format, parseISO, addDays } from 'date-fns'
import { getExpenseItems, createExpenseItem, updateExpenseItem, deleteExpenseItem, reorderExpenseItems, getBudgetSetupAssessment, getExpenseItemHistory } from '../../api/client'
import Modal from '../../components/Modal'
import SetupItemHistoryModal from '../../components/SetupItemHistoryModal'
import ExpenseItemSchedulingFields from '../../components/ExpenseItemSchedulingFields'
import { getNextFixedDayOccurrence } from '../../utils/fixedDayScheduling'

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
    const day = Number.parseInt(frequencyValue, 10)
    if (!day) return null
    return getNextFixedDayOccurrence(today, day)
  }

  if (freqtype === 'Every N Days') {
    const interval = Number.parseInt(frequencyValue, 10)
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

function ExpenseItemForm({ initial = emptyForm, isEdit = false, onSubmit, onClose, loading, activeLocked = false, lockReasons = [] }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const formIdPrefix = isEdit ? 'edit-expense-item' : 'create-expense-item'

  const isAlways = form.freqtype === 'Always'

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSubmit({
        expensedesc: form.expensedesc,
        active: form.active,
        freqtype: form.freqtype || null,
        frequency_value: (!isAlways && form.frequency_value) ? Number.parseInt(form.frequency_value, 10) : null,
        paytype: isAlways ? 'MANUAL' : (form.paytype || 'MANUAL'),
        effectivedate: isAlways ? null : (form.effectivedate || null),
        expenseamount: Number.parseFloat(form.expenseamount) || 0,
      })
    }} className="space-y-4">
      <ExpenseItemSchedulingFields
        formIdPrefix={formIdPrefix}
        description={form.expensedesc}
        onDescriptionChange={value => set('expensedesc', value)}
        freqtype={form.freqtype}
        onFreqtypeChange={value => set('freqtype', value)}
        frequencyValue={form.frequency_value}
        onFrequencyValueChange={value => set('frequency_value', value)}
        paytype={form.paytype}
        onPaytypeChange={value => set('paytype', value)}
        effectivedate={form.effectivedate}
        onEffectivedateChange={value => set('effectivedate', value)}
        disableDescription={isEdit}
      />
      <div>
        <label htmlFor={`${formIdPrefix}-amount`} className="label">Amount ($) <span className="text-red-500">*</span></label>
        <input id={`${formIdPrefix}-amount`} required type="number" step="0.01" min="0" className="input"
          value={form.expenseamount} onChange={e => set('expenseamount', e.target.value)} />
      </div>
      {isAlways && (
        <p className="text-xs text-dosh-600 dark:text-dosh-400 bg-dosh-50 dark:bg-dosh-900/20 rounded px-3 py-2">
          "Always" — this expense is included in every budget cycle at the set amount, regardless of dates, so it must stay MANUAL.
        </p>
      )}
      <label htmlFor={`${formIdPrefix}-active`} className="flex items-start gap-3 text-sm cursor-pointer">
        <input id={`${formIdPrefix}-active`} type="checkbox" disabled={activeLocked} checked={form.active} onChange={e => set('active', e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-dosh-600 focus:ring-dosh-500" />
        <span className="space-y-0.5">
          <span className="block font-medium text-gray-800 dark:text-gray-100">Active</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">Include in future generated budget cycles.</span>
        </span>
      </label>
      {activeLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          This expense item is already in use, so it cannot be deactivated.
          {lockReasons.length > 0 ? ` ${lockReasons.join('. ')}.` : ''}
        </div>
      )}
      {isEdit && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2">
          Saving changes to frequency, amount, or dates will automatically apply a revision and update budget amounts on future unlocked budget cycles.
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
  if (freqtype === 'Always') return <span className="badge-green">Always included</span>
  if (freqtype === 'Fixed Day of Month') return <span className="badge-blue">Day {frequencyValue}</span>
  if (freqtype === 'Every N Days') return <span className="badge-blue">Every {frequencyValue}d</span>
  return <span className="badge-gray">{freqtype}</span>
}

export default function ExpenseItemsTab({ budgetId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [actionError, setActionError] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', budgetId],
    queryFn: () => getBudgetSetupAssessment(budgetId),
  })
  const historyQuery = useQuery({
    queryKey: ['expense-item-history', budgetId, historyItem?.expensedesc],
    queryFn: () => getExpenseItemHistory(budgetId, historyItem.expensedesc),
    enabled: !!historyItem,
  })

  const create = useMutation({
    mutationFn: data => createExpenseItem(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to save this expense item right now.'),
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateExpenseItem(budgetId, desc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to update this expense item right now.'),
  })

  const remove = useMutation({
    mutationFn: desc => deleteExpenseItem(budgetId, desc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to delete this expense item right now.'),
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
    setActionError('')
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ desc: modal.item.expensedesc, data: form })
  }

  const expenseUsageByDesc = Object.fromEntries((setupAssessment?.expense_items || []).map(item => [item.expensedesc, item]))
  const displayed = showInactive ? items : items.filter(i => i.active)

  function getPayTypeBadge(paytype) {
    if (paytype === 'AUTO') return <span className="badge-blue">AUTO</span>
    if (paytype === 'MANUAL') return <span className="badge-gray">MANUAL</span>
    return <span className="text-gray-400">—</span>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="expense-items-show-inactive" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input id="expense-items-show-inactive" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-dosh-600" />
          <span>Show inactive</span>
        </label>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Expense Item
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      )}

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
                <th className="px-3 py-2 text-left">Effective Date</th>
                <th className="px-3 py-2 text-left">Next Due</th>
                <th className="px-3 py-2 text-left">Rev</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {displayed.map((item, idx) => {
                const usage = expenseUsageByDesc[item.expensedesc]
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
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                      {item.expensedesc}
                      {usage?.in_use ? <span className="ml-2 badge-amber">In Use</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <FreqBadge freqtype={item.freqtype} frequencyValue={item.frequency_value} />
                    </td>
                    <td className="px-3 py-2">
                      {getPayTypeBadge(item.paytype)}
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
                        <button className="btn-secondary" title="View history details" onClick={() => setHistoryItem(item)}>
                          <ClockIcon className="w-3 h-3" />
                        </button>
                        <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item })}>
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button className="btn-danger" disabled={usage ? usage.can_delete === false : false} title={usage?.can_delete === false ? usage.reasons.join('. ') : undefined} onClick={() => { if (globalThis.confirm(`Delete "${item.expensedesc}"?`)) remove.mutate(item.expensedesc) }}>
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
            activeLocked={modal.item ? expenseUsageByDesc[modal.item.expensedesc]?.can_deactivate === false : false}
            lockReasons={modal.item ? (expenseUsageByDesc[modal.item.expensedesc]?.reasons || []) : []}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
          />
        </Modal>
      )}

      {historyItem && (
        <SetupItemHistoryModal
          historyQuery={historyQuery}
          itemDesc={historyItem.expensedesc}
          category="expense"
          currentItem={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}

ExpenseItemForm.propTypes = {
  initial: PropTypes.shape({
    expensedesc: PropTypes.string,
    active: PropTypes.bool,
    freqtype: PropTypes.string,
    frequency_value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    paytype: PropTypes.string,
    effectivedate: PropTypes.string,
    expenseamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  isEdit: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  activeLocked: PropTypes.bool,
  lockReasons: PropTypes.arrayOf(PropTypes.string),
}

FreqBadge.propTypes = {
  freqtype: PropTypes.string,
  frequencyValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

ExpenseItemsTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
}
