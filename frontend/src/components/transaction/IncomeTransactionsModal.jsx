import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { format, parseISO } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncomeTransactions, addIncomeTransaction, deleteIncomeTransaction } from '../../api/client'
import { useFormatters } from '../useFormatters'
import { TransactionWorkflowModal } from './TransactionWorkflowModal'
import { getTransactionModalConfig, buildTransactionSubmitHandler } from '../../utils/transactionHelpers'

export function IncomeTransactionsModal({ periodId, budgetId, incomedesc, budgetamount, actualamount, locked, readOnly = false, onClose, defaultType = 'credit', periodStartDate, periodEndDate }) {
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
    const today = new Date()
    const start = periodStartDate ? parseISO(periodStartDate) : null
    const end = periodEndDate ? parseISO(periodEndDate) : null
    let defaultDate = today
    if (start && end) {
      const startOfDay = new Date(start)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(end)
      endOfDay.setHours(23, 59, 59, 999)
      if (today < startOfDay || today > endOfDay) {
        defaultDate = start
      }
    }
    setEntrydate(format(defaultDate, "yyyy-MM-dd'T'HH:mm:ss"))
  }, [periodStartDate, periodEndDate])

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['income-transactions', periodId, incomedesc],
    queryFn: () => getIncomeTransactions(budgetId, periodId, incomedesc),
  })

  const add = useMutation({
    mutationFn: data => addIncomeTransaction(budgetId, periodId, incomedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      qc.invalidateQueries({ queryKey: ['balance-transactions', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      const today = new Date()
      const start = periodStartDate ? parseISO(periodStartDate) : null
      const end = periodEndDate ? parseISO(periodEndDate) : null
      let defaultDate = today
      if (start && end) {
        const startOfDay = new Date(start)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(end)
        endOfDay.setHours(23, 59, 59, 999)
        if (today < startOfDay || today > endOfDay) {
          defaultDate = start
        }
      }
      setEntrydate(format(defaultDate, "yyyy-MM-dd'T'HH:mm:ss"))
      setError('')
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: txId => deleteIncomeTransaction(budgetId, periodId, incomedesc, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-transactions', periodId, incomedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      qc.invalidateQueries({ queryKey: ['balance-transactions', periodId] })
    },
  })

  const handleAdd = buildTransactionSubmitHandler({
    resolvedAmount,
    setError,
    mutate: add.mutate,
    type,
    note,
    entrydate,
    periodStartDate,
    periodEndDate,
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
      setEntrydate={setEntrydate}
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
      periodStartDate={periodStartDate}
      periodEndDate={periodEndDate}
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
  periodStartDate: PropTypes.string,
  periodEndDate: PropTypes.string,
}
