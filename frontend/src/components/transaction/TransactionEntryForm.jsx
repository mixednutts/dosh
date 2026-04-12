import PropTypes from 'prop-types'
import AmountExpressionInput from '../AmountExpressionInput'
import { useFormatters } from '../useFormatters'
import { getTransactionModalConfig } from '../../utils/transactionHelpers'

export function TransactionEntryForm({
  kind,
  locked,
  amount,
  setAmount,
  note,
  setNote,
  entrydate,
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
  accounts = null,
  selectedAccount = '',
  setSelectedAccount = () => {},
}) {
  const formatters = useFormatters()
  if (locked) {
    return (
      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    )
  }

  const selectedOption = typeOptions.find(option => option.value === type) ?? typeOptions[0]
  const noteInputId = `transaction-note-${selectedOption.value}`
  const numericBudgetAmount = Number(budgetAmount ?? 0)
  const numericActualAmount = Number(actualAmount ?? 0)
  const remainingAmount = numericBudgetAmount - numericActualAmount
  const config = getTransactionModalConfig(kind)
  const quickFillPolicy = config.quickFillPolicy ?? {}
  const isPositiveQuickFillContext = type === quickFillPolicy.remainingType && remainingAmount > 0
  const isUntouchedBudget = numericBudgetAmount > 0 && numericActualAmount === 0 && remainingAmount === numericBudgetAmount
  const usesExplicitFullQuickFill = typeof quickFillPolicy.shouldShowFull === 'function'
    ? quickFillPolicy.shouldShowFull({
        type,
        actualAmount: numericActualAmount,
        budgetAmount: numericBudgetAmount,
        remainingAmount,
        zeroFullType: quickFillPolicy.zeroFullType,
        overFullType: quickFillPolicy.overFullType,
      })
    : false
  const showQuickFill = numericBudgetAmount > 0 && (
    isPositiveQuickFillContext ||
    usesExplicitFullQuickFill ||
    (type === quickFillPolicy.zeroFullType && remainingAmount === 0) ||
    (type === quickFillPolicy.overFullType && remainingAmount < 0)
  )
  const usesRemainingQuickFill = isPositiveQuickFillContext && !isUntouchedBudget
  const quickFillValue = usesRemainingQuickFill
    ? remainingAmount
    : (typeof quickFillPolicy.fullValue === 'function'
        ? quickFillPolicy.fullValue({ type, actualAmount: numericActualAmount, budgetAmount: numericBudgetAmount, remainingAmount })
        : numericBudgetAmount)
  const quickFillType = usesRemainingQuickFill ? 'Remaining' : 'Full'

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
      {kind === 'expense' && accounts && accounts.length > 0 && (
        <div>
          <label htmlFor="transaction-account-expense" className="label">Account</label>
          <select
            id="transaction-account-expense"
            required
            disabled={locked}
            className="input"
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
          >
            {accounts.map(acc => (
              <option key={acc.balancedesc} value={acc.balancedesc}>{acc.balancedesc}</option>
            ))}
          </select>
        </div>
      )}
      {/* Grid layout: Amount | [Quick Fill] | Note/Date */}
      <div className={`grid gap-2 ${showQuickFill ? 'grid-cols-[0.5fr_0.5fr_1fr]' : 'grid-cols-[0.7fr_1.3fr]'}`}>
        {/* Column 1: Amount - spans full height (Note + Date stacked) */}
        <AmountExpressionInput
          autoFocus
          value={amount}
          onChange={nextValue => {
            setAmount(nextValue)
            setError('')
          }}
          onResolvedChange={(value, state) => setResolvedAmount({ value, state })}
          min={0.01}
          placeholder="Amount"
          className="input h-full min-h-[5.25rem]"
          required
        />
        {/* Column 2: Quick Fill button - stacked 3 lines, distinct button styling */}
        {showQuickFill && (
          <button
            type="button"
            onClick={() => {
              setAmount(String(quickFillValue))
              setError('')
            }}
            className="bg-dosh-600 hover:bg-dosh-700 text-white text-xs text-center leading-tight px-2 py-2 whitespace-nowrap rounded-md border border-dosh-500 shadow-sm w-full flex flex-col justify-center items-center"
            title={usesRemainingQuickFill ? 'Add Remaining Amount' : 'Add Full Amount'}
          >
            <span>Add</span>
            <span>{quickFillType}</span>
            <span className="font-semibold">{formatters.fmt(quickFillValue)}</span>
          </button>
        )}
        {/* Last Column: Note (top) and Date (bottom) */}
        <div className="flex flex-col gap-2">
          <label htmlFor={noteInputId} className="sr-only">Transaction note</label>
          <input
            id={noteInputId}
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="input h-12"
          />
          <div
            id={`transaction-date-${kind}`}
            className="input h-12 text-sm flex items-center px-3 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          >
            {entrydate}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        <button type="submit" disabled={isPending} className="btn-neutral">
          {isPending ? 'Saving…' : submitLabel(type)}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  )
}

TransactionEntryForm.propTypes = {
  kind: PropTypes.oneOf(['income', 'expense', 'investment']).isRequired,
  locked: PropTypes.bool.isRequired,
  amount: PropTypes.string.isRequired,
  setAmount: PropTypes.func.isRequired,
  note: PropTypes.string.isRequired,
  setNote: PropTypes.func.isRequired,
  entrydate: PropTypes.string.isRequired,
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
  })).isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.func.isRequired,
  isPending: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  actualAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.shape({
    balancedesc: PropTypes.string.isRequired,
  })),
  selectedAccount: PropTypes.string,
  setSelectedAccount: PropTypes.func,
}
