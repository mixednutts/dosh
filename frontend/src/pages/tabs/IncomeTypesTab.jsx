import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline'
import { getIncomeTypes, createIncomeType, updateIncomeType, deleteIncomeType, getBalanceTypes, getBudgetSetupAssessment, getIncomeTypeHistory } from '../../api/client'
import Modal from '../../components/Modal'
import SetupItemHistoryModal from '../../components/SetupItemHistoryModal'
import LocalizedAmountInput from '../../components/LocalizedAmountInput'
import MobileTableCards from '../../components/MobileTableCards'
import AlertBanner from '../../components/AlertBanner'
import { useLocalisation } from '../../components/LocalisationContext'


const emptyForm = { incomedesc: '', issavings: false, autoinclude: true, amount: '', linked_account: '' }

function IncomeTypeForm({ initial = emptyForm, onSubmit, onClose, loading, budgetId, structureLocked = false, error = '' }) {
  const [form, setForm] = useState({ ...initial, amount: initial.amount ?? '', linked_account: initial.linked_account ?? '' })
  const formIdPrefix = initial.incomedesc ? 'edit-income-type' : 'create-income-type'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: accounts = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })

  useEffect(() => {
    if (!initial.incomedesc && !form.linked_account && accounts.length > 0) {
      setForm(f => ({ ...f, linked_account: accounts[0].balancedesc }))
    }
  }, [accounts, initial.incomedesc, form.linked_account])

  const handleSubmit = e => {
    e.preventDefault()
    onSubmit({ ...form, amount: Number.parseFloat(form.amount) || 0, linked_account: form.linked_account })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-800/30 dark:bg-red-950/10 dark:text-red-300">
          {error}
        </div>
      )}
      <div>
        <label htmlFor={`${formIdPrefix}-description`} className="label">Description <span className="text-red-500">*</span></label>
        <input id={`${formIdPrefix}-description`} required disabled={structureLocked} className="input" value={form.incomedesc} onChange={e => set('incomedesc', e.target.value)} placeholder="e.g. Salary" />
      </div>
      <div>
        <label htmlFor={`${formIdPrefix}-amount`} className="label">Default Amount</label>
        <LocalizedAmountInput id={`${formIdPrefix}-amount`} min="0" className="input" value={form.amount} onChange={value => set('amount', value)} />
      </div>
      <div>
        <label htmlFor={`${formIdPrefix}-linked-account`} className="label">Paid into Account <span className="text-red-500">*</span></label>
        <select id={`${formIdPrefix}-linked-account`} required className="input" value={form.linked_account} onChange={e => set('linked_account', e.target.value)}>
          {accounts.map(a => <option key={a.balancedesc} value={a.balancedesc}>{a.balancedesc}</option>)}
        </select>
      </div>
      {structureLocked && (
        <AlertBanner
          tone="info"
          description="Edits to this income source only apply to new budget cycles. Existing cycles can be updated from the budget cycle details page."
        />
      )}
      <div className="space-y-3">
        <label htmlFor={`${formIdPrefix}-autoinclude`} className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            id={`${formIdPrefix}-autoinclude`}
            type="checkbox"
            checked={!!form.autoinclude}
            onChange={e => set('autoinclude', e.target.checked)}
            className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500"
          />
          <span className="space-y-0.5">
            <span className="block font-medium text-gray-800 dark:text-gray-100">Auto-include</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Will automatically add this to any new budget cycles generated. Uncheck this if you only want to add it manually when needed.</span>
          </span>
        </label>
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

