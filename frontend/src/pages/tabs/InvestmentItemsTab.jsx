import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline'
import { format, parseISO } from 'date-fns'
import { getInvestmentItems, createInvestmentItem, updateInvestmentItem, deleteInvestmentItem, getBalanceTypes, getBudgetSetupAssessment, getInvestmentItemHistory } from '../../api/client'
import Modal from '../../components/Modal'
import SetupItemHistoryModal from '../../components/SetupItemHistoryModal'
import { getBalanceTypeLabel } from '../../utils/accountNaming'

const emptyForm = { investmentdesc: '', active: true, effectivedate: '', initial_value: '', planned_amount: '', linked_account_desc: '', is_primary: false }

function InvestmentForm({ initial = emptyForm, isEdit = false, onSubmit, onClose, loading, balanceTypes = [], structureLocked = false, lockReasons = [], accountNamingPreference = 'Transaction' }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSubmit({
        ...form,
        effectivedate: form.effectivedate || null,
        initial_value: parseFloat(form.initial_value) || 0,
        planned_amount: parseFloat(form.planned_amount) || 0,
        linked_account_desc: form.linked_account_desc || null,
        is_primary: !!form.is_primary,
      })
    }} className="space-y-4">
      <div>
        <label className="label">Description <span className="text-red-500">*</span></label>
        <input required disabled={isEdit || structureLocked} className="input" value={form.investmentdesc} onChange={e => set('investmentdesc', e.target.value)}
          placeholder="e.g. ETF Portfolio" />
      </div>
      <div>
        <label className="label">Initial / Seed Value ($)</label>
        <input disabled={structureLocked} type="number" step="0.01" min="0" className="input" value={form.initial_value}
          onChange={e => set('initial_value', e.target.value)} placeholder="0.00" />
        <p className="text-xs text-gray-400 mt-1">Starting balance or initial investment amount</p>
      </div>
      <div>
        <label className="label">Planned Contribution ($)</label>
        <input disabled={structureLocked} type="number" step="0.01" min="0" className="input" value={form.planned_amount}
          onChange={e => set('planned_amount', e.target.value)} placeholder="0.00" />
        <p className="text-xs text-gray-400 mt-1">Used as the default budgeted amount for future budget cycles when you want a planned contribution.</p>
      </div>
      <div>
        <label className="label">Effective Date</label>
        <input disabled={structureLocked} type="date" className="input" value={form.effectivedate} onChange={e => set('effectivedate', e.target.value)} />
      </div>
      <div>
        <label className="label">Linked Account</label>
        <select disabled={structureLocked} className="input" value={form.linked_account_desc} onChange={e => set('linked_account_desc', e.target.value)}>
          <option value="">— none —</option>
          {balanceTypes.map(bt => (
            <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}{bt.balance_type ? ` (${getBalanceTypeLabel(bt.balance_type, accountNamingPreference)})` : ''}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Contributions to this investment will be credited to this account balance.</p>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input disabled={structureLocked} type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-dosh-600 focus:ring-dosh-500" />
        Active
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input disabled={structureLocked} type="checkbox" checked={!!form.is_primary} onChange={e => set('is_primary', e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-dosh-600 focus:ring-dosh-500" />
        Primary investment line
      </label>
      <p className="text-xs text-gray-400 -mt-2">
        Auto-allocated savings budget will go to the active primary investment line.
      </p>
      {structureLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          This investment line is already in use. Structural changes are locked while it is referenced by generated or recorded budget activity.
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

export default function InvestmentItemsTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)
  const [actionError, setActionError] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['investment-items', budgetId],
    queryFn: () => getInvestmentItems(budgetId),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', budgetId],
    queryFn: () => getBudgetSetupAssessment(budgetId),
  })
  const historyQuery = useQuery({
    queryKey: ['investment-item-history', budgetId, historyItem?.investmentdesc],
    queryFn: () => getInvestmentItemHistory(budgetId, historyItem.investmentdesc),
    enabled: !!historyItem,
  })

  const create = useMutation({
    mutationFn: data => createInvestmentItem(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to save this investment right now.'),
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateInvestmentItem(budgetId, desc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to update this investment right now.'),
  })

  const remove = useMutation({
    mutationFn: desc => deleteInvestmentItem(budgetId, desc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-items', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
    },
    onError: error => setActionError(error?.response?.data?.detail || 'Unable to delete this investment right now.'),
  })

  const investmentUsageByDesc = Object.fromEntries((setupAssessment?.investment_items || []).map(item => [item.investmentdesc, item]))
  const accountNamingPreference = budget?.account_naming_preference || 'Transaction'

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Investment
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">No investments defined yet.</div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {items.map(item => {
            const usage = investmentUsageByDesc[item.investmentdesc]
            return (
            <div key={item.investmentdesc} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {item.investmentdesc}
                  {usage?.in_use ? <span className="ml-2 badge-amber">In Use</span> : null}
                </span>
                {item.effectivedate && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    from {format(parseISO(item.effectivedate), 'dd MMM yyyy')}
                  </span>
                )}
                {Number(item.initial_value) > 0 && (
                  <span className="ml-2 text-xs text-dosh-600 dark:text-dosh-400">
                    seed: {Number(item.initial_value).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                  </span>
                )}
                {Number(item.planned_amount ?? 0) > 0 && (
                  <span className="ml-2 text-xs text-dosh-600 dark:text-dosh-400">
                    planned: {Number(item.planned_amount).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                  </span>
                )}
                {item.is_primary && (
                  <span className="ml-2 badge-blue">Primary</span>
                )}
                {item.linked_account_desc && (
                  <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">→ {item.linked_account_desc}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}
                <button className="btn-secondary" title="View history details" onClick={() => setHistoryItem(item)}>
                  <ClockIcon className="w-3 h-3" />
                </button>
                <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item })}>
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button className="btn-danger" disabled={usage ? usage.can_delete === false : false} title={usage?.can_delete === false ? usage.reasons.join('. ') : undefined} onClick={() => { if (window.confirm(`Delete "${item.investmentdesc}"?`)) remove.mutate(item.investmentdesc) }}>
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )})}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Investment' : 'Edit Investment'} onClose={() => setModal(null)}>
          <InvestmentForm
            initial={modal.item ? {
              investmentdesc: modal.item.investmentdesc,
              active: modal.item.active,
              effectivedate: modal.item.effectivedate ? format(parseISO(modal.item.effectivedate), 'yyyy-MM-dd') : '',
              initial_value: modal.item.initial_value ?? '',
              planned_amount: modal.item.planned_amount ?? '',
              linked_account_desc: modal.item.linked_account_desc ?? '',
              is_primary: !!modal.item.is_primary,
            } : emptyForm}
            isEdit={modal.mode === 'edit'}
            balanceTypes={balanceTypes}
            structureLocked={modal.item ? investmentUsageByDesc[modal.item.investmentdesc]?.can_edit_structure === false : false}
            lockReasons={modal.item ? (investmentUsageByDesc[modal.item.investmentdesc]?.reasons || []) : []}
            accountNamingPreference={accountNamingPreference}
            onSubmit={form => {
              if (modal.mode === 'create') create.mutate(form)
              else update.mutate({ desc: modal.item.investmentdesc, data: form })
            }}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
          />
        </Modal>
      )}

      {historyItem && (
        <SetupItemHistoryModal
          historyQuery={historyQuery}
          itemDesc={historyItem.investmentdesc}
          category="investment"
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}
