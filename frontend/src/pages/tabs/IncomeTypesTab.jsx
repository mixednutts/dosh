import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getIncomeTypes, createIncomeType, updateIncomeType, deleteIncomeType, getBalanceTypes } from '../../api/client'
import Modal from '../../components/Modal'

const emptyForm = { incomedesc: '', issavings: false, isfixed: false, autoinclude: false, amount: '', linked_account: '' }

function IncomeTypeForm({ initial = emptyForm, onSubmit, onClose, loading, budgetId }) {
  const [form, setForm] = useState({ ...initial, amount: initial.amount ?? '', linked_account: initial.linked_account ?? '' })
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    if (k === 'isfixed' && v) next.autoinclude = true
    return next
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })

  const handleSubmit = e => {
    e.preventDefault()
    onSubmit({ ...form, amount: parseFloat(form.amount) || 0, linked_account: form.linked_account || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Description <span className="text-red-500">*</span></label>
        <input required className="input" value={form.incomedesc} onChange={e => set('incomedesc', e.target.value)} placeholder="e.g. Salary" />
      </div>
      <div>
        <label className="label">Default Amount ($)</label>
        <input type="number" step="0.01" min="0" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} />
      </div>
      <div>
        <label className="label">Paid into Account</label>
        <select className="input" value={form.linked_account} onChange={e => set('linked_account', e.target.value)}>
          <option value="">— none —</option>
          {accounts.map(a => <option key={a.balancedesc} value={a.balancedesc}>{a.balancedesc}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {[
          ['isfixed',    'Fixed amount (same every budget cycle)'],
          ['autoinclude','Auto-include in new budget cycles'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form[key]}
              onChange={e => set(key, e.target.checked)}
              className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500"
            />
            {label}
            {key === 'autoinclude' && form.isfixed && (
              <span className="text-xs text-gray-400">(auto-set when fixed)</span>
            )}
          </label>
        ))}
      </div>
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

export default function IncomeTypesTab({ budgetId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })

  const create = useMutation({
    mutationFn: data => createIncomeType(budgetId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income-types', budgetId] }); setModal(null) },
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateIncomeType(budgetId, desc, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income-types', budgetId] }); setModal(null) },
  })

  const remove = useMutation({
    mutationFn: desc => deleteIncomeType(budgetId, desc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income-types', budgetId] }),
  })

  const handleSubmit = form => {
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ desc: modal.item.incomedesc, data: form })
  }

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Income Type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">No income types defined yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header-cell text-left">Description</th>
                <th className="table-header-cell text-right">Amount</th>
                <th className="table-header-cell text-left">Paid into Account</th>
                <th className="table-header-cell text-center">Fixed</th>
                <th className="table-header-cell text-center">Auto</th>
                <th className="table-header-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {types.map(t => (
                <tr key={t.incomedesc} className="table-row">
                  <td className="table-cell font-medium text-gray-800 dark:text-gray-100">{t.incomedesc}</td>
                  <td className="table-cell text-right text-gray-600 dark:text-gray-300">{fmt(t.amount)}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-300">{t.linked_account ?? <span className="text-gray-400 italic">—</span>}</td>
                  <td className="table-cell text-center">{t.isfixed ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell text-center">{t.autoinclude ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span>}</td>
                  <td className="table-cell">
                    <div className="flex gap-1 justify-end">
                      <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item: t })}>
                        <PencilIcon className="w-3 h-3" />
                      </button>
                      <button className="btn-danger" onClick={() => { if (window.confirm(`Delete "${t.incomedesc}"?`)) remove.mutate(t.incomedesc) }}>
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Income Type' : 'Edit Income Type'} onClose={() => setModal(null)}>
          <IncomeTypeForm
            initial={modal.item ? {
              incomedesc: modal.item.incomedesc,
              issavings: modal.item.issavings,
              isfixed: modal.item.isfixed,
              autoinclude: modal.item.autoinclude,
              amount: modal.item.amount,
              linked_account: modal.item.linked_account ?? '',
            } : emptyForm}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
            budgetId={budgetId}
          />
        </Modal>
      )}
    </div>
  )
}