export default function IncomeTypesTab({ budgetId, budget }) {
  const { formatCurrency } = useLocalisation()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)
  const [actionError, setActionError] = useState('')

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', budgetId],
    queryFn: () => getBudgetSetupAssessment(budgetId),
  })
  const historyQuery = useQuery({
    queryKey: ['income-type-history', budgetId, historyItem?.incomedesc],
    queryFn: () => getIncomeTypeHistory(budgetId, historyItem.incomedesc),
    enabled: !!historyItem,
  })

  const formatApiError = (error, fallback) => {
    const detail = error?.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map(d => d.msg).filter(Boolean).join('. ') || fallback
    return fallback
  }

  const create = useMutation({
    mutationFn: data => createIncomeType(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(formatApiError(error, 'Unable to save this income source right now.')),
  })

  const update = useMutation({
    mutationFn: ({ desc, data }) => updateIncomeType(budgetId, desc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      qc.invalidateQueries({ queryKey: ['income-type-history', budgetId] })
      setActionError('')
      setModal(null)
    },
    onError: error => setActionError(formatApiError(error, 'Unable to update this income source right now.')),
  })

  const remove = useMutation({
    mutationFn: desc => deleteIncomeType(budgetId, desc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-types', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-setup-assessment', budgetId] })
      qc.invalidateQueries({ queryKey: ['income-type-history', budgetId] })
      setActionError('')
    },
    onError: error => setActionError(formatApiError(error, 'Unable to delete this income source right now.')),
  })

  const handleSubmit = form => {
    setActionError('')
    if (modal.mode === 'create') {
      create.mutate(form)
      return
    }
    const original = modal.item
    const data = {}
    const formAmount = Number.parseFloat(form.amount) || 0
    const originalAmount = Number.parseFloat(original.amount) || 0
    if (form.incomedesc !== original.incomedesc) data.incomedesc = form.incomedesc
    if (formAmount !== originalAmount) data.amount = formAmount
    if (form.linked_account !== original.linked_account) data.linked_account = form.linked_account
    if (form.autoinclude !== original.autoinclude) data.autoinclude = form.autoinclude
    if (Object.keys(data).length === 0) {
      setModal(null)
      return
    }
    update.mutate({ desc: original.incomedesc, data })
  }

  const incomeUsageByDesc = Object.fromEntries((setupAssessment?.income_types || []).map(item => [item.incomedesc, item]))

  const mobileColumns = [
    { key: 'incomedesc', label: 'Description', render: v => <span className="font-medium">{v}</span> },
    { key: 'amount', label: 'Amount', render: v => formatCurrency(v) },
    { key: 'linked_account', label: 'Paid into Account', render: v => v ?? <span className="text-gray-400 italic">—</span> },
    { key: 'autoinclude', label: 'Auto', render: v => v ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span> },
    { key: 'revisionnum', label: 'Rev', render: v => v },
  ]

  const mobileActions = row => {
    const usage = incomeUsageByDesc[row.incomedesc]
    return (
      <>
        <button className="btn-secondary min-h-11 min-w-11 justify-center" title="View history details" onClick={() => setHistoryItem(row)}>
          <ClockIcon className="w-3 h-3" />
        </button>
        <button className="btn-secondary min-h-11 min-w-11 justify-center" onClick={() => setModal({ mode: 'edit', item: row })}>
          <PencilIcon className="w-3 h-3" />
        </button>
        <button className="btn-danger min-h-11 min-w-11 justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={usage ? usage.can_delete === false : false} title={usage?.can_delete === false ? usage.reasons.join('. ') : undefined} onClick={() => { if (globalThis.confirm(`Delete "${row.incomedesc}"?`)) remove.mutate(row.incomedesc) }}>
          <TrashIcon className="w-3 h-3" />
        </button>
      </>
    )
  }

  const mobileStatus = row => {
    const usage = incomeUsageByDesc[row.incomedesc]
    return usage?.in_use ? <span className="badge-blue">In Use</span> : null
  }

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> Add Income Source
        </button>
      </div>

      {types.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">No income sources defined yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="table-header-cell text-left">Description</th>
                  <th className="table-header-cell text-right">Amount</th>
                  <th className="table-header-cell text-left">Paid into Account</th>
                  <th className="table-header-cell text-center">Auto</th>
                  <th className="table-header-cell text-left">Rev</th>
                  <th className="table-header-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {types.map(t => {
                  const usage = incomeUsageByDesc[t.incomedesc]
                  return (
                  <tr key={t.incomedesc} className="table-row">
                    <td className="table-cell font-medium text-gray-800 dark:text-gray-100">
                      {t.incomedesc}
                      {usage?.in_use ? <span className="ml-2 badge-blue">In Use</span> : null}
                    </td>
                    <td className="table-cell text-right text-gray-600 dark:text-gray-300">{formatCurrency(t.amount)}</td>
                    <td className="table-cell text-gray-600 dark:text-gray-300">{t.linked_account ?? <span className="text-gray-400 italic">—</span>}</td>
                    <td className="table-cell text-center">{t.autoinclude ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span>}</td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">{t.revisionnum}</td>
                    <td className="table-cell">
                      <div className="flex gap-1 justify-end">
                      <button className="btn-secondary" title="View history details" onClick={() => setHistoryItem(t)}>
                        <ClockIcon className="w-3 h-3" />
                      </button>
                      <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item: t })}>
                        <PencilIcon className="w-3 h-3" />
                      </button>
                      <button className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed" disabled={usage ? usage.can_delete === false : false} title={usage?.can_delete === false ? usage.reasons.join('. ') : undefined} onClick={() => { if (globalThis.confirm(`Delete "${t.incomedesc}"?`)) remove.mutate(t.incomedesc) }}>
                        <TrashIcon className="w-3 h-3" />
                      </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          <MobileTableCards
            columns={mobileColumns}
            rows={types}
            keyExtractor={row => row.incomedesc}
            actions={mobileActions}
            status={mobileStatus}
          />
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Income Source' : 'Edit Income Source'} onClose={() => setModal(null)}>
          <IncomeTypeForm
            initial={modal.item ? {
              incomedesc: modal.item.incomedesc,
              issavings: modal.item.issavings,
              autoinclude: modal.item.autoinclude,
              amount: modal.item.amount,
              linked_account: modal.item.linked_account ?? '',
            } : emptyForm}
            structureLocked={modal.item ? incomeUsageByDesc[modal.item.incomedesc]?.can_edit_structure === false : false}
            error={actionError}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending || update.isPending}
            budgetId={budgetId}
          />
        </Modal>
      )}

      {historyItem && (
        <SetupItemHistoryModal
          historyQuery={historyQuery}
          itemDesc={historyItem.incomedesc}
          category="income"
          currentItem={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}

IncomeTypeForm.propTypes = {
  initial: PropTypes.shape({
    incomedesc: PropTypes.string,
    issavings: PropTypes.bool,
    autoinclude: PropTypes.bool,
    amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    linked_account: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  budgetId: PropTypes.number.isRequired,
  structureLocked: PropTypes.bool,
  error: PropTypes.string,
}

IncomeTypesTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({}),
}
