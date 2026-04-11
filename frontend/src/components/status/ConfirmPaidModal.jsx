import PropTypes from 'prop-types'

export function ConfirmPaidModal({ noun, item, remainingAmount, onConfirm, onClose, formatters }) {
  const remaining = Number(remainingAmount ?? 0)
  const isOver = remaining < 0
  const delta = formatters.fmt(Math.abs(remaining))

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

ConfirmPaidModal.propTypes = {
  noun: PropTypes.string.isRequired,
  item: PropTypes.object.isRequired,
  remainingAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}

export function ConfirmPaidExpenseModal({ expense, onConfirm, onClose, formatters }) {
  return (
    <ConfirmPaidModal
      noun="expense"
      item={expense}
      remainingAmount={expense.remaining_amount}
      onConfirm={onConfirm}
      onClose={onClose}
      formatters={formatters}
    />
  )
}

ConfirmPaidExpenseModal.propTypes = {
  expense: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}

export function ConfirmPaidInvestmentModal({ investment, onConfirm, onClose, formatters }) {
  return (
    <ConfirmPaidModal
      noun="investment"
      item={investment}
      remainingAmount={investment.remaining_amount}
      onConfirm={onConfirm}
      onClose={onClose}
      formatters={formatters}
    />
  )
}

ConfirmPaidInvestmentModal.propTypes = {
  investment: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}

export function ConfirmPaidIncomeModal({ income, onConfirm, onClose, formatters }) {
  const remaining = Number(income.actualamount ?? 0) - Number(income.budgetamount ?? 0)
  return (
    <ConfirmPaidModal
      noun="income"
      item={income}
      remainingAmount={remaining}
      onConfirm={onConfirm}
      onClose={onClose}
      formatters={formatters}
    />
  )
}

ConfirmPaidIncomeModal.propTypes = {
  income: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}
