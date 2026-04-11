import PropTypes from 'prop-types'
import { ListBulletIcon } from '@heroicons/react/24/outline'

export function BalanceSection({
  balances,
  formatters,
  onViewTransactions,
}) {
  const fmt = formatters.fmt

  if (balances.length === 0) return null

  const totalBalanceOpening = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0), 0)
  const totalBalanceClosing = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0) + Number(b.movement_amount ?? 0), 0)

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm">Account Balances</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm period-detail-table">
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
                        onClick={() => onViewTransactions(b)}
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
  )
}

BalanceSection.propTypes = {
  balances: PropTypes.array.isRequired,
  formatters: PropTypes.object.isRequired,
  onViewTransactions: PropTypes.func.isRequired,
}
