import PropTypes from 'prop-types'
import { TrashIcon } from '@heroicons/react/24/outline'
import Spinner from '../Spinner'

function getTransactionListContent({ isLoading, items, emptyLabel, maxHeightClass, locked, onDelete, getItemAmount, getBadgeClassName, getBadgeLabel, getAmountClassName, getPrimaryText, formatters }) {
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
            <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getBadgeClassName(item, amount)}`}>
              {getBadgeLabel(item, amount)}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${getAmountClassName(item, amount)}`}>
                {getPrimaryText(item, amount)}
              </p>
              {item.note && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.note}</p>}
              <p className="text-xs text-gray-400">{formatters.fmtDateTime(item.entrydate, 'medium')}</p>
            </div>
            {!locked && item.entry_kind !== 'budget_adjustment' && item.entry_kind !== 'status_change' && (
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

export function TransactionListPanel({
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
  formatters,
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
        formatters,
      })}
      {items.length > 0 && totalValue != null && (
        <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800">
          <span className="text-gray-600 dark:text-gray-400">Total</span>
          <span className={totalClassName}>{formatters.fmt(totalValue)}</span>
        </div>
      )}
    </div>
  )
}

TransactionListPanel.propTypes = {
  items: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  locked: PropTypes.bool.isRequired,
  headerLabel: PropTypes.string.isRequired,
  emptyLabel: PropTypes.string.isRequired,
  maxHeightClass: PropTypes.string,
  totalValue: PropTypes.number,
  totalClassName: PropTypes.string,
  getItemAmount: PropTypes.func.isRequired,
  getAmountClassName: PropTypes.func.isRequired,
  getBadgeClassName: PropTypes.func.isRequired,
  getBadgeLabel: PropTypes.func.isRequired,
  getPrimaryText: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  formatters: PropTypes.object.isRequired,
}
