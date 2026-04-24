import PropTypes from 'prop-types'
import { ListBulletIcon } from '@heroicons/react/24/outline'
import MobileTableCards from '../MobileTableCards'

export function BalanceSection({
  balances,
  formatters,
  onViewTransactions,
  limitExceeded = false,
}) {
  const fmt = formatters.fmt

  if (limitExceeded) {
    return (
      <div className="card">
        <div className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
          The Upcoming budget cycles exceeds allowed limits for forward calculation.
          <br />
          <span className="text-xs text-gray-500">
            Adjust the limit in Budget Settings if needed.
          </span>
        </div>
      </div>
    )
  }

  if (balances.length === 0) return null

  const totalBalanceOpening = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0), 0)
  const totalBalanceClosing = balances.reduce((s, b) => s + Number(b.opening_amount ?? 0) + Number(b.movement_amount ?? 0), 0)

  const mobileColumns = [
    {
      key: 'balancedesc',
      label: 'Account',
      render: v => <span className="font-medium">{v}</span>,
    },
    {
      key: 'opening_amount',
      label: 'Opening',
      render: v => <span className="text-gray-600 dark:text-gray-400">{fmt(v)}</span>,
    },
    {
      key: 'movement_amount',
      label: 'Movement',
      render: v => (
        <span className={`font-medium ${Number(v ?? 0) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
          {fmt(v ?? 0)}
        </span>
      ),
    },
    {
      key: 'closing',
      label: 'Closing',
      render: (_v, row) => {
        const closing = Number(row.opening_amount) + Number(row.movement_amount ?? 0)
        return (
          <span className={`font-medium ${closing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
            {fmt(closing)}
          </span>
        )
      },
    },
    {
      key: 'balance_type',
      label: 'Account Type',
      render: v => v || <span className="text-gray-400">—</span>,
    },
  ]

  const mobileActions = row => (
    <button
      onClick={() => onViewTransactions(row)}
      title="View supporting transactions"
      className="flex items-center justify-center min-w-11 min-h-11 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <ListBulletIcon className="w-4 h-4" />
    </button>
  )

  const mobileFooter = (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Balances</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{fmt(totalBalanceOpening)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Closing</span>
        <span className={`text-sm font-medium ${totalBalanceClosing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalBalanceClosing)}</span>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm md:text-sm text-base border-l-4 border-blue-500 pl-2.5 md:border-0 md:pl-4">Account Balances</div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm period-detail-table">
          <colgroup>
            <col className="w-10" />
            <col className="w-[26%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[25%]" />
            <col className="w-[21%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="table-header-cell text-left" colSpan={2}>Account</th>
              <th className="table-header-cell text-right col-budget">Opening</th>
              <th className="table-header-cell text-right col-actual">
                <span title="Calculated from account-linked transactions and transfers">Movement</span>
              </th>
              <th className="table-header-cell text-right">Closing</th>
              <th className="table-header-cell text-center">Account Type</th>
              <th className="table-header-cell text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {balances.map(b => {
              const closing = Number(b.opening_amount) + Number(b.movement_amount ?? 0)
              return (
                <tr key={b.balancedesc} className="table-row">
                  <td className="table-cell font-medium" colSpan={2}>{b.balancedesc}</td>
                  <td className="table-cell-muted text-right col-budget">{fmt(b.opening_amount)}</td>
                  <td className="table-cell text-right col-actual">
                    <span className={`font-medium ${Number(b.movement_amount ?? 0) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmt(b.movement_amount ?? 0)}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <span className={`font-medium ${closing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(closing)}</span>
                  </td>
                  <td className="table-cell-muted">{b.balance_type || '—'}</td>
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
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm" colSpan={2}>Total Balances</td>
              <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm col-budget">{fmt(totalBalanceOpening)}</td>
              <td className="px-4 py-2 text-center text-xs text-gray-400 dark:text-gray-500" title="Movement is shown per account only and is not totaled across accounts">—</td>
              <td className="px-4 py-2 text-right text-sm">
                <span className={`font-medium ${totalBalanceClosing >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalBalanceClosing)}</span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <MobileTableCards
        columns={mobileColumns}
        rows={balances}
        keyExtractor={row => row.balancedesc}
        actions={mobileActions}
        footer={mobileFooter}
      />
    </div>
  )
}

BalanceSection.propTypes = {
  balances: PropTypes.array.isRequired,
  formatters: PropTypes.object.isRequired,
  onViewTransactions: PropTypes.func.isRequired,
  limitExceeded: PropTypes.bool,
}
