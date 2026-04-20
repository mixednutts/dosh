import PropTypes from 'prop-types'
import { PlusIcon, MinusIcon, ListBulletIcon, Bars2Icon } from '@heroicons/react/24/outline'
import { ExpenseStatusPill } from '../status'
import { BudgetAmountCell, ActionIconButton, EmptyActionSlot, DeleteActionButton, getExpenseScheduleBadge, isScheduledExpense } from '../../utils'

export function ExpenseSection({
  expenses,
  filteredExpenses,
  locked,
  closed,
  autoExpenseEnabled,
  expenseStatusFilter,
  dragOver,
  effectiveExpenseBudget,
  totalExpenseActual,
  totalExpenseRemaining,
  formatters,
  onAddExpense,
  onEditBudget,
  onMarkPaid,
  onRevise,
  onAddTransaction,
  onAddRefund,
  onViewTransactions,
  onDeleteLine,
  deleteExpenseLine,
  setExpenseStatus,
  updateExpensePayType,
  onStatusFilterChange,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const fmt = formatters.fmt

  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Expenses</span>
        {!locked && !closed && (
          <button className="btn-secondary text-xs" onClick={onAddExpense}>
            <PlusIcon className="w-3.5 h-3.5" /> Add New Expense Line Item
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
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
              <th className="table-header-cell text-left" colSpan={2}>Description</th>
              <th className="table-header-cell text-right col-budget">Budget</th>
              <th className="table-header-cell text-right col-actual">
                <span title="Sum of all transactions — read-only">Actual ∑</span>
              </th>
              <th className="table-header-cell text-right">Remaining</th>
              <th className="table-header-cell text-center">Schedule</th>
              <th className="table-header-cell text-center">
                <div className="flex items-center justify-center gap-2">
                  <span>Status / Txns</span>
                  <label htmlFor="expense-status-filter" className="sr-only">Status</label>
                  <select
                    id="expense-status-filter"
                    aria-label="Status"
                    className="input min-w-[5.5rem] py-1 text-xs font-normal normal-case tracking-normal"
                    value={expenseStatusFilter}
                    onChange={event => onStatusFilterChange(event.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="Current">Current</option>
                    <option value="Revised">Revised</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-400 italic text-sm">No expense line items match this status.</td>
              </tr>
            )}
            {filteredExpenses.map(e => {
              const remaining = Number(e.remaining_amount ?? 0)
              const isOver = dragOver === e.expensedesc
              const isPaid = e.status === 'Paid'
              const canDelete = !locked && !closed && Number(e.actualamount) === 0 && Number(e.budgetamount) === 0
              const canEditBudget = !locked && !closed && !isPaid
              const canReorder = expenseStatusFilter === 'all' && !locked && !closed
              const canToggleAutoPaytype = autoExpenseEnabled && isScheduledExpense(e) && !locked && !closed && !isPaid

              return (
                <tr
                  key={e.expensedesc}
                  draggable={canReorder}
                  onDragStart={() => onDragStart(e.expensedesc)}
                  onDragOver={ev => onDragOver(ev, e.expensedesc)}
                  onDragLeave={onDragLeave}
                  onDrop={ev => onDrop(ev, e.expensedesc)}
                  className={`table-row transition-colors ${isOver ? 'bg-dosh-50 dark:bg-dosh-900/20 border-t-2 border-dosh-400' : ''}`}
                >
                  <td className={`w-6 px-2 ${canReorder ? 'text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing' : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'}`}>
                    <Bars2Icon className="w-4 h-4" />
                  </td>
                  <td className="table-cell font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{e.expensedesc}</span>
                    </div>
                  </td>
                  <td className="table-cell-muted text-right col-budget">
                    <BudgetAmountCell
                      amount={e.budgetamount}
                      canEdit={canEditBudget}
                      formatters={formatters}
                      onEdit={() => onEditBudget(e)}
                      label={e.expensedesc}
                    />
                  </td>
                  <td className="table-cell text-right col-actual font-semibold text-gray-800 dark:text-gray-200">
                    {fmt(e.actualamount)}
                  </td>
                  <td className="table-cell text-right">
                    {e.status === 'Paid' ? (
                      <span className="font-medium text-success-600 dark:text-success-400">Paid</span>
                    ) : (
                      <span className={`font-medium ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(remaining)}
                      </span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {getExpenseScheduleBadge(e)}
                      {autoExpenseEnabled && e.paytype && (
                        canToggleAutoPaytype ? (
                          <button
                            type="button"
                            className={e.paytype === 'AUTO' ? 'badge-green' : 'badge-gray'}
                            onClick={() => updateExpensePayType.mutate({ desc: e.expensedesc, paytype: e.paytype === 'AUTO' ? 'MANUAL' : 'AUTO' })}
                          >
                            {e.paytype}
                          </button>
                        ) : (
                          <span className={e.paytype === 'AUTO' ? 'badge-green' : 'badge-gray'}>{e.paytype}</span>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <ExpenseStatusPill
                        expense={e}
                        onMarkPaid={() => onMarkPaid(e)}
                        onRevise={() => setExpenseStatus.mutate({ desc: e.expensedesc, status: 'Revised' })}
                        formatters={formatters}
                      />
                      <ActionIconButton
                        disabled={closed || isPaid}
                        onClick={() => onAddTransaction(e)}
                        title="Add expense transaction"
                        tone="danger"
                        icon={PlusIcon}
                      />
                      <ActionIconButton
                        disabled={closed || isPaid}
                        onClick={() => onAddRefund(e)}
                        title="Add refund/credit"
                        tone="dosh"
                        icon={MinusIcon}
                      />
                      <ActionIconButton
                        onClick={() => onViewTransactions(e)}
                        title="View transactions"
                        icon={ListBulletIcon}
                      />
                      {canDelete && !isPaid ? (
                        <DeleteActionButton
                          onClick={() => {
                            if (globalThis.confirm(`Remove "${e.expensedesc}" from this budget cycle?`))
                              deleteExpenseLine.mutate(e.expensedesc)
                          }}
                          title="Remove from budget cycle (no actuals, zero budget)"
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
              <td />
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm">Total Expenses</td>
              <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmt(effectiveExpenseBudget)}</td>
              <td className={`px-4 py-2 text-right text-sm ${totalExpenseActual <= effectiveExpenseBudget ? 'text-success-700 dark:text-success-400' : 'text-red-700 dark:text-red-400'}`}>{fmt(totalExpenseActual)}</td>
              <td className="px-4 py-2 text-right text-sm">
                <span className={`font-medium ${totalExpenseRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(totalExpenseRemaining)}</span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

ExpenseSection.propTypes = {
  expenses: PropTypes.array.isRequired,
  filteredExpenses: PropTypes.array.isRequired,
  locked: PropTypes.bool.isRequired,
  closed: PropTypes.bool.isRequired,
  autoExpenseEnabled: PropTypes.bool.isRequired,
  expenseStatusFilter: PropTypes.string.isRequired,
  dragOver: PropTypes.string,
  effectiveExpenseBudget: PropTypes.number.isRequired,
  totalExpenseActual: PropTypes.number.isRequired,
  totalExpenseRemaining: PropTypes.number.isRequired,
  formatters: PropTypes.object.isRequired,
  onAddExpense: PropTypes.func.isRequired,
  onEditBudget: PropTypes.func.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onRevise: PropTypes.func.isRequired,
  onAddTransaction: PropTypes.func.isRequired,
  onAddRefund: PropTypes.func.isRequired,
  onViewTransactions: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  deleteExpenseLine: PropTypes.object.isRequired,
  setExpenseStatus: PropTypes.object.isRequired,
  updateExpensePayType: PropTypes.object.isRequired,
  onStatusFilterChange: PropTypes.func.isRequired,
  onDragStart: PropTypes.func.isRequired,
  onDragOver: PropTypes.func.isRequired,
  onDragLeave: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
}
