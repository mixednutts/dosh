import { useQuery } from '@tanstack/react-query'
import PropTypes from 'prop-types'
import { getBalanceTransactions } from '../../api/client'
import Spinner from '../../components/Spinner'
import { useFormatters } from '../../components/useFormatters'
import { balanceTransactionDelta, balanceTransactionLabel } from '../../utils'

export function BalanceTransactionsModal({ periodId, balancedesc, movementAmount }) {
  const formatters = useFormatters()
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
            <p className={`font-semibold ${cls}`}>{formatters.fmt(value)}</p>
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
                    <p className="text-xs text-gray-400">{formatters.fmtDateTime(tx.entrydate, 'medium')}</p>
                  </div>
                  <div className={`text-sm font-semibold ${isPositive ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-700 dark:text-red-400'}`}>
                    {formatters.fmt(delta)}
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

BalanceTransactionsModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  balancedesc: PropTypes.string.isRequired,
  movementAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}
