import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenseEntries, addExpenseEntry, deleteExpenseEntry, getBalanceTypes, getExpenseItems } from '../../api/client'
import { useFormatters } from '../useFormatters'
import { TransactionWorkflowModal } from './TransactionWorkflowModal'
import { getTransactionModalConfig, buildTransactionSubmitHandler } from '../../utils/transactionHelpers'

export function ExpenseEntriesModal({ periodId, budgetId, expensedesc, budgetamount, actualamount, locked, readOnly = false, onClose, defaultType = 'debit' }) {
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
    setEntrydate(formatters.fmtDateTime(new Date()))
  }, [formatters])

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['expense-entries', periodId, expensedesc],
    queryFn: () => getExpenseEntries(periodId, expensedesc),
  })

  const { data: balanceTypes = [] } = useQuery({
    queryKey: ['balance-types', budgetId],
    queryFn: () => getBalanceTypes(budgetId),
  })

  const { data: expenseItems = [] } = useQuery({
    queryKey: ['expense-items', budgetId],
    queryFn: () => getExpenseItems(budgetId),
  })

  const primaryAccount = balanceTypes.find(bt => bt.is_primary)
  const expenseItem = expenseItems.find(e => e.expensedesc === expensedesc)
  const defaultAccount = expenseItem?.default_account_desc || primaryAccount?.balancedesc || ''

  useEffect(() => {
    if (defaultAccount && !selectedAccount) {
      setSelectedAccount(defaultAccount)
    }
  }, [defaultAccount, selectedAccount])

  const add = useMutation({
    mutationFn: data => addExpenseEntry(periodId, expensedesc, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      setAmount('')
      setResolvedAmount({ value: null, state: 'empty' })
      setNote('')
      setEntrydate(formatters.fmtDateTime(new Date()))
      setError('')
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: entryId => deleteExpenseEntry(periodId, expensedesc, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-entries', periodId, expensedesc] })
      qc.invalidateQueries({ queryKey: ['period', periodId] })
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
      error={error}
      setError={setError}
      setResolvedAmount={setResolvedAmount}
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
}
