import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getBalanceTypes, createBalanceType, updateBalanceType, deleteBalanceType, getBudgetSetupAssessment } from '../../api/client'
import Modal from '../../components/Modal'
import LocalizedAmountInput from '../../components/LocalizedAmountInput'
import { useLocalisation } from '../../components/LocalisationContext'
import { getBalanceTypeLabel, getPreferredTransactionLabel } from '../../utils/accountNaming'

const BALANCE_TYPE_OPTIONS = ['Transaction', 'Savings', 'Cash']
const emptyForm = { balancedesc: '', balance_type: 'Transaction', opening_balance: '', active: true, is_primary: false }

function getPrimaryAccountTypeLabel(balanceType, accountNamingPreference) {
  return getBalanceTypeLabel(balanceType, accountNamingPreference).toLowerCase()
}

function getPrimaryAccountName(accounts, balanceType, currentDesc = null) {
  return accounts.find(
    account =>
      account.balance_type === balanceType &&
      account.is_primary &&
      account.active &&
      account.balancedesc !== currentDesc
  )?.balancedesc ?? null
}

function buildSimulatedAccounts(accounts, currentDesc = null, nextForm = null) {
  const simulated = accounts.map(account => {
    if (account.balancedesc !== currentDesc || !nextForm) {
      return account
    }

    return {
      ...account,
      active: nextForm.active,
      is_primary: nextForm.is_primary,
    }
  })

  if (!currentDesc && nextForm) {
    simulated.push(nextForm)
  }

  return simulated
}

function hasAnyActivePrimary(accounts, balanceType, currentDesc = null, nextForm = null) {
  return buildSimulatedAccounts(accounts, currentDesc, nextForm)
    .some(account => account.active && account.is_primary && account.balance_type === balanceType)
}

function hasAnyActiveTransactionAccount(accounts, currentDesc = null, nextForm = null) {
  return buildSimulatedAccounts(accounts, currentDesc, nextForm)
    .some(account => account.active && account.balance_type === 'Transaction')
}

function canDeleteAccount(accounts, account, usage) {
  if (usage ? usage.can_delete === false : false) {
    return false
  }

  if (!(account.active && account.is_primary && account.balance_type === 'Transaction')) {
    return true
  }

  const otherActiveTransactions = accounts.filter(candidate =>
    candidate.balancedesc !== account.balancedesc &&
    candidate.active &&
    candidate.balance_type === 'Transaction'
  )

  if (otherActiveTransactions.length === 0) {
    return true
  }

  return accounts.some(candidate =>
    candidate.balancedesc !== account.balancedesc &&
    candidate.active &&
    candidate.is_primary
  )
}

function getDeleteDisabledReason(account, usage) {
  if (usage?.can_delete === false) {
    return usage.reasons.join('. ')
  }

  if (account.active && account.is_primary && account.balance_type === 'Transaction') {
    return 'Choose another primary account before deleting this one.'
  }

  return undefined
}

