export const SECONDARY_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
export const DELETE_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
export const DISABLED_ICON_BUTTON_CLASSES = 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400'

export const ICON_BUTTON_TONES = {
  success: 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/40 dark:text-success-400 dark:hover:bg-success-900/60',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60',
  dosh: 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60',
}

export function iconButtonClassName(disabled, tone) {
  const toneClasses = ICON_BUTTON_TONES[tone] ?? SECONDARY_BUTTON_CLASSES
  return `flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${
    disabled ? DISABLED_ICON_BUTTON_CLASSES : toneClasses
  }`
}

export function getResolvedAmountValue(amountState, min = 0) {
  if (amountState.state !== 'valid' || amountState.value == null || amountState.value < min) {
    return null
  }
  return amountState.value
}

export function balanceTransactionDelta(tx, balancedesc) {
  if (tx.source === 'transfer') {
    if (tx.affected_account_desc === balancedesc) return Number(tx.amount ?? 0)
    if (tx.related_account_desc === balancedesc) return -Number(tx.amount ?? 0)
    return 0
  }
  if (tx.affected_account_desc !== balancedesc) return 0
  if (tx.source === 'expense') return -Number(tx.amount ?? 0)
  return Number(tx.amount ?? 0)
}

export function balanceTransactionLabel(tx, balancedesc) {
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

export function buildTransactionDisplayResolver(config, formatters) {
  return (item, itemAmount) => {
    if (item.entry_kind === 'budget_adjustment') {
      return {
        amountClassName: 'text-dosh-700 dark:text-dosh-300',
        badgeClassName: 'bg-dosh-100 text-dosh-700 dark:bg-dosh-900/40 dark:text-dosh-300',
        badgeLabel: 'Adj',
        primaryText: `Budget ${formatters.fmt(item.budget_before_amount)} -> ${formatters.fmt(item.budget_after_amount)}`,
      }
    }

    if (item.entry_kind === 'status_change') {
      return {
        amountClassName: 'text-gray-600 dark:text-gray-400',
        badgeClassName: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        badgeLabel: 'Status',
        primaryText: item.note || `Status changed to ${item.line_status || 'Paid'}`,
      }
    }

    const isPositive = itemAmount >= 0
    const tone = isPositive ? config.positiveTone : config.negativeTone
    return {
      amountClassName: config.amountClassNames[tone],
      badgeClassName: config.badgeClassNames[tone],
      badgeLabel: isPositive ? '+' : '−',
      primaryText: formatters.fmt(Math.abs(item.amount)),
    }
  }
}

export function getTransactionModalConfig(kind) {
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

  const buildDirectionalQuickFillPolicy = ({ positiveType, reverseType }) => ({
    remainingType: positiveType,
    shouldShowFull: ({ type, actualAmount }) => type === reverseType && Number(actualAmount ?? 0) > 0,
    fullValue: ({ type, actualAmount, budgetAmount, remainingAmount }) => (
      type === reverseType
        ? Number(actualAmount ?? 0)
        : (remainingAmount < 0 ? Number(actualAmount ?? 0) : Number(budgetAmount ?? 0))
    ),
  })

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
        { value: 'credit', label: 'Income (+)', activeClassName: 'bg-success-600' },
        { value: 'debit', label: 'Correction (−)', activeClassName: 'bg-red-600' },
      ],
      quickFillPolicy: buildDirectionalQuickFillPolicy({ positiveType: 'credit', reverseType: 'debit' }),
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
        { value: 'debit', label: 'Expense (+)', activeClassName: 'bg-red-600' },
        { value: 'credit', label: 'Refund (−)', activeClassName: 'bg-dosh-600' },
      ],
      quickFillPolicy: buildDirectionalQuickFillPolicy({ positiveType: 'debit', reverseType: 'credit' }),
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
        { value: 'increase', label: 'Add (+)', activeClassName: 'bg-dosh-600' },
        { value: 'decrease', label: 'Subtract (−)', activeClassName: 'bg-red-600' },
      ],
      quickFillPolicy: buildDirectionalQuickFillPolicy({ positiveType: 'increase', reverseType: 'decrease' }),
      submitLabel: currentType => (currentType === 'increase' ? 'Add' : 'Subtract'),
      toMutationAmount: (entryType, value) => (entryType === 'increase' ? value : -value),
    },
  }

  return configs[kind]
}

export function buildTransactionSubmitHandler({ resolvedAmount, setError, mutate, type, note, toMutationAmount }) {
  return event => {
    event.preventDefault()
    const amountValue = getResolvedAmountValue(resolvedAmount, 0.01)
    if (amountValue == null) {
      setError('Enter a valid amount')
      return
    }
    setError('')
    mutate({ amount: toMutationAmount(type, amountValue), note: note || null, entrydate: new Date().toISOString() })
  }
}
