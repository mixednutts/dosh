import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getBalanceTypes, createBalanceType, updateBalanceType, deleteBalanceType, getBudgetSetupAssessment } from '../../api/client'
import Modal from '../../components/Modal'
import { getBalanceTypeLabel, getPreferredTransactionLabel } from '../../utils/accountNaming'

const BALANCE_TYPE_OPTIONS = ['Transaction', 'Savings', 'Cash']
const emptyForm = { balancedesc: '', balance_type: 'Transaction', opening_balance: '', active: true, is_primary: false }

function BalanceTypeForm({ initial = emptyForm, onSubmit, onClose, loading, structureLocked = false, lockReasons = [], accountNamingPreference = 'Transaction' }) {
  const [form, setForm] = useState({ ...initial, opening_balance: initial.opening_balance ?? '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, opening_balance: parseFloat(form.opening_balance) || 0 }) }} className="space-y-4">
      <div>
        <label className="label">Account Name <span className="text-red-500">*</span></label>
        <input required disabled={structureLocked} className="input" value={form.balancedesc} onChange={e => set('balancedesc', e.target.value)} placeholder="e.g. Everyday Account" />
      </div>
      <div>
        <label className="label">Account Type</label>
        <select disabled={structureLocked} className="input" value={form.balance_type} onChange={e => set('balance_type', e.target.value)}>
          {BALANCE_TYPE_OPTIONS.map(o => <option key={o} value={o}>{getBalanceTypeLabel(o, accountNamingPreference)}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Opening Balance ($)</label>
        <input disabled={structureLocked} type="number" step="0.01" className="input" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="0.00" />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input disabled={structureLocked} type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked)}
            className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
          Active (include in new budget cycles)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!form.is_primary} onChange={e => set('is_primary', e.target.checked)}
            className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
          Primary {getPreferredTransactionLabel(accountNamingPreference).toLowerCase()} account (expenses deducted from this account)
        </label>
      </div>
      {structureLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          This account is already in use. Structural changes are locked while it is referenced downstream.
          {lockReasons.length > 0 ? ` ${lockReasons.join('. ')}.` : ''}
        </div>
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

const fmt = v => Number(v ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

const TYPE_BADGE = {
  Transaction: 'badge-blue',
  Bank: 'badge-blue',
  Savings: 'badge-green',
  Cash: 'badge-amber',
}

export default function BalanceTypesTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [actionError, setActionError] = useState('')

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', budgetId],
    queryFn: () => getBudgetSetupAssessment(budgetId),
  })

  const create = useMutation({
    mutationFn: data => createBalanceType(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['balance-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to save this account right now.'),
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateBalanceType(budgetId, desc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['balance-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to update this account right now.'),
  })

  const remove = useMutation({
    mutationFn: desc => deleteBalanceType(budgetId, desc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['balance-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to delete this account right now.'),
  })

  const handleSubmit = form => {
    setActionError('')
    if (modal.mode === 'create') create.mutate(form)
    else update.mutate({ desc: modal.item.balancedesc, data: form })
  }

  const accountUsageByDesc = Object.fromEntries((setupAssessment?.accounts || []).map(account => [account.balancedesc, account]))
  const accountNamingPreference = budget?.account_naming_preference || 'Transaction'

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Account
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      {types.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          No accounts defined yet. Add a {getPreferredTransactionLabel(accountNamingPreference).toLowerCase()}, savings, or cash account to track balances.
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.9fr)_minmax(8rem,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_auto] gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <span>Account</span>
            <span className="justify-self-end text-right">Type</span>
            <span className="justify-self-end text-right">Opening Balance</span>
            <span className="justify-self-end text-right">Primary</span>
            <span className="justify-self-end text-right">Active</span>
            <span></span>
          </div>
          {types.map(t => {
            const usage = accountUsageByDesc[t.balancedesc]
            return (
            <div key={t.balancedesc} className="grid grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.9fr)_minmax(8rem,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 font-medium text-gray-800 dark:text-gray-100">
                {t.balancedesc}
                {usage?.in_use ? <span className="ml-2 badge-amber">In Use</span> : null}
              </span>
              <span className="justify-self-end text-right"><span className={TYPE_BADGE[t.balance_type] ?? 'badge-gray'}>{getBalanceTypeLabel(t.balance_type, accountNamingPreference)}</span></span>
              <span className="justify-self-end text-right text-gray-600 dark:text-gray-300">{fmt(t.opening_balance)}</span>
              <span className="justify-self-end text-right">{t.is_primary ? <span className="badge-green">Yes</span> : <span className="badge-gray">—</span>}</span>
              <span className="justify-self-end text-right">{t.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}</span>
              <div className="flex justify-end gap-1">
                <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item: t })}>
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button className="btn-danger" disabled={usage ? usage.can_delete === false : false} title={usage?.can_delete === false ? usage.reasons.join('. ') : undefined} onClick={() => { if (window.confirm(`Delete "${t.balancedesc}"?`)) remove.mutate(t.balancedesc) }}>
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )})}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Account' : 'Edit Account'} onClose={() => setModal(null)}>
          <BalanceTypeForm
            initial={modal.item ? {
              balancedesc: modal.item.balancedesc,
              balance_type: modal.item.balance_type,
              opening_balance: modal.item.opening_balance,
              active: modal.item.active,
              is_primary: modal.item.is_primary ?? false,
            } : emptyForm}
            structureLocked={modal.item ? accountUsageByDesc[modal.item.balancedesc]?.can_edit_structure === false : false}
            lockReasons={modal.item ? (accountUsageByDesc[modal.item.balancedesc]?.reasons || []) : []}
            accountNamingPreference={accountNamingPreference}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
          />
        </Modal>
      )}
    </div>
  )
}

BalanceTypeForm.propTypes = {
  initial: PropTypes.shape({
    balancedesc: PropTypes.string,
    balance_type: PropTypes.string,
    opening_balance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    active: PropTypes.bool,
    is_primary: PropTypes.bool,
  }),
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  structureLocked: PropTypes.bool,
  lockReasons: PropTypes.arrayOf(PropTypes.string),
  accountNamingPreference: PropTypes.string,
}

BalanceTypesTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    account_naming_preference: PropTypes.string,
  }),
}