function BalanceTypeForm({
  initial = emptyForm,
  onSubmit,
  onClose,
  loading,
  structureLocked = false,
  lockReasons = [],
  accountNamingPreference = 'Transaction',
  existingAccounts = [],
  mode = 'create',
}) {
  const [form, setForm] = useState({ ...initial, opening_balance: initial.opening_balance ?? '' })
  const [confirmation, setConfirmation] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const formIdPrefix = initial.balancedesc ? 'edit-balance-type' : 'create-balance-type'
  const currentDesc = initial.balancedesc ?? null
  const openingBalanceLocked = structureLocked && currentDesc != null
  const primaryAccountLabel = getPrimaryAccountTypeLabel(form.balance_type, accountNamingPreference)
  const transactionAccountLabel = getPreferredTransactionLabel(accountNamingPreference).toLowerCase()

  const submitForm = nextForm => {
    onSubmit({ ...nextForm, opening_balance: Number.parseFloat(nextForm.opening_balance) || 0 })
  }

  const handleSubmit = e => {
    e.preventDefault()
    const nextForm = { ...form, opening_balance: Number.parseFloat(form.opening_balance) || 0 }
    const currentPrimaryName = getPrimaryAccountName(existingAccounts, nextForm.balance_type, currentDesc)
    const willHaveTransactionPrimary = hasAnyActivePrimary(existingAccounts, 'Transaction', currentDesc, nextForm)

    if (!willHaveTransactionPrimary && hasAnyActiveTransactionAccount(existingAccounts, currentDesc, nextForm)) {
      setConfirmation({
        type: 'missing-primary',
        title: 'Primary Account Required',
      })
      return
    }

    if (nextForm.is_primary && currentPrimaryName && currentPrimaryName !== nextForm.balancedesc) {
      setConfirmation({
        type: 'switch-primary',
        title: 'Switch Primary Account?',
        currentPrimaryName,
      })
      return
    }

    submitForm(nextForm)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
        <label htmlFor={`${formIdPrefix}-name`} className="label">Account Name <span className="text-red-500">*</span></label>
        <input id={`${formIdPrefix}-name`} required disabled={structureLocked} className="input" value={form.balancedesc} onChange={e => set('balancedesc', e.target.value)} placeholder="e.g. Everyday Account" />
        </div>
        <div>
        <label htmlFor={`${formIdPrefix}-type`} className="label">Account Type</label>
        <select id={`${formIdPrefix}-type`} disabled={structureLocked} className="input" value={form.balance_type} onChange={e => set('balance_type', e.target.value)}>
          {BALANCE_TYPE_OPTIONS.map(o => <option key={o} value={o}>{getBalanceTypeLabel(o, accountNamingPreference)}</option>)}
        </select>
        </div>
        <div>
        <label htmlFor={`${formIdPrefix}-opening-balance`} className="label">Opening Balance</label>
        <LocalizedAmountInput id={`${formIdPrefix}-opening-balance`} disabled={structureLocked} className="input" value={form.opening_balance} onChange={value => set('opening_balance', value)} placeholder="0.00" />
        {openingBalanceLocked && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Opening balance can only be changed before this account is used in a generated budget cycle or recorded movement.
          </p>
        )}
        </div>
        <div className="space-y-3">
          <label htmlFor={`${formIdPrefix}-active`} className="flex items-start gap-3 text-sm cursor-pointer">
            <input id={`${formIdPrefix}-active`} disabled={structureLocked} type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked)}
            className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
            <span className="space-y-0.5">
              <span className="block font-medium text-gray-800 dark:text-gray-100">Active</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Include in new budget cycles.</span>
            </span>
          </label>
          <label htmlFor={`${formIdPrefix}-primary`} className="flex items-start gap-3 text-sm cursor-pointer">
            <input id={`${formIdPrefix}-primary`} type="checkbox" checked={!!form.is_primary} onChange={e => set('is_primary', e.target.checked)}
            className="rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
            <span className="space-y-0.5">
              <span className="block font-medium text-gray-800 dark:text-gray-100">Primary {primaryAccountLabel} account</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {form.balance_type === 'Transaction'
                  ? 'Expenses are deducted from this account by default.'
                  : 'Use this as the primary account for this account type.'}
              </span>
            </span>
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

      {confirmation?.type === 'switch-primary' && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {confirmation.currentPrimaryName} is currently the primary {primaryAccountLabel} account. Saving will switch the primary {primaryAccountLabel} account to {form.balancedesc || 'this account'}.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmation(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => {
                const nextForm = { ...form, opening_balance: Number.parseFloat(form.opening_balance) || 0 }
                setConfirmation(null)
                submitForm(nextForm)
              }}>
                Switch Primary Account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmation?.type === 'missing-primary' && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              An active primary {transactionAccountLabel} account is required so expense deductions have a default account.
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setConfirmation(null)}>
                Back to Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

