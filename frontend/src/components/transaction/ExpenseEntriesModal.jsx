import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { format, parseISO } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenseEntries, addExpenseEntry, deleteExpenseEntry, getBalanceTypes, getExpenseItems } from '../../api/client'
import { useFormatters } from '../useFormatters'
import { TransactionWorkflowModal } from './TransactionWorkflowModal'
import { getTransactionModalConfig, buildTransactionSubmitHandler } from '../../utils/transactionHelpers'

export function ExpenseEntriesModal({ periodId, budgetId, expensedesc, budgetamount, actualamount, locked, readOnly = false, onClose, defaultType = 'debit', periodStartDate, periodEndDate }) {
  const config = getTransactionModalConfig('expense')
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

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['expense-entries', periodId, expensedesc],
    queryFn: () => getExpenseEntries(budgetId, periodId, expensedesc),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })

  const { data: expenseItems = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })

  const primaryAccount = balanceTypes.find(bt => bt.is_primary && bt.balance_type === 'Transaction')

  useEffect(() => {
    setSelectedAccount('')
  }, [expensedesc])

  useEffect(() => {
    const item = expenseItems.find(e => e.expensedesc === expensedesc)
    if (item && !selectedAccount) {
      const account = item.default_account_desc || primaryAccount?.balancedesc || ''
      if (account) {
        setSelectedAccount(account)
      }
    }
  }, [expenseItems, expensedesc, primaryAccount, selectedAccount])

  const add = useMutation({
    mutationFn: data => addExpenseEntry(budgetId, periodId, expensedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
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
    mutationFn: entryId => deleteExpenseEntry(budgetId, periodId, expensedesc, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
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
    entrydate,
    periodStartDate,
    periodEndDate,
    toMutationAmount: config.toMutationAmount,
    extraPayload: { account_desc: selectedAccount || null },
  })

  const runningTotal = entries.filter(entry => entry.entry_kind !== 'budget_adjustment').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <TransactionWorkflowModal
      kind="expense"
      items={entries}
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
      onDelete={entryId => remove.mutate(entryId)}
      onClose={onClose}
      totalValue={runningTotal}
      accounts={balanceTypes.filter(bt => bt.active !== false)}
      selectedAccount={selectedAccount}
      setSelectedAccount={setSelectedAccount}
    />
  )
}

ExpenseEntriesModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  budgetId: PropTypes.number.isRequired,
  expensedesc: PropTypes.string.isRequired,
  budgetamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  actualamount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  locked: PropTypes.bool.isRequired,
  readOnly: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  defaultType: PropTypes.oneOf(['debit', 'credit']),
  periodStartDate: PropTypes.string,
  periodEndDate: PropTypes.string,
}
