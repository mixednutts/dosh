import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LockClosedIcon, LockOpenIcon, ChevronRightIcon, ChevronLeftIcon,
  ArrowDownTrayIcon, ArrowUpIcon,
} from '@heroicons/react/24/outline'
import {
  getPeriodDetail, getBudget, setPeriodLock, getPeriodsForBudget, getPeriodBalances,
  reorderPeriodExpenses,
  setPeriodExpenseStatus, updatePeriodExpenseBudget, removePeriodExpense,
  updatePeriodInvestmentBudget, removePeriodIncome, updatePeriodIncomeBudget, setPeriodIncomeStatus,
  setPeriodInvestmentStatus, updatePeriodExpensePayType, runPeriodAutoExpenses,
} from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { useLocalisation } from '../components/LocalisationContext'
import { useFormatters } from '../components/useFormatters'
import { getCycleStage, getCycleStageLabel } from '../utils/periodStage'
import {
  getPeriodBudgetMutation,
  getPositiveRemainingValue,
  getIncomeSurplusContribution,
  getOutflowSurplusContribution,
} from '../utils'
import {
  ConfirmPaidExpenseModal,
  ConfirmPaidInvestmentModal,
  ConfirmPaidIncomeModal,
} from '../components/status'
import {
  IncomeTransactionsModal,
  ExpenseEntriesModal,
  InvestmentTxModal,
} from '../components/transaction'
import {
  AddIncomeLineModal,
  AddExpenseLineModal,
} from '../components/period-lines'
import {
  BalanceTransactionsModal,
  BudgetAdjustmentModal,
  CloseoutModal,
  ExportCycleModal,
} from '../components/modals'
import {
  IncomeSection,
  ExpenseSection,
  InvestmentSection,
  BalanceSection,
} from '../components/period-sections'
import { CurrentPeriodCheckPanel } from './BudgetsPage'


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PeriodDetailPage() {
  const { budgetId, periodId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const budgetid = Number.parseInt(budgetId, 10)
  const id = Number.parseInt(periodId, 10)
  const qc = useQueryClient()
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [incomeModal, setIncomeModal] = useState(null)
  const [entriesModal, setEntriesModal] = useState(null)
  const [budgetAdjustModal, setBudgetAdjustModal] = useState(null)
  const [confirmPaidModal, setConfirmPaidModal] = useState(null)
  const [confirmPaidInvestmentModal, setConfirmPaidInvestmentModal] = useState(null)
  const [confirmPaidIncomeModal, setConfirmPaidIncomeModal] = useState(null)
  const [balanceModal, setBalanceModal] = useState(null)
  const [showCloseout, setShowCloseout] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all')
  const [autoExpenseFeedback, setAutoExpenseFeedback] = useState(null)
  const [expensePayTypeWarning, setExpensePayTypeWarning] = useState(null)

  const [investmentModal, setInvestmentModal] = useState(null)
  const [showReturnTop, setShowReturnTop] = useState(false)
  const LOCK_BANNER_KEY = `dosh_dismiss_lock_banner:${id}`
  const [dismissLockedBanner, setDismissLockedBanner] = useState(() => {
    try { return sessionStorage.getItem(LOCK_BANNER_KEY) === 'true' } catch { return false }
  })

  const [localExpenses, setLocalExpenses] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragSrc = useRef(null)

  // Localised formatters (use localisation context from budget)
  const formatters = useFormatters()
  const { fmt, fmtDate, fmtDateRange } = formatters

  const { data, isLoading, isError } = useQuery({ queryKey: ['period', id], queryFn: () => getPeriodDetail(budgetid, id) })
  const { data: balancesData } = useQuery({
    queryKey: ['period-balances', id],
    queryFn: () => getPeriodBalances(budgetid, id),
    enabled: !!id,
  })
  const { data: budget } = useQuery({
    queryKey: ['budget', data?.period?.budgetid],
    queryFn: () => getBudget(data.period.budgetid),
    enabled: !!data?.period?.budgetid,
  })
  const { data: allPeriods } = useQuery({
    queryKey: ['periods', data?.period?.budgetid],
    queryFn: () => getPeriodsForBudget(data.period.budgetid),
    enabled: !!data?.period?.budgetid,
  })

  useEffect(() => {
    const handleScroll = () => setShowReturnTop(globalThis.scrollY > 420)
    handleScroll()
    globalThis.addEventListener('scroll', handleScroll, { passive: true })
    return () => globalThis.removeEventListener('scroll', handleScroll)
  }, [])

  const lock = useMutation({ mutationFn: islocked => setPeriodLock(budgetid, id, islocked), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const setExpenseStatus = useMutation({ mutationFn: ({ desc, status, revisionComment = null }) => setPeriodExpenseStatus(budgetid, id, desc, status, revisionComment), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const updateExpensePayType = useMutation({
    mutationFn: ({ desc, paytype }) => updatePeriodExpensePayType(budgetid, id, desc, paytype),
    onMutate: () => {
      setExpensePayTypeWarning(null)
    },
    onSuccess: () => {
      setAutoExpenseFeedback(null)
      qc.invalidateQueries({ queryKey: ['period', id] })
      qc.invalidateQueries({ queryKey: ['period-balances', id] })
      qc.invalidateQueries({ queryKey: ['expense-items', data?.period?.budgetid] })
    },
    onError: (error, variables) => setExpensePayTypeWarning({
      desc: variables.desc,
      text: error?.response?.data?.detail || 'Unable to update AUTO/MANUAL right now.',
    }),
  })
  const runAutoExpenses = useMutation({
    mutationFn: () => runPeriodAutoExpenses(budgetid, id),
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['period', id] })
      qc.invalidateQueries({ queryKey: ['period-balances', id] })
      setAutoExpenseFeedback({
        tone: 'success',
        text: result.created_count > 0
          ? (() => { const w = result.created_count === 1 ? 'transaction' : 'transactions'; return `Created ${result.created_count} AUTO expense ${w}.`; })()
          : (result.skipped_reasons?.[0] || 'No AUTO expense transactions were due for this budget cycle.'),
      })
    },
    onError: error => setAutoExpenseFeedback({ tone: 'error', text: error?.response?.data?.detail || 'Unable to run Auto Expense right now.' }),
  })
  const setInvestmentStatus = useMutation({ mutationFn: ({ desc, status, revisionComment = null }) => setPeriodInvestmentStatus(budgetid, id, desc, status, revisionComment), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const setIncomeStatus = useMutation({ mutationFn: ({ desc, status, revisionComment = null }) => setPeriodIncomeStatus(budgetid, id, desc, status, revisionComment), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const editIncomeBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodIncomeBudget(budgetid, id, desc, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const editExpenseBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodExpenseBudget(budgetid, id, desc, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const deleteExpenseLine = useMutation({ mutationFn: desc => removePeriodExpense(budgetid, id, desc), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const deleteIncomeLine = useMutation({ mutationFn: desc => removePeriodIncome(budgetid, id, desc), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })
  const editInvBudget = useMutation({ mutationFn: ({ desc, data }) => updatePeriodInvestmentBudget(budgetid, id, desc, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', id] }); qc.invalidateQueries({ queryKey: ['period-balances', id] }) } })

  // Reset local drag-reorder when server data refreshes
  useEffect(() => { setLocalExpenses(null) }, [data])

  const period = data?.period ?? null

  useEffect(() => {
    try { setDismissLockedBanner(sessionStorage.getItem(LOCK_BANNER_KEY) === 'true') } catch { setDismissLockedBanner(false) }
  }, [id, LOCK_BANNER_KEY])

  useEffect(() => {
    if (period && !period.islocked) {
      try { sessionStorage.removeItem(LOCK_BANNER_KEY) } catch { /* ignore */ }
      setDismissLockedBanner(false)
    }
  }, [period?.islocked, LOCK_BANNER_KEY])

  const cycleStage = getCycleStage(period)
  const activeCycle = cycleStage === 'CURRENT' || cycleStage === 'PENDING_CLOSURE'

  useEffect(() => {
    if (activeCycle && searchParams.get('closeout') === '1' && !showCloseout) {
      setShowCloseout(true)
    }
  }, [activeCycle, searchParams, showCloseout])

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (isError) return <p className="text-red-500 p-4">Failed to load budget cycle. <Link to="/budgets" className="underline">Back to Budgets</Link></p>
  if (!data) return <p className="text-gray-500">Budget cycle not found.</p>

  const { incomes, investments = [] } = data
  const balances = balancesData ?? data.balances ?? []
  const balancesLimitExceeded = data.balances_limit_exceeded === true
  const expenses = localExpenses ?? data.expenses

  // Compute previous and next period IDs for navigation
  const sortedPeriods = allPeriods ? [...allPeriods].sort((a, b) => new Date(a.startdate) - new Date(b.startdate)) : []
  const currentPeriodIndex = sortedPeriods.findIndex(p => p.finperiodid === id)
  const prevPeriod = currentPeriodIndex > 0 ? sortedPeriods[currentPeriodIndex - 1] : null
  const nextPeriod = currentPeriodIndex >= 0 && currentPeriodIndex < sortedPeriods.length - 1 ? sortedPeriods[currentPeriodIndex + 1] : null
  let closeoutHealth = null
  try {
    closeoutHealth = data.closeout_snapshot?.health_snapshot_json ? JSON.parse(data.closeout_snapshot.health_snapshot_json) : null
  } catch {
    closeoutHealth = null
  }
  const budgetLockEnabled = budget?.allow_cycle_lock !== false
  const locked = budgetLockEnabled && period.islocked
  const closed = cycleStage === 'CLOSED'
  const autoExpenseEnabled = !!budget?.auto_expense_enabled

  const openCloseoutModal = () => {
    setShowCloseout(true)
  }

  const closeCloseoutModal = () => {
    setShowCloseout(false)
    if (searchParams.get('closeout') === '1') {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('closeout')
      setSearchParams(nextSearchParams, { replace: true })
    }
  }

  const handleDragStart = (desc) => { dragSrc.current = desc }
  const handleDragOver  = (e, desc) => { e.preventDefault(); setDragOver(desc) }
  const handleDragLeave = () => setDragOver(null)
  const handleDrop = (e, targetDesc) => {
    e.preventDefault()
    setDragOver(null)
    if (expenseStatusFilter !== 'all') return
    const src = dragSrc.current
    if (!src || src === targetDesc) return
    const cur = [...expenses]
    const si = cur.findIndex(x => x.expensedesc === src)
    const ti = cur.findIndex(x => x.expensedesc === targetDesc)
    if (si < 0 || ti < 0) return
    if (locked || closed) return
    const [moved] = cur.splice(si, 1)
    cur.splice(ti, 0, moved)
    setLocalExpenses(cur)
    const items = cur.map((x, i) => ({ expensedesc: x.expensedesc, sort_order: i }))
    reorderPeriodExpenses(budgetid, id, items).catch(() => setLocalExpenses(null))
  }
  const totalIncomeBudget    = incomes.reduce((s, i) => s + Number(i.budgetamount), 0)
  const totalIncomeActual    = incomes.reduce((s, i) => s + Number(i.actualamount), 0)
  const effectiveExpenseBudget = expenses.reduce((s, e) => s + Number(e.budgetamount), 0)
  const totalExpenseActual   = expenses.reduce((s, e) => s + Number(e.actualamount), 0)
  const effectiveInvestmentBudget = investments.reduce((s, inv) => s + Number(inv.budgeted_amount ?? 0), 0)
  const totalInvestmentActual = investments.reduce((s, inv) => s + Number(inv.actualamount ?? 0), 0)
  const totalInvestmentRemaining = investments.reduce((s, inv) => s + getPositiveRemainingValue(inv.remaining_amount), 0)
  const totalExpenseRemaining = expenses.reduce((s, e) => s + getPositiveRemainingValue(e.remaining_amount), 0)

  const surplusActual = totalIncomeActual - totalExpenseActual - totalInvestmentActual
  const budgetIncomeContribution = incomes.reduce((s, income) => (
    s + getIncomeSurplusContribution({
      budgetAmount: income.budgetamount,
      actualAmount: income.actualamount,
    })
  ), 0)
  const budgetExpenseContribution = expenses.reduce((s, expense) => (
    s + getOutflowSurplusContribution({
      actualAmount: expense.actualamount,
      remainingAmount: expense.remaining_amount,
    })
  ), 0)
  const budgetInvestmentContribution = investments.reduce((s, investment) => (
    s + getOutflowSurplusContribution({
      actualAmount: investment.actualamount,
      remainingAmount: investment.remaining_amount,
    })
  ), 0)
  const surplusBudget = budgetIncomeContribution - budgetExpenseContribution - budgetInvestmentContribution
  const projectedInvestment = Number(data.projected_investment ?? 0)
  const filteredExpenses = expenses.filter(expense => expenseStatusFilter === 'all' || expense.status === expenseStatusFilter)

  const handleMarkPaid = expense => {
    const remaining = Number(expense.remaining_amount ?? 0)
    if (remaining !== 0) {
      setConfirmPaidModal({ expense })
      return
    }
    setExpenseStatus.mutate({ desc: expense.expensedesc, status: 'Paid' })
  }

  const handleMarkInvestmentPaid = investment => {
    const remaining = Number(investment.remaining_amount ?? 0)
    if (remaining !== 0) {
      setConfirmPaidInvestmentModal({ investment })
      return
    }
    setInvestmentStatus.mutate({ desc: investment.investmentdesc, status: 'Paid' })
  }

  const handleMarkIncomePaid = income => {
    const remaining = Number(income.actualamount ?? 0) - Number(income.budgetamount ?? 0)
    if (remaining !== 0) {
      setConfirmPaidIncomeModal({ income })
      return
    }
    setIncomeStatus.mutate({ desc: income.incomedesc, status: 'Paid' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link to="/budgets" className="hover:underline">Budgets</Link>
            <ChevronRightIcon className="w-3 h-3" />
            {budget && <Link to={`/budgets/${budget.budgetid}`} className="hover:underline">{budget.description}</Link>}
            <ChevronRightIcon className="w-3 h-3" />
            <span className="text-gray-800 dark:text-gray-200">Budget Cycle Details</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {fmtDateRange(period.startdate, period.enddate)}
          </h1>
          {budget && <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budget_frequency} · {budget.budgetowner} · {getCycleStageLabel(cycleStage)}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowExport(true)} title="Export budget cycle">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
          {autoExpenseEnabled && !closed && (
            <button className="btn-secondary" onClick={() => runAutoExpenses.mutate()} title="Run Auto Expense">
              {runAutoExpenses.isPending ? 'Running…' : 'Run Auto Expense'}
            </button>
          )}
          {activeCycle && !closed && (
            <button className="btn-primary" onClick={openCloseoutModal}>
              Close Out
            </button>
          )}
          {budgetLockEnabled && !closed && (
            <button className="btn-secondary" onClick={() => lock.mutate(!locked)} title={locked ? 'Unlock' : 'Lock'}>
              {locked ? <><LockClosedIcon className="w-4 h-4 text-amber-500" /> Locked</> : <><LockOpenIcon className="w-4 h-4" /> Unlocked</>}
            </button>
          )}
        </div>
      </div>

      {closed && (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700/40 dark:bg-slate-900/15 dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <LockClosedIcon className="h-4 w-4 shrink-0" />
            This budget cycle is closed. All data for this budget cycle is now read-only.
          </span>
        </div>
      )}

      {locked && !closed && !dismissLockedBanner && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-2.5 text-sm font-bold text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/10 dark:text-amber-300">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <LockClosedIcon className="h-4 w-4 shrink-0" />
              Budget cycle is locked. You can still record actuals and transactions, but budget amounts and cycle line structure are protected unless you unlock it.
            </span>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
              onClick={() => {
                try { sessionStorage.setItem(LOCK_BANNER_KEY, 'true') } catch { /* ignore */ }
                setDismissLockedBanner(true)
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {autoExpenseFeedback && (
        <div className={`rounded-xl border px-4 py-3 ${
          autoExpenseFeedback.tone === 'error'
            ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
        }`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Auto Expense</p>
          <p className={`mt-1 text-sm font-medium ${
            autoExpenseFeedback.tone === 'error'
              ? 'text-red-700 dark:text-red-300'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {autoExpenseFeedback.text}
          </p>
        </div>
      )}

      {/* Period Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={prevPeriod ? `/budgets/${budgetid}/periods/${prevPeriod.finperiodid}` : '#'}
          className={`flex items-center gap-1 text-sm font-medium ${prevPeriod ? 'text-dosh-600 hover:text-dosh-700 dark:text-dosh-400 dark:hover:text-dosh-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
          onClick={e => { if (!prevPeriod) e.preventDefault() }}
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span className="hidden sm:inline">{prevPeriod ? fmtDate(prevPeriod.startdate) : 'Previous'}</span>
        </Link>
        <Link
          to={nextPeriod ? `/budgets/${budgetid}/periods/${nextPeriod.finperiodid}` : '#'}
          className={`flex items-center gap-1 text-sm font-medium ${nextPeriod ? 'text-dosh-600 hover:text-dosh-700 dark:text-dosh-400 dark:hover:text-dosh-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
          onClick={e => { if (!nextPeriod) e.preventDefault() }}
        >
          <span className="hidden sm:inline">{nextPeriod ? fmtDate(nextPeriod.startdate) : 'Next'}</span>
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
      </div>

      {closed && data.closeout_snapshot && (
        <div className="card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Close Out Details</p>
          {closeoutHealth && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Health</p>
              <div className="mt-1">
                <CurrentPeriodCheckPanel assessment={closeoutHealth} showMetricCards defaultMetricCardsOpen={false} />
              </div>
            </div>
          )}
          {data.closeout_snapshot.comments && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Cycle Notes & Observations</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{data.closeout_snapshot.comments}</p>
            </div>
          )}
          {Number(data.closeout_snapshot.carry_forward_amount || 0) !== 0 && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Carried Forward</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(data.closeout_snapshot.carry_forward_amount)}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Income Budget',  value: totalIncomeBudget,  cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Income Actual',  value: totalIncomeActual,  cls: 'text-success-700 dark:text-success-400' },
          { label: 'Expense Budget', value: effectiveExpenseBudget, cls: 'text-gray-700 dark:text-gray-300' },
          { label: 'Expense Actual', value: totalExpenseActual, cls: totalExpenseActual <= effectiveExpenseBudget ? 'text-success-700 dark:text-success-400' : 'text-red-700 dark:text-red-400' },
          { label: 'Remaining Expenses', value: totalExpenseRemaining, cls: totalExpenseRemaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Projected Investment', value: projectedInvestment },
          { label: 'Surplus (Budget)', value: surplusBudget },
          { label: 'Surplus (Actual)', value: surplusActual },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-lg font-bold ${cls || (value >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400')}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      <IncomeSection
        incomes={incomes}
        locked={locked}
        closed={closed}
        totalIncomeBudget={totalIncomeBudget}
        totalIncomeActual={totalIncomeActual}
        formatters={formatters}
        onAddIncome={() => setShowAddIncome(true)}
        onEditBudget={(i) => setBudgetAdjustModal({ category: 'income', desc: i.incomedesc, budgetamount: i.budgetamount, title: i.incomedesc })}
        onMarkPaid={handleMarkIncomePaid}
        onRevise={() => {}}
        onAddTransaction={(i) => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit' })}
        onAddCorrection={(i) => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'debit' })}
        onViewTransactions={(i) => setIncomeModal({ incomedesc: i.incomedesc, budgetamount: i.budgetamount, actualamount: i.actualamount, defaultType: 'credit', readOnly: true })}
        onDeleteLine={() => {}}
        deleteIncomeLine={deleteIncomeLine}
        setIncomeStatus={setIncomeStatus}
      />

      <ExpenseSection
        expenses={expenses}
        filteredExpenses={filteredExpenses}
        locked={locked}
        closed={closed}
        autoExpenseEnabled={autoExpenseEnabled}
        expenseStatusFilter={expenseStatusFilter}
        dragOver={dragOver}
        effectiveExpenseBudget={effectiveExpenseBudget}
        totalExpenseActual={totalExpenseActual}
        totalExpenseRemaining={totalExpenseRemaining}
        formatters={formatters}
        onAddExpense={() => setShowAddExpense(true)}
        onEditBudget={(e) => setBudgetAdjustModal({ category: 'expense', desc: e.expensedesc, budgetamount: e.budgetamount, title: e.expensedesc })}
        onMarkPaid={handleMarkPaid}
        onRevise={() => {}}
        onAddTransaction={(e) => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit' })}
        onAddRefund={(e) => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'credit' })}
        onViewTransactions={(e) => setEntriesModal({ expensedesc: e.expensedesc, budgetamount: e.budgetamount, actualamount: e.actualamount, defaultType: 'debit', readOnly: true })}
        onDeleteLine={() => {}}
        deleteExpenseLine={deleteExpenseLine}
        setExpenseStatus={setExpenseStatus}
        updateExpensePayType={updateExpensePayType}
        onStatusFilterChange={setExpenseStatusFilter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      <InvestmentSection
        investments={investments}
        locked={locked}
        closed={closed}
        effectiveInvestmentBudget={effectiveInvestmentBudget}
        totalInvestmentActual={totalInvestmentActual}
        totalInvestmentRemaining={totalInvestmentRemaining}
        formatters={formatters}
        onEditBudget={(inv) => setBudgetAdjustModal({ category: 'investment', desc: inv.investmentdesc, budgetamount: inv.budgeted_amount, title: inv.investmentdesc })}
        onMarkPaid={handleMarkInvestmentPaid}
        onRevise={() => {}}
        onAddTransaction={() => {}}
        onAddWithdrawal={() => {}}
        onViewTransactions={() => {}}
        setInvestmentStatus={setInvestmentStatus}
        setInvestmentModal={setInvestmentModal}
      />

      <BalanceSection
        balances={balances}
        limitExceeded={balancesLimitExceeded}
        formatters={formatters}
        onViewTransactions={(b) => setBalanceModal({ balancedesc: b.balancedesc, movementAmount: b.movement_amount ?? 0 })}
      />

      {/* Modals */}
      {incomeModal && (
        <Modal title={`Transactions — ${incomeModal.incomedesc}`} onClose={() => setIncomeModal(null)} size="lg">
          <IncomeTransactionsModal
            periodId={id}
            budgetId={period.budgetid}
            incomedesc={incomeModal.incomedesc}
            budgetamount={incomeModal.budgetamount}
            actualamount={incomeModal.actualamount}
            locked={!!(closed || incomeModal.readOnly)}
            readOnly={!!incomeModal.readOnly}
            defaultType={incomeModal.defaultType ?? 'credit'}
            onClose={() => setIncomeModal(null)}
          />
        </Modal>
      )}
      {entriesModal && (
        <Modal title={`Transactions — ${entriesModal.expensedesc}`} onClose={() => setEntriesModal(null)} size="lg">
          <ExpenseEntriesModal
            periodId={id}
            budgetId={period.budgetid}
            expensedesc={entriesModal.expensedesc}
            budgetamount={entriesModal.budgetamount}
            actualamount={entriesModal.actualamount}
            locked={!!(closed || entriesModal.readOnly)}
            readOnly={!!entriesModal.readOnly}
            defaultType={entriesModal.defaultType ?? 'debit'}
            onClose={() => setEntriesModal(null)}
          />
        </Modal>
      )}
      {showAddExpense && (
        <Modal title="Add Expense to Budget Cycle" onClose={() => setShowAddExpense(false)} size="lg">
          <AddExpenseLineModal periodId={id} budgetId={period.budgetid} existingDescs={expenses.map(e => e.expensedesc)} onClose={() => setShowAddExpense(false)} />
        </Modal>
      )}
      {showAddIncome && (
        <Modal title="Add Income to Budget Cycle" onClose={() => setShowAddIncome(false)}>
          <AddIncomeLineModal periodId={id} budgetId={period.budgetid} existingDescs={incomes.map(i => i.incomedesc)} onClose={() => setShowAddIncome(false)} />
        </Modal>
      )}
      {budgetAdjustModal && (
        <Modal title={`Edit Line Budget — ${budgetAdjustModal.title}`} onClose={() => setBudgetAdjustModal(null)}>
          <BudgetAdjustmentModal
            title={budgetAdjustModal.title}
            currentAmount={budgetAdjustModal.budgetamount}
            onClose={() => setBudgetAdjustModal(null)}
            onSubmit={data => {
              const mutation = getPeriodBudgetMutation(budgetAdjustModal.category, {
                editIncomeBudget,
                editExpenseBudget,
                editInvBudget,
              })
              mutation.mutate({ desc: budgetAdjustModal.desc, data }, { onSuccess: () => setBudgetAdjustModal(null) })
            }}
          />
        </Modal>
      )}
      {balanceModal && (
        <Modal title={`Movement Details — ${balanceModal.balancedesc}`} onClose={() => setBalanceModal(null)} size="lg">
          <BalanceTransactionsModal
            periodId={id}
            budgetId={period.budgetid}
            balancedesc={balanceModal.balancedesc}
            movementAmount={balanceModal.movementAmount}
          />
        </Modal>
      )}
      {confirmPaidModal && (
        <Modal title="Mark Expense as Paid?" onClose={() => setConfirmPaidModal(null)}>
          <ConfirmPaidExpenseModal
            expense={confirmPaidModal.expense}
            onClose={() => setConfirmPaidModal(null)}
            onConfirm={() => {
              setExpenseStatus.mutate({ desc: confirmPaidModal.expense.expensedesc, status: 'Paid' })
              setConfirmPaidModal(null)
            }}
            formatters={formatters}
          />
        </Modal>
      )}
      {confirmPaidInvestmentModal && (
        <Modal title="Mark Investment as Paid?" onClose={() => setConfirmPaidInvestmentModal(null)}>
          <ConfirmPaidInvestmentModal
            investment={confirmPaidInvestmentModal.investment}
            onClose={() => setConfirmPaidInvestmentModal(null)}
            onConfirm={() => {
              setInvestmentStatus.mutate({ desc: confirmPaidInvestmentModal.investment.investmentdesc, status: 'Paid' })
              setConfirmPaidInvestmentModal(null)
            }}
            formatters={formatters}
          />
        </Modal>
      )}
      {confirmPaidIncomeModal && (
        <Modal title="Mark Income as Paid?" onClose={() => setConfirmPaidIncomeModal(null)}>
          <ConfirmPaidIncomeModal
            income={confirmPaidIncomeModal.income}
            onClose={() => setConfirmPaidIncomeModal(null)}
            onConfirm={() => {
              setIncomeStatus.mutate({ desc: confirmPaidIncomeModal.income.incomedesc, status: 'Paid' })
              setConfirmPaidIncomeModal(null)
            }}
            formatters={formatters}
          />
        </Modal>
      )}
      {investmentModal && (
        <Modal title={`Transactions — ${investmentModal.investmentdesc}`} onClose={() => setInvestmentModal(null)} size="lg">
          <InvestmentTxModal
            periodId={id}
            budgetId={data?.period?.budgetid}
            investmentdesc={investmentModal.investmentdesc}
            openingValue={investmentModal.openingValue}
            closingValue={investmentModal.closingValue}
            budgetedAmount={investmentModal.budgetedAmount}
            sourceAccount={investmentModal.sourceAccountDesc}
            destinationAccount={investmentModal.linkedAccountDesc}
            locked={!!(investmentModal.readOnly || closed)}
            readOnly={!!investmentModal.readOnly}
            defaultType={investmentModal.defaultType ?? 'increase'}
            onClose={() => setInvestmentModal(null)}
          />
        </Modal>
      )}
      {showCloseout && (
        <Modal title="Close Out Budget Cycle" onClose={closeCloseoutModal} size="lg">
          <CloseoutModal periodId={id} budgetId={period.budgetid} onClose={closeCloseoutModal} />
        </Modal>
      )}
      {showExport && (
        <Modal title="Export Budget Cycle" onClose={() => setShowExport(false)}>
          <ExportCycleModal periodId={id} budgetId={period.budgetid} onClose={() => setShowExport(false)} />
        </Modal>
      )}
      {expensePayTypeWarning && (
        <Modal title="Unable to Change AUTO/MANUAL" onClose={() => setExpensePayTypeWarning(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {expensePayTypeWarning.text}
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setExpensePayTypeWarning(null)}>OK</button>
            </div>
          </div>
        </Modal>
      )}

      {showReturnTop && (
        <button
          type="button"
          onClick={() => globalThis.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-dosh-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-dosh-700 dark:bg-dosh-700 dark:hover:bg-dosh-600"
          title="Return to top"
        >
          <ArrowUpIcon className="h-4 w-4" />
          Return to Top
        </button>
      )}
    </div>
  )
}

