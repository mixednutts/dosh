import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly']

const emptyForm = { description: '', budgetowner: '', budget_frequency: 'Fortnightly' }

function BudgetForm({ initial = emptyForm, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Household Budget 2025" />
      </div>
      <div>
        <label className="label">Owner <span className="text-red-500">*</span></label>
        <input required className="input" value={form.budgetowner} onChange={e => set('budgetowner', e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label className="label">Frequency <span className="text-red-500">*</span></label>
        <select required className="input" value={form.budget_frequency} onChange={e => set('budget_frequency', e.target.value)}>
          {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
        </select>
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

export default function BudgetsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)

  const { data: budgets = [], isLoading } = useQuery({ queryKey: ['budgets'], queryFn: getBudgets })

  const create = useMutation({
    mutationFn: createBudget,
    onSuccess: (newBudget) => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      navigate(`/budgets/${newBudget.budgetid}`)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => updateBudget(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setModal(null) },
  })

  const remove = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const handleSubmit = form => {
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ id: modal.budget.budgetid, data: form })
  }

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budgets</h1>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> New Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <p className="mb-3">No budgets yet. Create one to get started.</p>
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon className="w-4 h-4" /> Create Budget
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {budgets.map(b => (
            <div key={b.budgetid} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link to={`/budgets/${b.budgetid}`} className="font-medium text-dosh-700 dark:text-dosh-400 hover:underline">
                  {b.description || 'Untitled'}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400">{b.budgetowner} · {b.budget_frequency}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', budget: b })}>
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button className="btn-danger" onClick={() => { if (window.confirm(`Delete "${b.description}"?`)) remove.mutate(b.budgetid) }}>
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Budget' : 'Edit Budget'} onClose={() => setModal(null)}>
          <BudgetForm
            initial={modal.budget ? {
              description: modal.budget.description ?? '',
              budgetowner: modal.budget.budgetowner,
              budget_frequency: modal.budget.budget_frequency,
            } : emptyForm}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
          />
        </Modal>
      )}
    </div>
  )
}
