import PropTypes from 'prop-types'
import { useFormatters } from '../useFormatters'
import { AmountSummaryGrid } from './AmountSummaryGrid'
import { TransactionListPanel } from './TransactionListPanel'
import { TransactionEntryForm } from './TransactionEntryForm'
import { getTransactionModalConfig, buildTransactionDisplayResolver } from '../../utils/transactionHelpers'

export function TransactionWorkflowModal({
  kind,
  items,
  isLoading,
  locked,
  readOnly = false,
  amount,
  setAmount,
  note,
  setNote,
  entrydate,
  error,
  setError,
  setResolvedAmount,
  budgetAmount,
  actualAmount,
  type,
  setType,
  onSubmit,
  isPending,
  onDelete,
  onClose,
  totalValue = null,
  accounts = null,
  selectedAccount = '',
  setSelectedAccount = () => {},
  sourceAccount = null,
  destinationAccount = null,
}) {
  const formatters = useFormatters()
  const config = getTransactionModalConfig(kind)
  const resolveDisplay = buildTransactionDisplayResolver(config, formatters)
  const interactionLocked = locked || readOnly

  return (
    <div className="space-y-4">
      <AmountSummaryGrid items={config.summaryItems({ budgetAmount, actualAmount })} formatters={formatters} />
      <TransactionListPanel
        items={items}
        isLoading={isLoading}
        locked={interactionLocked}
        headerLabel="Transactions"
        emptyLabel="No transactions yet"
        totalValue={totalValue}
        totalClassName={typeof config.totalClassName === 'function' ? config.totalClassName(totalValue) : null}
        getItemAmount={item => item.amount}
        getAmountClassName={(item, itemAmount) => resolveDisplay(item, itemAmount).amountClassName}
        getBadgeClassName={(item, itemAmount) => resolveDisplay(item, itemAmount).badgeClassName}
        getBadgeLabel={(item, itemAmount) => resolveDisplay(item, itemAmount).badgeLabel}
        getPrimaryText={(item, itemAmount) => resolveDisplay(item, itemAmount).primaryText}
        onDelete={onDelete}
        formatters={formatters}
      />
      {readOnly ? (
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <TransactionEntryForm
          kind={kind}
          locked={locked}
          amount={amount}
          setAmount={setAmount}
          note={note}
          setNote={setNote}
          entrydate={entrydate}
          error={error}
          setError={setError}
          setResolvedAmount={setResolvedAmount}
          budgetAmount={budgetAmount}
          type={type}
          setType={setType}
          typeOptions={config.typeOptions}
          onSubmit={onSubmit}
          submitLabel={config.submitLabel}
          isPending={isPending}
          onClose={onClose}
          actualAmount={actualAmount}
          accounts={accounts}
          selectedAccount={selectedAccount}
          setSelectedAccount={setSelectedAccount}
          sourceAccount={sourceAccount}
          destinationAccount={destinationAccount}
        />
      )}
    </div>
  )
}

TransactionWorkflowModal.propTypes = {
  kind: PropTypes.oneOf(['income', 'expense', 'investment']).isRequired,
  items: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  amount: PropTypes.string.isRequired,
  setAmount: PropTypes.func.isRequired,
  note: PropTypes.string.isRequired,
  setNote: PropTypes.func.isRequired,
  entrydate: PropTypes.string.isRequired,
  error: PropTypes.string.isRequired,
  setError: PropTypes.func.isRequired,
  setResolvedAmount: PropTypes.func.isRequired,
  budgetAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  type: PropTypes.string.isRequired,
  setType: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isPending: PropTypes.bool.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  totalValue: PropTypes.number,
  accounts: PropTypes.arrayOf(PropTypes.shape({
    balancedesc: PropTypes.string.isRequired,
  })),
  selectedAccount: PropTypes.string,
  setSelectedAccount: PropTypes.func,
  sourceAccount: PropTypes.string,
  destinationAccount: PropTypes.string,
}
