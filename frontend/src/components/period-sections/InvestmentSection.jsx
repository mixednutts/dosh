import PropTypes from 'prop-types'
import { PlusIcon, MinusIcon, ListBulletIcon } from '@heroicons/react/24/outline'
import { InvestmentStatusPill } from '../status'
import { BudgetAmountCell, ActionIconButton } from '../../utils'
import MobileTableCards from '../MobileTableCards'

export function InvestmentSection({
  investments,
  locked,
  closed,
  effectiveInvestmentBudget,
  totalInvestmentActual,
  totalInvestmentRemaining,
  formatters,
  onEditBudget,
  onMarkPaid,
  onRevise,
  onAddTransaction,
  onAddWithdrawal,
  onViewTransactions,
  setInvestmentStatus,
  setInvestmentModal,
}) {
  const fmt = formatters.fmt

  if (investments.length === 0) return null

  const mobileColumns = [
    {
      key: 'investmentdesc',
      label: 'Investment',
      render: v => <span className="font-medium">{v}</span>,
    },
    {
      key: 'budgeted_amount',
      label: 'Budget',
      render: (_v, row) => (
        <BudgetAmountCell
          amount={row.budgeted_amount}
          canEdit={!locked && !closed && row.status !== 'Paid'}
          onEdit={() => onEditBudget(row)}
          label={row.investmentdesc}
          formatters={formatters}
        />
      ),
    },
    { key: 'actualamount', label: 'Actual', render: v => <span className="font-semibold">{fmt(v)}</span> },
    {
      key: 'remaining_amount',
      label: 'Remaining',
      render: (_v, row) => {
        const remaining = Number(row.remaining_amount ?? 0)
        return row.status === 'Paid'
          ? <span className="font-medium text-success-600 dark:text-success-400">Paid</span>
          : <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</span>
      },
    },
    {
      key: 'account',
      label: 'Account',
      render: (_v, row) => {
        if (row.source_account_desc || row.linked_account_desc) {
          return (
            <span className="text-purple-600 dark:text-purple-400">
              {row.source_account_desc ? `${row.source_account_desc} →` : ''} {row.linked_account_desc || ''}
            </span>
          )
        }
        return <span className="text-gray-300 dark:text-gray-600">—</span>
      },
    },
  ]

  const mobileActions = row => (
    <>
      <ActionIconButton
        disabled={closed || row.status === 'Paid'}
        onClick={() => setInvestmentModal({ investmentdesc: row.investmentdesc, openingValue: row.opening_value, closingValue: row.closing_value, budgetedAmount: row.budgeted_amount, sourceAccountDesc: row.source_account_desc, linkedAccountDesc: row.linked_account_desc, defaultType: 'increase' })}
        title="Add investment transaction"
        tone="dosh"
        icon={PlusIcon}
      />
      <ActionIconButton
        disabled={closed || row.status === 'Paid'}
        onClick={() => setInvestmentModal({ investmentdesc: row.investmentdesc, openingValue: row.opening_value, closingValue: row.closing_value, budgetedAmount: row.budgeted_amount, sourceAccountDesc: row.source_account_desc, linkedAccountDesc: row.linked_account_desc, defaultType: 'decrease' })}
        title="Add subtraction/withdrawal"
        tone="danger"
        icon={MinusIcon}
      />
      <ActionIconButton
        onClick={() => setInvestmentModal({ investmentdesc: row.investmentdesc, openingValue: row.opening_value, closingValue: row.closing_value, budgetedAmount: row.budgeted_amount, sourceAccountDesc: row.source_account_desc, linkedAccountDesc: row.linked_account_desc, defaultType: 'increase', readOnly: true })}
        title="View transactions"
        icon={ListBulletIcon}
      />
    </>
  )

  const mobileStatus = row => (
    <InvestmentStatusPill
      investment={row}
      onMarkPaid={() => onMarkPaid(row)}
      onRevise={() => setInvestmentStatus.mutate({ desc: row.investmentdesc, status: 'Revised' })}
      formatters={formatters}
    />
  )

  const mobileFooter = (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Investments</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{fmt(effectiveInvestmentBudget)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Actual</span>
        <span className="text-sm text-gray-800 dark:text-gray-200">{fmt(totalInvestmentActual)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Remaining</span>
        <span className={`text-sm font-medium ${totalInvestmentRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalInvestmentRemaining)}</span>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm md:text-sm text-base border-l-4 border-purple-500 pl-2.5 md:border-0 md:pl-4">Investments</div>
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
              <th className="table-header-cell text-left" colSpan={2}>Investment</th>
              <th className="table-header-cell text-right col-budget">Budget</th>
              <th className="table-header-cell text-right col-actual">Actual ∑</th>
              <th className="table-header-cell text-right">Remaining</th>
              <th className="table-header-cell text-center">Account</th>
              <th className="table-header-cell text-center">Status / Txns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {investments.map(inv => {
              const remaining = Number(inv.remaining_amount ?? 0)
              return (
                <tr key={inv.investmentdesc} className="table-row">
                  <td className="table-cell font-medium text-left" colSpan={2}>{inv.investmentdesc}</td>
                  <td className="table-cell-muted text-right col-budget">
                    <BudgetAmountCell
                      amount={inv.budgeted_amount}
                      canEdit={!locked && !closed && inv.status !== 'Paid'}
                      onEdit={() => onEditBudget(inv)}
                      label={inv.investmentdesc}
                      formatters={formatters}
                    />
                  </td>
                  <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(inv.actualamount)}</td>
                  <td className="table-cell text-right">
                    {inv.status === 'Paid' ? (
                      <span className="font-medium text-success-600 dark:text-success-400">Paid</span>
                    ) : (
                      <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(remaining)}
                      </span>
                    )}
                  </td>
                  <td className="table-cell-muted text-sm">
                    {inv.source_account_desc || inv.linked_account_desc ? (
                      <span className="text-purple-600 dark:text-purple-400 whitespace-normal break-words">
                        {inv.source_account_desc ? `${inv.source_account_desc} →` : ''} {inv.linked_account_desc || ''}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <InvestmentStatusPill
                        investment={inv}
                        onMarkPaid={() => onMarkPaid(inv)}
                        onRevise={() => setInvestmentStatus.mutate({ desc: inv.investmentdesc, status: 'Revised' })}
                        formatters={formatters}
                      />
                      <ActionIconButton
                        disabled={closed || inv.status === 'Paid'}
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, sourceAccountDesc: inv.source_account_desc, linkedAccountDesc: inv.linked_account_desc, defaultType: 'increase' })}
                        title="Add investment transaction"
                        tone="dosh"
                        icon={PlusIcon}
                      />
                      <ActionIconButton
                        disabled={closed || inv.status === 'Paid'}
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, sourceAccountDesc: inv.source_account_desc, linkedAccountDesc: inv.linked_account_desc, defaultType: 'decrease' })}
                        title="Add subtraction/withdrawal"
                        tone="danger"
                        icon={MinusIcon}
                      />
                      <ActionIconButton
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, sourceAccountDesc: inv.source_account_desc, linkedAccountDesc: inv.linked_account_desc, defaultType: 'increase', readOnly: true })}
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
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm" colSpan={2}>Total Investments</td>
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
      <MobileTableCards
        columns={mobileColumns}
        rows={investments}
        keyExtractor={row => row.investmentdesc}
        actions={mobileActions}
        status={mobileStatus}
        footer={mobileFooter}
      />
    </div>
  )
}

InvestmentSection.propTypes = {
  investments: PropTypes.array.isRequired,
  locked: PropTypes.bool.isRequired,
  closed: PropTypes.bool.isRequired,
  effectiveInvestmentBudget: PropTypes.number.isRequired,
  totalInvestmentActual: PropTypes.number.isRequired,
  totalInvestmentRemaining: PropTypes.number.isRequired,
  formatters: PropTypes.object.isRequired,
  onEditBudget: PropTypes.func.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  onAddTransaction: PropTypes.func.isRequired,
  onAddWithdrawal: PropTypes.func.isRequired,
  onViewTransactions: PropTypes.func.isRequired,
  setInvestmentStatus: PropTypes.object.isRequired,
  setInvestmentModal: PropTypes.func.isRequired,
}
