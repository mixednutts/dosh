import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncomeTransactions, addIncomeTransaction, deleteIncomeTransaction } from '../../api/client'
import { useFormatters } from '../useFormatters'
import { TransactionWorkflowModal } from './TransactionWorkflowModal'
import { getTransactionModalConfig, buildTransactionSubmitHandler } from '../../utils/transactionHelpers'

export function IncomeTransactionsModal({ periodId, incomedesc, budgetamount, actualamount, locked, readOnly = false, onClose, defaultType = 'credit' }) {
  const config = getTransactionModalConfig('income')
  const qc = useQueryClient()
  const formatters = useFormatters()
  const [amount, setAmount] = useState('')
  const [resolvedAmount, setResolvedAmount] = useState({ value: null, state: 'empty' })
  const [note, setNote] = useState('')
  const [entrydate, setEntrydate] = useState('')
  const [type, setType] = useState(defaultType)
  const [error, setError] = useState('')

  useEffect(() => {
    setEntrydate(formatters.fmtDateTime(new Date()))
  }, [formatters])

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['income-transactions', periodId, incomedesc],
    queryFn: () => getIncomeTransactions(periodId, incomedesc),
  })

  const add = useMutation({
    mutationFn: data => addIncomeTransaction(periodId, incomedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setEntrydate(formatters.fmtDateTime(new Date()))
      setError('')
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: txId => deleteIncomeTransaction(periodId, incomedesc, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
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
  })

  const runningTotal = transactions
    .filter(tx => tx.entry_kind !== 'budget_adjustment' && tx.entry_kind !== 'status_change')
    .reduce((s, tx) => s + Number(tx.amount), 0)

  return (
    <TransactionWorkflowModal
      kind="income"
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
      budgetAmount={budgetamount}
      actualAmount={actualamount}
      type={type}
      setType={setType}
      onSubmit={handleAdd}
      isPending={add.isPending}
      onDelete={txId => remove.mutate(txId)}
      onClose={onClose}
      totalValue={runningTotal}
    />
  )
}

IncomeTransactionsModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  incomedesc: PropTypes.string.isRequired,
  budgetamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['credit', 'debit']),
}
