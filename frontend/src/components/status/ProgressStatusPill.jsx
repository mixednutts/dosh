import PropTypes from 'prop-types'
import { getProgressToneClasses } from '../../utils/periodCalculations'

export function ProgressStatusPill({ item, budgetAmount, actualAmount, remainingAmount, status, onMarkPaid, onRevise, formatters, category = 'expense' }) {
  const budget = Number(budgetAmount ?? 0)
  const actual = Number(actualAmount ?? 0)
  const remaining = Number(remainingAmount ?? 0)
  const rawPercent = budget > 0 ? (actual / budget) * 100 : 0
  const clampedPercent = Math.max(0, Math.min(rawPercent, 100))
  const isOver = rawPercent > 100
  const isNearLimit = rawPercent >= 90 && rawPercent <= 100
  const revisionComment = item.revision_comment?.trim()
  const title = budget > 0
    ? `${formatters.fmtPercent(Math.round(rawPercent))} spent • ${formatters.fmt(actual)} of ${formatters.fmt(budget)} • Remaining ${formatters.fmt(remaining)}`
    : `No budget set • Actual ${formatters.fmt(actual)}`

  if (status === 'Paid') {
    const paidCls = isOver
      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
      : 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-300 dark:hover:bg-dosh-900/60'

    const displayValue = category === 'income'
      ? actual - budget
      : budget - actual

    let varianceText = null
    if (displayValue !== 0) {
      varianceText = displayValue > 0 ? `+${formatters.fmt(displayValue)}` : formatters.fmt(displayValue)
    }

    const isPositiveVariance = category === 'income' || displayValue >= 0
    const varianceCls = isPositiveVariance
      ? 'text-success-600 dark:text-success-400'
      : 'text-red-600 dark:text-red-400'

    return (
      <button
        type="button"
        onClick={onRevise}
        title={`${title} • Click to reopen as Revised`}
        className={`inline-flex min-w-[108px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${paidCls}`}
      >
        Paid
        {varianceText && (
          <span className={`ml-1 ${varianceCls}`}>{varianceText}</span>
        )}
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

ProgressStatusPill.propTypes = {
  item: PropTypes.object.isRequired,
  budgetAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  remainingAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  status: PropTypes.string,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
  category: PropTypes.oneOf(['expense', 'income', 'investment']),
}

export function ExpenseStatusPill({ expense, onMarkPaid, onRevise, formatters }) {
  return (
    <ProgressStatusPill
      item={expense}
      budgetAmount={expense.budgetamount}
      actualAmount={expense.actualamount}
      remainingAmount={expense.remaining_amount}
      status={expense.status}
      onMarkPaid={onMarkPaid}
      onRevise={onRevise}
      formatters={formatters}
      category="expense"
    />
  )
}

ExpenseStatusPill.propTypes = {
  expense: PropTypes.object.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}

export function InvestmentStatusPill({ investment, onMarkPaid, onRevise, formatters }) {
  return (
    <ProgressStatusPill
      item={investment}
      budgetAmount={investment.budgeted_amount}
      actualAmount={investment.actualamount}
      remainingAmount={investment.remaining_amount}
      status={investment.status}
      onMarkPaid={onMarkPaid}
      onRevise={onRevise}
      formatters={formatters}
      category="investment"
    />
  )
}

InvestmentStatusPill.propTypes = {
  investment: PropTypes.object.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}

export function IncomeStatusPill({ income, onMarkPaid, onRevise, formatters }) {
  return (
    <ProgressStatusPill
      item={income}
      budgetAmount={income.budgetamount}
      actualAmount={income.actualamount}
      remainingAmount={income.actualamount - income.budgetamount}
      status={income.status}
      onMarkPaid={onMarkPaid}
      onRevise={onRevise}
      formatters={formatters}
      category="income"
    />
  )
}

IncomeStatusPill.propTypes = {
  income: PropTypes.object.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}
