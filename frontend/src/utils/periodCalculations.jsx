import { parseISO, addDays } from 'date-fns'
import { getNextFixedDayOccurrence } from './fixedDayScheduling'

export function calcNextDue(freqtype, frequencyValue, effectivedate, todayDate = new Date()) {
  const today = new Date(todayDate)
  today.setHours(0, 0, 0, 0)

  if (freqtype === 'Always') return null

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

export function freqLabel(freqtype, frequencyValue) {
  if (!freqtype) return null
  if (freqtype === 'Always') return 'Always included'
  if (freqtype === 'Fixed Day of Month') return `Recurring: Day ${frequencyValue}`
  if (freqtype === 'Every N Days') return `Recurring: Every ${frequencyValue}d`
  return freqtype
}

export function isScheduledExpense(expense) {
  return expense.freqtype && expense.freqtype !== 'Always' && expense.frequency_value && expense.effectivedate
}

export function hasLineActualActivity(actualAmount) {
  return Number(actualAmount ?? 0) > 0
}

export function getPositiveRemainingValue(remainingAmount) {
  return Math.max(Number(remainingAmount ?? 0), 0)
}

export function getIncomeSurplusContribution({
  budgetAmount,
  actualAmount,
}) {
  if (hasLineActualActivity(actualAmount)) {
    return Number(actualAmount ?? 0)
  }
  return Number(budgetAmount ?? 0)
}

export function getOutflowSurplusContribution({
  actualAmount,
  remainingAmount,
}) {
  return Number(actualAmount ?? 0) + getPositiveRemainingValue(remainingAmount)
}

export function getProgressToneClasses({ isOver, isNearLimit, status }) {
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

export function getPeriodBudgetMutation(category, mutations) {
  if (category === 'income') return mutations.editIncomeBudget
  if (category === 'expense') return mutations.editExpenseBudget
  return mutations.editInvBudget
}

export function getExpenseScheduleBadge(expense) {
  if (expense.is_oneoff) {
    return <span className="badge-amber">One-off</span>
  }

  const label = freqLabel(expense.freqtype, expense.frequency_value)
  if (!label) {
    return <span className="badge-gray">—</span>
  }

  const nextDue = calcNextDue(expense.freqtype, expense.frequency_value, expense.effectivedate)
  return (
    <span className="badge-blue" title={nextDue ? `Next: ${nextDue.toLocaleDateString()}` : undefined}>
      {label}
    </span>
  )
}
