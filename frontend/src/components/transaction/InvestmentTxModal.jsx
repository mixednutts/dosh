import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction, getBalanceTypes } from '../../api/client'
import { useFormatters } from '../useFormatters'
import { TransactionWorkflowModal } from './TransactionWorkflowModal'
import { getTransactionModalConfig, buildTransactionSubmitHandler } from '../../utils/transactionHelpers'

export function InvestmentTxModal({ periodId, budgetId, investmentdesc, openingValue, closingValue, budgetedAmount, sourceAccount, destinationAccount, locked, readOnly = false, onClose, defaultType = 'increase' }) {
  const config = getTransactionModalConfig('investment')
  const qc = useQueryClient()
  const formatters = useFormatters()
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [entrydate, setEntrydate] = useState('')
  const [type, setType] = useState(defaultType)
  const [error, setError] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')

  useEffect(() => {
    setEntrydate(formatters.fmtDateTime(new Date()))
  }, [formatters])

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['investment-tx', periodId, investmentdesc],
    queryFn: () => getInvestmentTransactions(budgetId, periodId, investmentdesc),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })

  useEffect(() => {
    if (sourceAccount && !selectedAccount) {
      setSelectedAccount(sourceAccount)
    }
  }, [sourceAccount, selectedAccount])

  const add = useMutation({
    mutationFn: data => addInvestmentTransaction(budgetId, periodId, investmentdesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setEntrydate(formatters.fmtDateTime(new Date()))
      setError('')
      setSelectedAccount(sourceAccount || '')
      onClose()
    },
    onError: error => {
      setError(error?.response?.data?.detail || 'Unable to save this transaction.')
    },
  })

  const remove = useMutation({
    mutationFn: txId => deleteInvestmentTransaction(budgetId, periodId, investmentdesc, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment-tx', periodId, investmentdesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
    },
  })

  const handleAdd = buildTransactionSubmitHandler({
    resolvedAmount,
    setError,
    mutate: add.mutate,
    type,
    note,
    toMutationAmount: config.toMutationAmount,
    extraPayload: { account_desc: selectedAccount || null },
  })

  // Derive actual from transactions total for live display
  const txTotal = transactions.filter(tx => tx.entry_kind !== 'budget_adjustment' && tx.entry_kind !== 'status_change').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <TransactionWorkflowModal
      kind="investment"
      items={transactions}
      isLoading={isLoading}
      locked={locked}
      readOnly={readOnly}
      amount={amount}
      setAmount={setAmount}
      note={note}
      setNote={setNote}
      entrydate={entrydate}
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
      budgetAmount={budgetedAmount ?? 0}
      actualAmount={txTotal}
      type={type}
      setType={setType}
      onSubmit={handleAdd}
      isPending={add.isPending}
      onDelete={txId => remove.mutate(txId)}
      onClose={onClose}
      totalValue={null}
      accounts={balanceTypes.filter(bt => bt.active !== false && bt.balancedesc !== destinationAccount)}
      selectedAccount={selectedAccount}
      setSelectedAccount={setSelectedAccount}
      sourceAccount={sourceAccount}
      destinationAccount={destinationAccount}
    />
  )
}

InvestmentTxModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  investmentdesc: PropTypes.string.isRequired,
  openingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  closingValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  budgetedAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  sourceAccount: PropTypes.string,
  destinationAccount: PropTypes.string,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['increase', 'decrease']),
}
