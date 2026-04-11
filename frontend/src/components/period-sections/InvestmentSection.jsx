import PropTypes from 'prop-types'
import { PlusIcon, MinusIcon, ListBulletIcon, Bars2Icon } from '@heroicons/react/24/outline'
import { InvestmentStatusPill } from '../status'
import { BudgetAmountCell, ActionIconButton } from '../../utils'

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

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-700 dark:text-gray-200 text-sm">Investments</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm period-detail-table">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="w-6 px-2"></th>
              <th className="table-header-cell text-left w-[28%]">Investment</th>
              <th className="table-header-cell text-right col-budget w-[14%]">Budget</th>
              <th className="table-header-cell text-right col-actual w-[14%]">Actual ∑</th>
              <th className="table-header-cell text-right w-[12%]">Remaining</th>
              <th className="table-header-cell text-left w-[18%]">Account</th>
              <th className="table-header-cell text-center w-[18%]">Status / Txns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {investments.map(inv => {
              const remaining = Number(inv.remaining_amount ?? 0)
              return (
                <tr key={inv.investmentdesc} className="table-row">
                  <td className="w-6 px-2 text-gray-200 dark:text-gray-700">
                    <Bars2Icon className="w-4 h-4 opacity-0" />
                  </td>
                  <td className="table-cell font-medium">{inv.investmentdesc}</td>
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
                    <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</span>
                  </td>
                  <td className="table-cell-muted text-sm">
                    {inv.linked_account_desc ? (
                      <span className="text-purple-600 dark:text-purple-400">{inv.linked_account_desc}</span>
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
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase' })}
                        title="Add investment transaction"
                        tone="dosh"
                        icon={PlusIcon}
                      />
                      <ActionIconButton
                        disabled={closed || inv.status === 'Paid'}
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'decrease' })}
                        title="Add subtraction/withdrawal"
                        tone="danger"
                        icon={MinusIcon}
                      />
                      <ActionIconButton
                        onClick={() => setInvestmentModal({ investmentdesc: inv.investmentdesc, openingValue: inv.opening_value, closingValue: inv.closing_value, budgetedAmount: inv.budgeted_amount, defaultType: 'increase', readOnly: true })}
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
              <td className="w-6 px-2"></td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Investments</td>
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
