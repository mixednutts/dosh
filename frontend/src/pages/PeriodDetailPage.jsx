import { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays } from 'date-fns'
import {
  LockClosedIcon, LockOpenIcon, ChevronRightIcon, PlusIcon,
  MinusIcon, TrashIcon, ListBulletIcon, Bars2Icon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import {
  getPeriodDetail, getBudget, setPeriodLock,
  getIncomeTransactions, addIncomeTransaction, deleteIncomeTransaction,
  addExpenseToPeriod, addIncomeToPeriod, savingsTransfer,
  getExpenseItems, getIncomeTypes, createExpenseItem, createIncomeType,
  getExpenseEntries, addExpenseEntry, deleteExpenseEntry,
  reorderPeriodExpenses, getBalanceTransactions,
  getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction,
  setPeriodExpenseStatus, updatePeriodExpenseBudget, removePeriodExpense,
  updatePeriodInvestmentBudget, getBalanceTypes, removePeriodIncome, updatePeriodIncomeBudget,
  setPeriodInvestmentStatus, getPeriodCloseoutPreview, closeOutPeriod,
} from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import AmountExpressionInput from '../components/AmountExpressionInput'

const fmt = v => Number(v ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
const SECONDARY_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
const DELETE_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
const DISABLED_ICON_BUTTON_CLASSES = 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400'
const ICON_BUTTON_TONES = {
  success: 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/40 dark:text-success-400 dark:hover:bg-success-900/60',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60',
  dosh: 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60',
}

function iconButtonClassName(disabled, tone) {
  const toneClasses = ICON_BUTTON_TONES[tone] ?? SECONDARY_BUTTON_CLASSES
  return `flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${
    disabled ? DISABLED_ICON_BUTTON_CLASSES : toneClasses
  }`
}

function getResolvedAmountValue(amountState, min = 0) {
  if (amountState.state !== 'valid' || amountState.value == null || amountState.value < min) {
    return null
  }
  return amountState.value
}

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

function getBudgetAdjustmentText(item) {
  return `Budget ${fmt(item.budget_before_amount)} -> ${fmt(item.budget_after_amount)}`
}

function buildTransactionDisplayResolver(config) {
  return (item, itemAmount) => {
    if (item.entry_kind === 'budget_adjustment') {
      return {
        amountClassName: 'text-dosh-700 dark:text-dosh-300',
        badgeClassName: 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-300',
        badgeLabel: 'Adj',
        primaryText: getBudgetAdjustmentText(item),
      }
    }

    const isPositive = itemAmount >= 0
    const tone = isPositive ? config.positiveTone : config.negativeTone
    return {
      amountClassName: config.amountClassNames[tone],
      badgeClassName: config.badgeClassNames[tone],
      badgeLabel: isPositive ? '+' : '−',
      primaryText: fmt(Math.abs(item.amount)),
    }
  }
}

function getTransactionModalConfig(kind) {
  const shared = {
    positiveTone: 'dosh',
    negativeTone: 'danger',
    amountClassNames: {
      success: 'text-success-700 dark:text-success-400',
      danger: 'text-red-700 dark:text-red-400',
      dosh: 'text-dosh-700 dark:text-dosh-400',
    },
    badgeClassNames: {
      success: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400',
      danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      dosh: 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-400',
    },
  }

  const configs = {
    income: {
      ...shared,
      positiveTone: 'success',
      summaryItems: ({ budgetAmount, actualAmount }) => {
        const variance = Number(actualAmount) - Number(budgetAmount)
        return [
          { label: 'Budget', value: budgetAmount, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: actualAmount, cls: 'text-success-700 dark:text-success-400 font-bold' },
          { label: 'Variance', value: variance, cls: variance >= 0 ? 'text-success-600' : 'text-red-600' },
        ]
      },
      totalClassName: totalValue => (totalValue >= 0 ? 'text-success-700 dark:text-success-400' : 'text-red-700 dark:text-red-400'),
      typeOptions: [
        { value: 'credit', label: 'Income (+)', activeClassName: 'bg-success-600', submitClassName: 'btn-primary' },
        { value: 'debit', label: 'Correction (−)', activeClassName: 'bg-red-600', submitClassName: 'btn-danger' },
      ],
      submitLabel: currentType => (currentType === 'credit' ? 'Add Income' : 'Add Correction'),
      toMutationAmount: (entryType, value) => (entryType === 'credit' ? value : -value),
    },
    expense: {
      ...shared,
      positiveTone: 'danger',
      negativeTone: 'dosh',
      summaryItems: ({ budgetAmount, actualAmount }) => {
        const variance = Number(budgetAmount) - Number(actualAmount)
        return [
          { label: 'Budget', value: budgetAmount, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: actualAmount, cls: 'text-dosh-700 dark:text-dosh-400 font-bold' },
          { label: 'Variance', value: variance, cls: variance >= 0 ? 'text-dosh-600' : 'text-red-600' },
        ]
      },
      totalClassName: totalValue => (totalValue >= 0 ? 'text-red-700 dark:text-red-400' : 'text-dosh-600 dark:text-dosh-400'),
      typeOptions: [
        { value: 'debit', label: 'Expense (+)', activeClassName: 'bg-red-600', submitClassName: 'btn-danger' },
        { value: 'credit', label: 'Refund (−)', activeClassName: 'bg-dosh-600', submitClassName: 'btn-primary' },
      ],
      submitLabel: currentType => `Add ${currentType === 'debit' ? 'Expense' : 'Refund'}`,
      toMutationAmount: (entryType, value) => (entryType === 'debit' ? value : -value),
    },
    investment: {
      ...shared,
      summaryItems: ({ budgetAmount, actualAmount }) => {
        const remaining = Number(budgetAmount ?? 0) - Number(actualAmount)
        return [
          { label: 'Budget', value: budgetAmount ?? 0, cls: 'text-gray-600 dark:text-gray-400' },
          { label: 'Actual', value: actualAmount, cls: 'text-dosh-700 dark:text-dosh-400 font-bold' },
          { label: 'Remaining', value: remaining, cls: remaining >= 0 ? 'text-dosh-600' : 'text-red-600' },
        ]
      },
      typeOptions: [
        { value: 'increase', label: 'Add (+)', activeClassName: 'bg-dosh-600', submitClassName: 'btn-primary' },
        { value: 'decrease', label: 'Subtract (−)', activeClassName: 'bg-red-600', submitClassName: 'btn-danger' },
      ],
      submitLabel: currentType => (currentType === 'increase' ? 'Add' : 'Subtract'),
      toMutationAmount: (entryType, value) => (entryType === 'increase' ? value : -value),
    },
  }

  return configs[kind]
}

function buildAddTransactionHandler({ event, resolvedAmount, setError, mutate, type, note, toMutationAmount }) {
  event.preventDefault()
  const amountValue = getResolvedAmountValue(resolvedAmount, 0.01)
  if (amountValue == null) {
    setError('Enter a valid amount')
    return
  }
  setError('')
  mutate({ amount: toMutationAmount(type, amountValue), note: note || null })
}

function createTransactionSubmitHandler({ resolvedAmount, setError, mutate, type, note, toMutationAmount }) {
  return event => {
    buildAddTransactionHandler({
      event,
      resolvedAmount,
      setError,
      mutate,
      type,
      note,
      toMutationAmount,
    })
  }
}

function getProgressToneClasses({ isOver, isNearLimit, status }) {
  let trackClass = 'bg-gray-200 dark:bg-gray-700'
  let fillClass = 'bg-dosh-500'
  let labelClass = 'text-gray-700 dark:text-gray-200'

  if (isOver) {
    trackClass = 'bg-red-100 dark:bg-red-900/30'
    fillClass = 'bg-red-500'
    labelClass = 'text-red-700 dark:text-red-300'
  } else if (isNearLimit) {
    trackClass = 'bg-amber-100 dark:bg-amber-900/30'
    fillClass = 'bg-amber-500'
  }

  if (!isOver && status === 'Revised') {
    labelClass = 'text-amber-700 dark:text-amber-300'
  }

  return { trackClass, fillClass, labelClass }
}

function getPeriodBudgetMutation(category, mutations) {
  if (category === 'income') return mutations.editIncomeBudget
  if (category === 'expense') return mutations.editExpenseBudget
  return mutations.editInvBudget
}

function getExpenseScheduleBadge(expense) {
  if (expense.is_oneoff) {
    return <span className="badge-amber">One-off</span>
  }

  const label = freqLabel(expense.freqtype, expense.frequency_value)
  if (!label) {
    return <span className="badge-gray">—</span>
  }

  const nextDue = calcNextDue(expense.freqtype, expense.frequency_value, expense.effectivedate)
  return (
    <span className="badge-blue" title={nextDue ? `Next: ${format(nextDue, 'dd MMM yyyy')}` : undefined}>
      {label}
    </span>
  )
}

function getTransactionListContent({ isLoading, items, emptyLabel, maxHeightClass, locked, onDelete, getItemAmount, getBadgeClassName, getBadgeLabel, getAmountClassName, getPrimaryText }) {
  if (isLoading) {
    return <div className="flex justify-center py-4"><Spinner className="h-4 w-4" /></div>
  }

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm italic text-gray-400">{emptyLabel}</p>
  }

  return (
    <div className={`divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800 ${maxHeightClass}`}>
      {items.map(item => {
        const amount = Number(getItemAmount(item))
        return (
          <div key={item.id} className="flex items-center gap-2 px-3 py-2">
            <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getBadgeClassName(item)}`}>
              {getBadgeLabel(item, amount)}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${getAmountClassName(item, amount)}`}>
                {getPrimaryText(item, amount)}
              </p>
              {item.note && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.note}</p>}
              <p className="text-xs text-gray-400">{format(parseISO(item.entrydate), 'dd MMM yyyy HH:mm')}</p>
            </div>
            {!locked && item.entry_kind !== 'budget_adjustment' && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function calcNextDue(freqtype, frequencyValue, effectivedate) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (!freqtype || freqtype === 'Always') return null
  if (freqtype === 'Fixed Day of Month') {
    const day = Number.parseInt(frequencyValue, 10); if (!day) return null
    let c = new Date(today.getFullYear(), today.getMonth(), day)
    if (c < today) c = new Date(today.getFullYear(), today.getMonth() + 1, day)
    return c
  }
  if (freqtype === 'Every N Days') {
    const n = Number.parseInt(frequencyValue, 10); if (!n || !effectivedate) return null
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
  if (freqtype === 'Always') return 'Always included'
  if (freqtype === 'Fixed Day of Month') return `Recurring: Day ${frequencyValue}`
  if (freqtype === 'Every N Days') return `Recurring: Every ${frequencyValue}d`
  return freqtype
}

function ActionIconButton({ disabled = false, title, onClick, tone = 'neutral', icon: Icon }) {
  const className = tone === 'neutral'
    ? SECONDARY_BUTTON_CLASSES
    : iconButtonClassName(disabled, tone)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={className}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

function EmptyActionSlot() {
  return <span className="block w-7 h-7" />
}

function DeleteActionButton({ onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={DELETE_BUTTON_CLASSES}
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  )
}

function BudgetAmountCell({ amount, canEdit, onEdit, label }) {
  return (
    <div className="flex w-full items-center justify-end gap-1.5">
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          title={`Edit ${label} budget`}
          aria-label={`Edit budget for ${label}`}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-dosh-700 transition-colors hover:bg-dosh-50 dark:text-dosh-400 dark:hover:bg-dosh-900/20"
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
      )}
      <span>{fmt(amount)}</span>
    </div>
  )
}

function AmountSummaryGrid({ items, columns = 3 }) {
  return (
    <div className={`grid gap-2 text-center text-xs ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {items.map(({ label, value, cls }) => (
        <div key={label} className="card p-2">
          <p className="text-gray-400">{label}</p>
          <p className={`font-semibold ${cls}`}>{fmt(value)}</p>
        </div>
      ))}
    </div>
  )
}

function TransactionListPanel({
  items,
  isLoading,
  locked,
  headerLabel,
  emptyLabel,
  maxHeightClass = 'max-h-52',
  totalValue = null,
  totalClassName = null,
  getItemAmount,
  getAmountClassName,
  getBadgeClassName,
  getBadgeLabel,
  getPrimaryText,
  onDelete,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <span>{headerLabel}</span>
        <span>{items.length} entries</span>
      </div>
      {getTransactionListContent({
        isLoading,
        items,
        emptyLabel,
        maxHeightClass,
        locked,
        onDelete,
        getItemAmount,
        getBadgeClassName,
        getBadgeLabel,
        getAmountClassName,
        getPrimaryText,
      })}
      {items.length > 0 && totalValue != null && (
        <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800">
          <span className="text-gray-600 dark:text-gray-400">Total</span>
          <span className={totalClassName}>{fmt(totalValue)}</span>
        </div>
      )}
    </div>
  )
}

function TransactionEntryForm({
  kind,
  locked,
  amount,
  setAmount,
  note,
  setNote,
  error,
  setError,
  setResolvedAmount,
  budgetAmount,
  type,
  setType,
  typeOptions,
  onSubmit,
  submitLabel,
  isPending,
  onClose,
  actualAmount,
}) {
  if (locked) {
    return (
      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    )
  }

  const selectedOption = typeOptions.find(option => option.value === type) ?? typeOptions[0]
  const noteInputId = `transaction-note-${selectedOption.value}`
  const remainingAmount = Number(budgetAmount ?? 0) - Number(actualAmount ?? 0)
  const usesRemainingQuickFill = (
    (kind === 'expense' && type === 'debit') ||
    (kind === 'investment' && type === 'increase')
  ) && remainingAmount > 0
  const quickFillValue = usesRemainingQuickFill ? remainingAmount : Number(budgetAmount)
  const quickFillLabel = usesRemainingQuickFill ? 'Add Remaining' : 'Full'

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-200 pt-1 dark:border-gray-700">
      <div className="flex overflow-hidden rounded-md border border-gray-200 text-sm dark:border-gray-700">
        {typeOptions.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              type === option.value
                ? `${option.activeClassName} text-white`
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <AmountExpressionInput
            value={amount}
            onChange={nextValue => {
              setAmount(nextValue)
              setError('')
            }}
            onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
            min={0.01}
            placeholder="Amount"
            className="input w-full"
            required
          />
        </div>
        {Number(budgetAmount) > 0 && (
          <button
            type="button"
            onClick={() => {
              setAmount(String(quickFillValue))
              setError('')
            }}
            className="btn-secondary whitespace-nowrap text-xs"
            title={usesRemainingQuickFill ? 'Allocate remaining budget amount' : 'Allocate full budget amount'}
          >
            {quickFillLabel} ({fmt(quickFillValue)})
          </button>
        )}
        <label htmlFor={noteInputId} className="sr-only">Transaction note</label>
        <input
          id={noteInputId}
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="input flex-[2]"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        <button type="submit" disabled={isPending} className={selectedOption.submitClassName}>
          {isPending ? 'Saving…' : submitLabel(type)}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  )
}

function TransactionWorkflowModal({
  kind,
  items,
  isLoading,
  locked,
  readOnly = false,
  amount,
  setAmount,
  note,
  setNote,
  error,
  setError,
  setResolvedAmount,
  budgetAmount,
  actualAmount,
  type,
  setType,
  onSubmit,
  isPending,
  onDelete,
  onClose,
  totalValue = null,
}) {
  const config = getTransactionModalConfig(kind)
  const resolveDisplay = buildTransactionDisplayResolver(config)
  const interactionLocked = locked || readOnly

  return (
    <div className="space-y-4">
      <AmountSummaryGrid items={config.summaryItems({ budgetAmount, actualAmount })} />
      <TransactionListPanel
        items={items}
        isLoading={isLoading}
        locked={interactionLocked}
        headerLabel="Transactions"
        emptyLabel="No transactions yet"
        totalValue={totalValue}
        totalClassName={typeof config.totalClassName === 'function' ? config.totalClassName(totalValue) : null}
        getItemAmount={item => item.amount}
        getAmountClassName={(item, itemAmount) => resolveDisplay(item, itemAmount).amountClassName}
        getBadgeClassName={(item, itemAmount) => resolveDisplay(item, itemAmount).badgeClassName}
        getBadgeLabel={(item, itemAmount) => resolveDisplay(item, itemAmount).badgeLabel}
        getPrimaryText={(item, itemAmount) => resolveDisplay(item, itemAmount).primaryText}
        onDelete={onDelete}
      />
      {readOnly ? (
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <TransactionEntryForm
          kind={kind}
          locked={locked}
          amount={amount}
          setAmount={setAmount}
          note={note}
          setNote={setNote}
          error={error}
          setError={setError}
          setResolvedAmount={setResolvedAmount}
          budgetAmount={budgetAmount}
          type={type}
          setType={setType}
          typeOptions={config.typeOptions}
          onSubmit={onSubmit}
          submitLabel={config.submitLabel}
          isPending={isPending}
          onClose={onClose}
          actualAmount={actualAmount}
        />
      )}
    </div>
  )
}

function ProgressStatusPill({ item, budgetAmount, actualAmount, remainingAmount, status, onMarkPaid, onRevise }) {
  const budget = Number(budgetAmount ?? 0)
  const actual = Number(actualAmount ?? 0)
  const remaining = Number(remainingAmount ?? 0)
  const rawPercent = budget > 0 ? (actual / budget) * 100 : 0
  const clampedPercent = Math.max(0, Math.min(rawPercent, 100))
  const isOver = rawPercent > 100
  const isNearLimit = rawPercent >= 90 && rawPercent <= 100
  const revisionComment = item.revision_comment?.trim()
  const title = budget > 0
    ? `${Math.round(rawPercent)}% spent • ${fmt(actual)} of ${fmt(budget)} • Remaining ${fmt(remaining)}`
    : `No budget set • Actual ${fmt(actual)}`

  if (status === 'Paid') {
    const paidCls = isOver
      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
      : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-300 dark:hover:bg-dosh-900/60'
    return (
      <button
        type="button"
        onClick={onRevise}
        title={`${title} • Click to reopen as Revised`}
        className={`inline-flex min-w-[108px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${paidCls}`}
      >
        Paid
      </button>
    )
  }

  const { trackClass, fillClass, labelClass } = getProgressToneClasses({ isOver, isNearLimit, status })
  const revisionSuffix = revisionComment ? ` • Revision: ${revisionComment}` : ''
  const progressTitle = `${title}${revisionSuffix} • Click to mark Paid`

  return (
    <button
      type="button"
      onClick={onMarkPaid}
      title={progressTitle}
      className="inline-flex min-w-[108px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-left text-xs transition-colors hover:border-dosh-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-dosh-700 dark:hover:bg-gray-700"
    >
      <span className={`w-10 flex-shrink-0 font-semibold ${labelClass}`}>
        {status === 'Revised' ? 'Rev' : 'Spent'}
      </span>
      <span className={`relative h-2 flex-1 overflow-hidden rounded-full ${trackClass}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`} style={{ width: `${clampedPercent}%` }} />
        {isOver && <span className="absolute inset-y-0 right-0 w-1 bg-red-700 dark:bg-red-400" />}
      </span>
    </button>
  )
}

function ConfirmPaidModal({ noun, item, remainingAmount, onConfirm, onClose }) {
  const remaining = Number(remainingAmount ?? 0)
  const isOver = remaining < 0
  const delta = fmt(Math.abs(remaining))

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-200">
        {isOver
          ? `This ${noun} is ${delta} over budget. Mark it as paid anyway?`
          : `This ${noun} still has ${delta} remaining against budget. Mark it as paid anyway?`}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Paid {noun}s are locked until revised.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => onConfirm(item)}>Mark Paid</button>
      </div>
    </div>
  )
}

function IncomeTransactionsModal({ periodId, incomedesc, budgetamount, actualamount, locked, onClose, defaultType = 'credit' }) {
  const config = getTransactionModalConfig('income')
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType) // credit | debit
  const [error, setError] = useState('')

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
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setError('')
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

  const handleAdd = createTransactionSubmitHandler({
    resolvedAmount,
    setError,
    mutate: add.mutate,
    type,
    note,
    toMutationAmount: config.toMutationAmount,
  })

  const runningTotal = transactions
    .filter(tx => tx.entry_kind !== 'budget_adjustment')
    .reduce((s, tx) => s + Number(tx.amount), 0)
  return (
    <TransactionWorkflowModal
      kind="income"
      items={transactions}
      isLoading={isLoading}
      locked={locked}
      amount={amount}
      setAmount={setAmount}
      note={note}
      setNote={setNote}
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
      budgetAmount={budgetamount}
      actualAmount={actualamount}
      type={type}
      setType={setType}
      onSubmit={handleAdd}
      isPending={add.isPending}
      onDelete={txId => remove.mutate(txId)}
      onClose={onClose}
      totalValue={runningTotal}
    />
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
                    {fmt(delta)}
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
function ExpenseEntriesModal({ periodId, budgetId, expensedesc, budgetamount, actualamount, locked, readOnly = false, onClose, defaultType = 'debit' }) {
  const config = getTransactionModalConfig('expense')
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType) // 'debit' | 'credit'
  const [error, setError] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['expense-entries', periodId, expensedesc],
    queryFn: () => getExpenseEntries(periodId, expensedesc),
  })

  const add = useMutation({
    mutationFn: data => addExpenseEntry(periodId, expensedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setError('')
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

  const handleAdd = createTransactionSubmitHandler({
    resolvedAmount,
    setError,
    mutate: add.mutate,
    type,
    note,
    toMutationAmount: config.toMutationAmount,
  })

  const runningTotal = entries.filter(entry => entry.entry_kind !== 'budget_adjustment').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <TransactionWorkflowModal
      kind="expense"
      items={entries}
      isLoading={isLoading}
      locked={locked}
      readOnly={readOnly}
      amount={amount}
      setAmount={setAmount}
      note={note}
      setNote={setNote}
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
      budgetAmount={budgetamount}
      actualAmount={actualamount}
      type={type}
      setType={setType}
      onSubmit={handleAdd}
      isPending={add.isPending}
      onDelete={entryId => remove.mutate(entryId)}
      onClose={onClose}
      totalValue={runningTotal}
    />
  )
}

ExpenseEntriesModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  expensedesc: PropTypes.string.isRequired,
  budgetamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['debit', 'credit']),
}

// ── Investment Transaction Modal ──────────────────────────────────────────────
function InvestmentTxModal({ periodId, investmentdesc, openingValue, closingValue, budgetedAmount, locked, readOnly = false, onClose, defaultType = 'increase' }) {
  const config = getTransactionModalConfig('investment')
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [type, setType] = useState(defaultType)
  const [error, setError] = useState('')

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['investment-tx', periodId, investmentdesc],
    queryFn: () => getInvestmentTransactions(periodId, investmentdesc),
  })

  const add = useMutation({
    mutationFn: data => addInvestmentTransaction(periodId, investmentdesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setError('')
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

  const handleAdd = createTransactionSubmitHandler({
    resolvedAmount,
    setError,
    mutate: add.mutate,
    type,
    note,
    toMutationAmount: config.toMutationAmount,
  })

  // Derive actual from transactions total for live display
  const txTotal = transactions.filter(tx => tx.entry_kind !== 'budget_adjustment').reduce((s, t) => s + Number(t.amount), 0)
  return (
    <TransactionWorkflowModal
      kind="investment"
      items={transactions}
      isLoading={isLoading}
      locked={locked}
      readOnly={readOnly}
      amount={amount}
      setAmount={setAmount}
      note={note}
      setNote={setNote}
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
      budgetAmount={budgetedAmount ?? 0}
      actualAmount={txTotal}
      type={type}
      setType={setType}
      onSubmit={handleAdd}
      isPending={add.isPending}
      onDelete={txId => remove.mutate(txId)}
      onClose={onClose}
      totalValue={null}
    />
  )
}

InvestmentTxModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  investmentdesc: PropTypes.string.isRequired,
  openingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  closingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  budgetedAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['increase', 'decrease']),
}

function BudgetAdjustmentModal({ title, currentAmount, onSubmit, onClose }) {
  const [budgetamount, setBudgetAmount] = useState(String(Number(currentAmount ?? 0)))
  const [resolvedAmount, setResolvedAmount] = useState({ value: Number(currentAmount ?? 0), state: 'valid' })
  const [scope, setScope] = useState('current')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = e => {
    e.preventDefault()
    const amount = getResolvedAmountValue(resolvedAmount, 0)
    if (amount == null) {
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
        <label className="label" htmlFor="budget-adjustment-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="budget-adjustment-amount"
          autoFocus
          value={budgetamount}
          onChange={nextValue => {
            setBudgetAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0}
          className="input w-full"
          required
        />
      </div>
      <div>
        <p className="label">Apply to</p>
        <div className="space-y-1.5 mt-1">
          {[['current', 'Current period only'], ['future', 'Current + future unlocked periods']].map(([value, label]) => (
            <label key={value} htmlFor={`budget-adjust-scope-${value}`} className="flex items-center gap-2 text-sm cursor-pointer">
              <input id={`budget-adjust-scope-${value}`} type="radio" name="budget-adjust-scope" value={value} checked={scope === value} onChange={() => setScope(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="budget-adjustment-comment">Comment</label>
        <textarea
          id="budget-adjustment-comment"
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
  return (
    <ProgressStatusPill
      item={expense}
      budgetAmount={expense.budgetamount}
      actualAmount={expense.actualamount}
      remainingAmount={expense.remaining_amount}
      status={expense.status}
      onMarkPaid={onMarkPaid}
      onRevise={onRevise}
    />
  )
}

function ConfirmPaidExpenseModal({ expense, onConfirm, onClose }) {
  return (
    <ConfirmPaidModal
      noun="expense"
      item={expense}
      remainingAmount={expense.remaining_amount}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}

function InvestmentStatusPill({ investment, onMarkPaid, onRevise }) {
  return (
    <ProgressStatusPill
      item={investment}
      budgetAmount={investment.budgeted_amount}
      actualAmount={investment.actualamount}
      remainingAmount={investment.remaining_amount}
      status={investment.status}
      onMarkPaid={onMarkPaid}
      onRevise={onRevise}
    />
  )
}

function ConfirmPaidInvestmentModal({ investment, onConfirm, onClose }) {
  return (
    <ConfirmPaidModal
      noun="investment"
      item={investment}
      remainingAmount={investment.remaining_amount}
      onConfirm={onConfirm}
      onClose={onClose}
    />
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
        <label htmlFor="create-next-cycle" className="flex items-center gap-2 text-sm cursor-pointer">
          <input id="create-next-cycle" type="checkbox" checked={createNextCycle} onChange={e => setCreateNextCycle(e.target.checked)} />
          <span>Create the next budget cycle automatically during close-out</span>
        </label>
      )}
      <div>
        <label htmlFor="closeout-comments" className="label">Comments / Observations</label>
        <textarea id="closeout-comments" className="input w-full resize-none" rows={4} value={comments} onChange={e => setComments(e.target.value)} />
      </div>
      <div>
        <label htmlFor="closeout-goals" className="label">Goals Going Forward</label>
        <textarea id="closeout-goals" className="input w-full resize-none" rows={4} value={goals} onChange={e => setGoals(e.target.value)} />
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
  const [mode, setMode] = useState('existing') // 'existing' | 'new' | 'savings'
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [scope, setScope] = useState('oneoff')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLinkedAccount, setNewLinkedAccount] = useState('')
  const [newAutoInclude, setNewAutoInclude] = useState(true)

  const { data: incomeTypes = [] } = useQuery({
    queryKey: ['income-types', budgetId],
    queryFn: () => getIncomeTypes(budgetId),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
    enabled: mode === 'new' || mode === 'savings',
  })

  const available = incomeTypes.filter(i => !existingDescs.includes(i.incomedesc))

  // Savings accounts not yet transferred in this period
  const savingsAccounts = balanceTypes.filter(bt =>
    bt.balance_type === 'Savings' &&
    !existingDescs.includes(`Transfer from ${bt.balancedesc}`)
  )

  const currentList = mode === 'savings' ? savingsAccounts : available

  const createItem = useMutation({ mutationFn: data => createIncomeType(budgetId, data) })

  const add = useMutation({
    mutationFn: data => addIncomeToPeriod(periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['income-types', budgetId] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to add income'),
  })

  const addTransfer = useMutation({
    mutationFn: data => savingsTransfer(periodId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); onClose() },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to record transfer'),
  })

  const isPending = createItem.isPending || add.isPending || addTransfer.isPending

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    try {
        if (mode === 'savings') {
        const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
        if (resolvedValue == null) { setError('Enter a valid budget amount'); return }
        if (!selected) { setError('Select a savings account'); return }
        addTransfer.mutate({ budgetid: budgetId, balancedesc: selected, amount: resolvedValue })
        return
      }

      const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
      if (resolvedValue == null) { setError('Enter a valid budget amount'); return }

      if (mode === 'new') {
        const trimmedDesc = newDesc.trim()
        if (!trimmedDesc) { setError('Enter a description'); return }
        await createItem.mutateAsync({
          incomedesc: trimmedDesc,
          issavings: false,
          autoinclude: newAutoInclude,
          amount: resolvedValue,
          linked_account: newLinkedAccount || null,
        })
        add.mutate({ budgetid: budgetId, incomedesc: trimmedDesc, budgetamount: resolvedValue, scope, note: note || null })
        return
      }

      if (!selected) { setError('Select an income source'); return }
      add.mutate({ budgetid: budgetId, incomedesc: selected, budgetamount: resolvedValue, scope, note: note || null })
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to add income')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
        {[['existing', 'Existing income'], ['new', 'New income'], ['savings', 'Transfer from Savings']].map(([val, label]) => (
          <button key={val} type="button" onClick={() => { setMode(val); setSelected(''); setAmount(''); setError('') }}
            className={`flex-1 py-1.5 font-medium transition-colors ${mode === val ? 'bg-dosh-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'new' ? (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="add-income-new-desc">Description</label>
            <input id="add-income-new-desc" required className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Bonus" />
          </div>
          <div>
            <label className="label" htmlFor="add-income-linked-account">Paid into Account</label>
            <select id="add-income-linked-account" className="input" value={newLinkedAccount} onChange={e => setNewLinkedAccount(e.target.value)}>
              <option value="">— none —</option>
              {balanceTypes.map(bt => (
                <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="new-income-auto-include" className="flex items-start gap-3 text-sm cursor-pointer">
              <input id="new-income-auto-include" type="checkbox" checked={newAutoInclude} onChange={e => setNewAutoInclude(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500" />
              <span className="space-y-0.5">
                <span className="block font-medium text-gray-800 dark:text-gray-100">Auto-include</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Will automatically add this to any new budget cycles generated. Uncheck this if you only want to add it manually when needed.</span>
              </span>
            </label>
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="add-income-existing-select">{mode === 'savings' ? 'Savings Account' : 'Income Source'}</label>
          {currentList.length === 0
            ? <p className="text-sm text-gray-500 italic">
                {mode === 'savings' ? 'No savings accounts available. Add a Savings account in budget settings.' : 'All income sources already in this budget cycle. Use "New income".'}
              </p>
            : <select id="add-income-existing-select" required className="input" value={selected} onChange={e => {
                setSelected(e.target.value)
                if (mode !== 'savings') {
                  const it = incomeTypes.find(i => i.incomedesc === e.target.value)
                  if (it) setAmount(String(it.amount))
                }
              }}>
                <option value="">— select —</option>
                {mode === 'savings'
                  ? currentList.map(bt => <option key={bt.balancedesc} value={bt.balancedesc}>{bt.balancedesc}</option>)
                  : currentList.map(i => <option key={i.incomedesc} value={i.incomedesc}>{i.incomedesc}</option>)}
              </select>}
        </div>
      )}
      <div>
        <label className="label" htmlFor="add-income-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="add-income-amount"
          value={amount}
          onChange={nextValue => {
            setAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0}
          className="input w-full"
        />
      </div>
      {mode !== 'savings' && (
        <div>
          <label className="label" htmlFor="add-income-note">Comment / Note</label>
          <textarea id="add-income-note" className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
        </div>
      )}
      {mode !== 'savings' && (
        <div>
          <p className="label">Include in</p>
          <div className="space-y-1.5 mt-1">
            {[['oneoff', 'This budget cycle only'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
              <label key={val} htmlFor={`income-scope-${val}`} className="flex items-center gap-2 text-sm cursor-pointer">
                <input id={`income-scope-${val}`} type="radio" name="income-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isPending || (mode !== 'new' && currentList.length === 0)}>{isPending ? 'Adding…' : 'Add'}</button>
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
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [scope, setScope] = useState('oneoff')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFreqtype, setNewFreqtype] = useState('Fixed Day of Month')
  const [newFreqVal, setNewFreqVal] = useState('')
  const [newPaytype, setNewPaytype] = useState('AUTO')
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
      const resolvedValue = getResolvedAmountValue(resolvedAmount, 0)
      if (resolvedValue == null) { setError('Enter a valid budget amount'); return }
      if (mode === 'new') {
        if (!newDesc.trim()) { setError('Enter a description'); return }
        await createItem.mutateAsync({ expensedesc: newDesc.trim(), active: true, freqtype: newFreqtype || null, frequency_value: newFreqVal ? Number.parseInt(newFreqVal, 10) : null, paytype: newPaytype || null, effectivedate: newEffDate || null, expenseamount: resolvedValue })
        addToperiod.mutate({ budgetid: budgetId, expensedesc: newDesc.trim(), budgetamount: resolvedValue, scope, note: note || null })
      } else {
        if (!selected) { setError('Select an expense item'); return }
        addToperiod.mutate({ budgetid: budgetId, expensedesc: selected, budgetamount: resolvedValue, scope, note: note || null })
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
          <label className="label" htmlFor="add-expense-existing-select">Expense Item</label>
          {available.length === 0
            ? <p className="text-sm text-gray-500 italic">All items already in this budget cycle. Use "New item".</p>
            : <select id="add-expense-existing-select" required className="input" value={selected} onChange={e => { setSelected(e.target.value); const ei = expenseItems.find(i => i.expensedesc === e.target.value); if (ei) setAmount(String(ei.expenseamount)) }}>
                <option value="">— select —</option>
                {available.map(e => <option key={e.expensedesc} value={e.expensedesc}>{e.expensedesc}</option>)}
              </select>}
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="label" htmlFor="add-expense-new-desc">Description <span className="text-red-500">*</span></label><input id="add-expense-new-desc" required className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Netflix" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="add-expense-freq-type">Freq Type</label><select id="add-expense-freq-type" className="input" value={newFreqtype} onChange={e => setNewFreqtype(e.target.value)}><option>Always</option><option>Fixed Day of Month</option><option>Every N Days</option></select></div>
            <div><label className="label" htmlFor="add-expense-freq-value">{newFreqtype === 'Every N Days' ? 'Interval (days)' : 'Day of Month'}</label><input id="add-expense-freq-value" type="number" min="1" className="input" value={newFreqVal} onChange={e => setNewFreqVal(e.target.value)} disabled={newFreqtype === 'Always'} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="add-expense-pay-type">Pay Type</label><select id="add-expense-pay-type" className="input" value={newPaytype} onChange={e => setNewPaytype(e.target.value)}><option>AUTO</option><option>MANUAL</option></select></div>
            <div><label className="label" htmlFor="add-expense-effective-date">Eff. Date</label><input id="add-expense-effective-date" type="date" className="input" value={newEffDate} onChange={e => setNewEffDate(e.target.value)} /></div>
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="add-expense-amount">Budget Amount ($)</label>
        <AmountExpressionInput
          id="add-expense-amount"
          value={amount}
          onChange={nextValue => {
            setAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0}
          className="input w-full"
        />
      </div>
      <div>
        <label className="label" htmlFor="add-expense-note">Comment / Note</label>
        <textarea id="add-expense-note" className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this line?" />
      </div>
      <div>
        <p className="label">Include in</p>
        <div className="space-y-1.5 mt-1">
          {[['oneoff', 'This budget cycle only (one-off)'], ['future', 'This + future unlocked budget cycles']].map(([val, label]) => (
            <label key={val} htmlFor={`expense-scope-${val}`} className="flex items-center gap-2 text-sm cursor-pointer">
              <input id={`expense-scope-${val}`} type="radio" name="exp-scope" value={val} checked={scope === val} onChange={() => setScope(val)} className="text-dosh-600" />
              <span>{label}</span>
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
  const id = Number.parseInt(periodId, 10)
  const qc = useQueryClient()
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [incomeModal, setIncomeModal] = useState(null)
  const [entriesModal, setEntriesModal] = useState(null)
  const [budgetAdjustModal, setBudgetAdjustModal] = useState(null)
  const [confirmPaidModal, setConfirmPaidModal] = useState(null)
  const [confirmPaidInvestmentModal, setConfirmPaidInvestmentModal] = useState(null)
  const [balanceModal, setBalanceModal] = useState(null)
  const [showCloseout, setShowCloseout] = useState(false)
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all')

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
    if (expenseStatusFilter !== 'all') return
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
  const totalInvestmentRemaining = investments.reduce((s, inv) => s + Math.max(Number(inv.remaining_amount ?? 0), 0), 0)
  const totalExpenseRemaining = expenses.reduce((s, e) => s + Math.max(Number(e.remaining_amount ?? 0), 0), 0)
  const totalBalanceOpening = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0), 0)
  const totalBalanceClosing = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0) + Number(b.movement_amount ?? 0), 0)
  const surplusActual = totalIncomeActual - totalExpenseActual - totalInvestmentActual
  const surplusBudget = surplusActual - totalExpenseRemaining - totalInvestmentRemaining
  const projectedSavings = Number(data.projected_savings ?? 0)
  const filteredExpenses = expenses.filter(expense => expenseStatusFilter === 'all' || expense.status === expenseStatusFilter)

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header-cell text-left">Description</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">
                  <span title="Sum of all transactions — read-only">Actual ∑</span>
                </th>
                <th className="table-header-cell text-right">Variance</th>
                <th className="table-header-cell text-center w-[152px]">Actions</th>
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
                    <BudgetAmountCell
                      amount={i.budgetamount}
                      canEdit={!locked && !closed && i.system_key !== 'carry_forward'}
                      onEdit={() => setBudgetAdjustModal({ category: 'income', desc: i.incomedesc, budgetamount: i.budgetamount, title: i.incomedesc })}
                      label={i.incomedesc}
                    />
                  </td>
                  <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(i.actualamount)}</td>
                  <td className="table-cell text-right">
                    <span className={`font-medium ${Number(i.actualamount) >= Number(i.budgetamount) ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmt(Number(i.actualamount) - Number(i.budgetamount))}
                    </span>
                  </td>
                  <td className="px-3 py-2 w-[152px]">
                    <div className="ml-auto grid w-[116px] grid-cols-4 justify-items-center gap-1">
                      <ActionIconButton
                        disabled={closed}
                        onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit' })}
                        title="Add income transaction"
                        tone="success"
                        icon={PlusIcon}
                      />
                      <ActionIconButton
                        disabled={closed}
                        onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'debit' })}
                        title="Add income correction"
                        tone="danger"
                        icon={MinusIcon}
                      />
                      <ActionIconButton
                        onClick={() => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit', readOnly: closed })}
                        title="View transactions"
                        icon={ListBulletIcon}
                      />
                      {!locked && !closed && i.system_key !== 'carry_forward' && (
                        <DeleteActionButton
                          onClick={() => { if (globalThis.confirm(`Remove "${i.incomedesc}" from this budget cycle?`)) deleteIncomeLine.mutate(i.incomedesc) }}
                          title="Remove from budget cycle"
                        />
                      )}
                      {(locked || closed || i.system_key === 'carry_forward') && (
                        <EmptyActionSlot />
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
                <td className="px-3 py-2 w-[152px]"></td>
              </tr>
            </tfoot>
          </table>
        </div>
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
                <th className="table-header-cell text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>Status / Txns</span>
                    <label htmlFor="expense-status-filter" className="sr-only">Status</label>
                    <select
                      id="expense-status-filter"
                      aria-label="Status"
                      className="input min-w-[5.5rem] py-1 text-xs font-normal normal-case tracking-normal"
                      value={expenseStatusFilter}
                      onChange={event => setExpenseStatusFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="Current">Current</option>
                      <option value="Revised">Revised</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredExpenses.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-400 italic text-sm">No expense line items match this status.</td></tr>}
              {filteredExpenses.map(e => {
                const remaining = Number(e.remaining_amount ?? 0)
                const isOver = dragOver === e.expensedesc
                const isPaid = e.status === 'Paid'
                const canDelete = !locked && !closed && Number(e.actualamount) === 0 && Number(e.budgetamount) === 0
                const canEditBudget = !locked && !closed && !isPaid
                const canReorder = expenseStatusFilter === 'all' && !locked && !closed && !isPaid
                return (
                  <tr
                    key={e.expensedesc}
                    draggable={canReorder}
                    onDragStart={() => handleDragStart(e.expensedesc)}
                    onDragOver={ev => handleDragOver(ev, e.expensedesc)}
                    onDragLeave={handleDragLeave}
                    onDrop={ev => handleDrop(ev, e.expensedesc)}
                    className={`table-row transition-colors ${isOver ? 'bg-dosh-50 dark:bg-dosh-900/20 border-t-2 border-dosh-400' : ''}`}
                  >
                    <td className={`w-6 px-2 ${canReorder ? 'text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing' : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'}`}>
                      <Bars2Icon className="w-4 h-4" />
                    </td>
                    <td className="table-cell font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{e.expensedesc}</span>
                      </div>
                    </td>
                    <td className="table-cell-muted text-right col-budget">
                      <BudgetAmountCell
                        amount={e.budgetamount}
                        canEdit={canEditBudget}
                        onEdit={() => setBudgetAdjustModal({ category: 'expense', desc: e.expensedesc, budgetamount: e.budgetamount, title: e.expensedesc })}
                        label={e.expensedesc}
                      />
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
                        {getExpenseScheduleBadge(e)}
                        {e.paytype && <span className={e.paytype === 'AUTO' ? 'badge-green' : 'badge-gray'}>{e.paytype}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                          <ExpenseStatusPill
                            expense={e}
                            onMarkPaid={() => handleMarkPaid(e)}
                            onRevise={() => setExpenseStatus.mutate({ desc: e.expensedesc, status: 'Revised' })}
                          />
                        <ActionIconButton
                          disabled={closed || isPaid}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit' })}
                          title="Add expense transaction"
                          tone="danger"
                          icon={PlusIcon}
                        />
                        <ActionIconButton
                          disabled={closed || isPaid}
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'credit' })}
                          title="Add refund/credit"
                          tone="dosh"
                          icon={MinusIcon}
                        />
                        <ActionIconButton
                          onClick={() => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit', readOnly: true })}
                          title="View transactions"
                          icon={ListBulletIcon}
                        />
                        {canDelete && !isPaid && (
                          <DeleteActionButton
                            onClick={() => { if (globalThis.confirm(`Remove "${e.expensedesc}" from this budget cycle?`)) deleteExpenseLine.mutate(e.expensedesc) }}
                            title="Remove from budget cycle (no actuals, zero budget)"
                          />
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
                        <BudgetAmountCell
                          amount={inv.budgeted_amount}
                          canEdit={!locked && !closed && inv.status !== 'Paid'}
                          onEdit={() => setBudgetAdjustModal({ category: 'investment', desc: inv.investmentdesc, budgetamount: inv.budgeted_amount, title: inv.investmentdesc })}
                          label={inv.investmentdesc}
                        />
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
                            onRevise={() => setInvestmentStatus.mutate({ desc: inv.investmentdesc, status: 'Revised' })}
                          />
                          <ActionIconButton
                            disabled={closed || inv.status === 'Paid'}
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase' })}
                            title="Add investment transaction"
                            tone="dosh"
                            icon={PlusIcon}
                          />
                          <ActionIconButton
                            disabled={closed || inv.status === 'Paid'}
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'decrease' })}
                            title="Add subtraction/withdrawal"
                            tone="danger"
                            icon={MinusIcon}
                          />
                          <ActionIconButton
                            onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase', readOnly: true })}
                            title="View transactions"
                            icon={ListBulletIcon}
                          />
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
            locked={!!(closed || incomeModal.readOnly)}
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
            locked={!!(closed || entriesModal.readOnly)}
            readOnly={!!entriesModal.readOnly}
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
              const mutation = getPeriodBudgetMutation(budgetAdjustModal.category, {
                editIncomeBudget,
                editExpenseBudget,
                editInvBudget,
              })
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
            locked={!!(investmentModal.readOnly || closed)}
            readOnly={!!investmentModal.readOnly}
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

BudgetAmountCell.propTypes = {
  amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  canEdit: PropTypes.bool.isRequired,
  onEdit: PropTypes.func,
  label: PropTypes.string.isRequired,
}

ActionIconButton.propTypes = {
  disabled: PropTypes.bool,
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  tone: PropTypes.oneOf(['neutral', 'success', 'danger', 'dosh']),
  icon: PropTypes.elementType.isRequired,
}

DeleteActionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
}

AmountSummaryGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    cls: PropTypes.string,
  })).isRequired,
  columns: PropTypes.oneOf([2, 3]),
}

TransactionListPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    entry_kind: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    note: PropTypes.string,
    entrydate: PropTypes.string.isRequired,
  })).isRequired,
  isLoading: PropTypes.bool.isRequired,
  locked: PropTypes.bool.isRequired,
  headerLabel: PropTypes.string.isRequired,
  emptyLabel: PropTypes.string.isRequired,
  maxHeightClass: PropTypes.string,
  totalValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totalClassName: PropTypes.string,
  getItemAmount: PropTypes.func.isRequired,
  getAmountClassName: PropTypes.func.isRequired,
  getBadgeClassName: PropTypes.func.isRequired,
  getBadgeLabel: PropTypes.func.isRequired,
  getPrimaryText: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
}

TransactionEntryForm.propTypes = {
  locked: PropTypes.bool.isRequired,
  amount: PropTypes.string.isRequired,
  setAmount: PropTypes.func.isRequired,
  note: PropTypes.string.isRequired,
  setNote: PropTypes.func.isRequired,
  error: PropTypes.string.isRequired,
  setError: PropTypes.func.isRequired,
  setResolvedAmount: PropTypes.func.isRequired,
  budgetAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  type: PropTypes.string.isRequired,
  setType: PropTypes.func.isRequired,
  typeOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    activeClassName: PropTypes.string.isRequired,
    submitClassName: PropTypes.string.isRequired,
  })).isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.func.isRequired,
  isPending: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

TransactionWorkflowModal.propTypes = {
  kind: PropTypes.oneOf(['income', 'expense', 'investment']).isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    entry_kind: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    note: PropTypes.string,
    entrydate: PropTypes.string.isRequired,
    budget_before_amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    budget_after_amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  })).isRequired,
  isLoading: PropTypes.bool.isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  amount: PropTypes.string.isRequired,
  setAmount: PropTypes.func.isRequired,
  note: PropTypes.string.isRequired,
  setNote: PropTypes.func.isRequired,
  error: PropTypes.string.isRequired,
  setError: PropTypes.func.isRequired,
  setResolvedAmount: PropTypes.func.isRequired,
  budgetAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  type: PropTypes.string.isRequired,
  setType: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isPending: PropTypes.bool.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  totalValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

ProgressStatusPill.propTypes = {
  item: PropTypes.shape({
    revision_comment: PropTypes.string,
  }).isRequired,
  budgetAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  remainingAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  status: PropTypes.string.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
}

ConfirmPaidModal.propTypes = {
  noun: PropTypes.string.isRequired,
  item: PropTypes.object.isRequired,
  remainingAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

IncomeTransactionsModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  incomedesc: PropTypes.string.isRequired,
  budgetamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['credit', 'debit']),
}

BalanceTransactionsModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  balancedesc: PropTypes.string.isRequired,
  movementAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
}

ExpenseEntriesModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  expensedesc: PropTypes.string.isRequired,
  budgetamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['debit', 'credit']),
}

InvestmentTxModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  investmentdesc: PropTypes.string.isRequired,
  openingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  closingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  budgetedAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['increase', 'decrease']),
}

BudgetAdjustmentModal.propTypes = {
  title: PropTypes.string.isRequired,
  currentAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

ExpenseStatusPill.propTypes = {
  expense: PropTypes.object.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
}

ConfirmPaidExpenseModal.propTypes = {
  expense: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

InvestmentStatusPill.propTypes = {
  investment: PropTypes.object.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
}

ConfirmPaidInvestmentModal.propTypes = {
  investment: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

CloseoutModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
}

AddIncomeModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  existingDescs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
}

AddExpenseModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  existingDescs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
}