const TYPE_BADGE = {
  Transaction: 'badge-blue',
  Bank: 'badge-blue',
  Savings: 'badge-green',
  Cash: 'badge-amber',
}

export default function BalanceTypesTab({ budgetId, budget }) {
  const { formatCurrency } = useLocalisation()
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
      qc.invalidateQueries({ queryKey: ['period-summaries', budgetId] })
      qc.invalidateQueries({ queryKey: ['period-detail'] })
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
      qc.invalidateQueries({ queryKey: ['period-summaries', budgetId] })
      qc.invalidateQueries({ queryKey: ['period-detail'] })
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
      qc.invalidateQueries({ queryKey: ['period-summaries', budgetId] })
      qc.invalidateQueries({ queryKey: ['period-detail'] })
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
  const hasTransactionAccount = types.some(type => type.balance_type === 'Transaction')
  const hasActiveTransactionPrimary = types.some(type => type.active && type.is_primary && type.balance_type === 'Transaction')

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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="table-header-cell text-left">Account</th>
                <th className="table-header-cell text-left">Type</th>
                <th className="table-header-cell text-right">Opening Balance</th>
                <th className="table-header-cell text-center">Primary</th>
                <th className="table-header-cell text-center">Active</th>
                <th className="table-header-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {types.map(t => {
                const usage = accountUsageByDesc[t.balancedesc]
                const deleteAllowed = canDeleteAccount(types, t, usage)
                const deleteDisabledReason = !deleteAllowed ? getDeleteDisabledReason(t, usage) : undefined
                return (
                  <tr key={t.balancedesc} className="table-row">
                    <td className="table-cell font-medium text-gray-800 dark:text-gray-100">
                      {t.balancedesc}
                      {usage?.in_use ? <span className="ml-2 badge-amber">In Use</span> : null}
                    </td>
                    <td className="table-cell">
                      <span className={TYPE_BADGE[t.balance_type] ?? 'badge-gray'}>{getBalanceTypeLabel(t.balance_type, accountNamingPreference)}</span>
                    </td>
                    <td className="table-cell text-right text-gray-600 dark:text-gray-300">{formatCurrency(t.opening_balance)}</td>
                    <td className="table-cell text-center">{t.is_primary ? <span className="badge-green">Yes</span> : <span className="badge-gray">—</span>}</td>
                    <td className="table-cell text-center">{t.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}</td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', item: t })}>
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button className="btn-danger" disabled={!deleteAllowed} title={deleteDisabledReason} onClick={() => { if (globalThis.confirm(`Delete "${t.balancedesc}"?`)) remove.mutate(t.balancedesc) }}>
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
        <Modal title={modal.mode === 'create' ? 'Add Account' : 'Edit Account'} onClose={() => setModal(null)}>
          <BalanceTypeForm
            initial={modal.item ? {
              balancedesc: modal.item.balancedesc,
              balance_type: modal.item.balance_type,
              opening_balance: modal.item.opening_balance,
              active: modal.item.active,
              is_primary: modal.item.is_primary ?? false,
            } : {
              ...emptyForm,
              is_primary: !hasActiveTransactionPrimary && !hasTransactionAccount,
            }}
            structureLocked={modal.item ? accountUsageByDesc[modal.item.balancedesc]?.can_edit_structure === false : false}
            lockReasons={modal.item ? (accountUsageByDesc[modal.item.balancedesc]?.reasons || []) : []}
            accountNamingPreference={accountNamingPreference}
            existingAccounts={types}
            mode={modal.mode}
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
  existingAccounts: PropTypes.arrayOf(PropTypes.shape({
    balancedesc: PropTypes.string.isRequired,
    balance_type: PropTypes.string,
    active: PropTypes.bool,
    is_primary: PropTypes.bool,
  })),
  mode: PropTypes.oneOf(['create', 'edit']),
}

BalanceTypesTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    account_naming_preference: PropTypes.string,
  }),
}
