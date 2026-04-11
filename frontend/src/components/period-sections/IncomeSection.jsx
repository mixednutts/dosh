import PropTypes from 'prop-types'
import { PlusIcon, MinusIcon, ListBulletIcon, Bars2Icon } from '@heroicons/react/24/outline'
import { IncomeStatusPill } from '../status'
import { BudgetAmountCell, ActionIconButton, EmptyActionSlot, DeleteActionButton } from '../../utils'

export function IncomeSection({
  incomes,
  locked,
  closed,
  totalIncomeBudget,
  totalIncomeActual,
  formatters,
  onAddIncome,
  onEditBudget,
  onMarkPaid,
  onRevise,
  onAddTransaction,
  onAddCorrection,
  onViewTransactions,
  onDeleteLine,
  deleteIncomeLine,
  setIncomeStatus,
}) {
  const fmt = formatters.fmt

  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Income</span>
        {!locked && !closed && (
          <button className="btn-secondary text-xs" onClick={onAddIncome}>
            <PlusIcon className="w-3.5 h-3.5" /> Add New Income Line Item
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm period-detail-table">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="w-6 px-2"></th>
              <th className="table-header-cell text-left w-[28%]">Description</th>
              <th className="table-header-cell text-right col-budget w-[14%]">Budget</th>
              <th className="table-header-cell text-right col-actual w-[14%]">
                <span title="Sum of all transactions — read-only">Actual ∑</span>
              </th>
              <th className="table-header-cell text-right w-[12%]">Remaining</th>
              <th className="table-header-cell text-left w-[18%]">Account</th>
              <th className="table-header-cell text-center w-[18%]">Status / Txns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {incomes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-400 italic text-sm">No income entries</td>
              </tr>
            )}
            {incomes.map(i => {
              const remaining = Number(i.actualamount) - Number(i.budgetamount)
              return (
                <tr key={i.incomedesc} className="table-row">
                  <td className="w-6 px-2 text-gray-200 dark:text-gray-700">
                    <Bars2Icon className="w-4 h-4 opacity-0" />
                  </td>
                  <td className="table-cell font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{i.incomedesc}</span>
                      {i.system_key === 'carry_forward' && <span className="badge-blue">System</span>}
                    </div>
                  </td>
                  <td className="table-cell-muted text-right col-budget">
                    <BudgetAmountCell
                      amount={i.budgetamount}
                      canEdit={!locked && !closed && i.system_key !== 'carry_forward'}
                      formatters={formatters}
                      onEdit={() => onEditBudget(i)}
                      label={i.incomedesc}
                    />
                  </td>
                  <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">{fmt(i.actualamount)}</td>
                  <td className="table-cell text-right">
                    {i.status === 'Paid' ? (
                      <span className="font-medium text-success-600 dark:text-success-400">Paid</span>
                    ) : (
                      <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(remaining)}
                      </span>
                    )}
                  </td>
                  <td className="table-cell-muted text-sm">
                    {i.linked_account ? (
                      <span className="text-purple-600 dark:text-purple-400">{i.linked_account}</span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <IncomeStatusPill
                        income={i}
                        onMarkPaid={() => onMarkPaid(i)}
                        formatters={formatters}
                        onRevise={() => setIncomeStatus.mutate({ desc: i.incomedesc, status: 'Revised' })}
                      />
                      <ActionIconButton
                        disabled={closed || i.status === 'Paid'}
                        onClick={() => onAddTransaction(i)}
                        title="Add income transaction"
                        tone="success"
                        icon={PlusIcon}
                      />
                      <ActionIconButton
                        disabled={closed || i.status === 'Paid'}
                        onClick={() => onAddCorrection(i)}
                        title="Add income correction"
                        tone="danger"
                        icon={MinusIcon}
                      />
                      <ActionIconButton
                        onClick={() => onViewTransactions(i)}
                        title="View transactions"
                        icon={ListBulletIcon}
                      />
                      {!locked && !closed && i.system_key !== 'carry_forward' && i.status !== 'Paid' ? (
                        <DeleteActionButton
                          onClick={() => {
                            if (globalThis.confirm(`Remove "${i.incomedesc}" from this budget cycle?`))
                              deleteIncomeLine.mutate(i.incomedesc)
                          }}
                          title="Remove from budget cycle"
                        />
                      ) : (
                        <EmptyActionSlot />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800">
              <td className="w-6 px-2"></td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Income</td>
              <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(totalIncomeBudget)}</td>
              <td className="px-4 py-2 text-right text-success-700 dark:text-success-400 text-sm">{fmt(totalIncomeActual)}</td>
              <td className="px-4 py-2 text-right text-sm">
                <span className={totalIncomeActual >= totalIncomeBudget ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}>
                  {fmt(totalIncomeActual - totalIncomeBudget)}
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

IncomeSection.propTypes = {
  incomes: PropTypes.array.isRequired,
  locked: PropTypes.bool.isRequired,
  closed: PropTypes.bool.isRequired,
  totalIncomeBudget: PropTypes.number.isRequired,
  totalIncomeActual: PropTypes.number.isRequired,
  formatters: PropTypes.object.isRequired,
  onAddIncome: PropTypes.func.isRequired,
  onEditBudget: PropTypes.func.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  onAddTransaction: PropTypes.func.isRequired,
  onAddCorrection: PropTypes.func.isRequired,
  onViewTransactions: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  deleteIncomeLine: PropTypes.object.isRequired,
  setIncomeStatus: PropTypes.object.isRequired,
}
