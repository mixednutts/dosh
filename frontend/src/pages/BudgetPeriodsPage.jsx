import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRightIcon, PlusIcon, Cog6ToothIcon, TrashIcon } from '@heroicons/react/24/outline'
import { addDays, format, parseISO } from 'date-fns'
import { deletePeriod, getBudget, getExpenseItems, getIncomeTypes, getPeriodSummariesForBudget, generatePeriod } from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

const fmt = value => Number(value ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function toDateInputValue(value) {
  return format(value, 'yyyy-MM-dd')
}

function PeriodGenerateForm({ initialStartDate, onSubmit, onClose, loading, error }) {
  const [startDate, setStartDate] = useState(initialStartDate)
  const [count, setCount] = useState(1)

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ startDate, count }) }} className="space-y-4">
      <div>
        <label className="label">Start Date</label>
        <input
          required
          type="date"
          className="input"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
      </div>
      <div>
        <label className="label">How Many Periods</label>
        <input
          required
          min="1"
          max="12"
          type="number"
          className="input"
          value={count}
          onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Generate one or more consecutive periods from this start date.
        </p>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Generating…' : 'Generate Period'}
        </button>
      </div>
    </form>
  )
}

function Metric({ label, value, tone = 'text-gray-700 dark:text-gray-300' }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone}`}>{fmt(value)}</p>
    </div>
  )
}

function PeriodCard({ summary, onDelete }) {
  const { period, period_status: periodStatus } = summary
  const surplusBudgetTone = Number(summary.surplus_budget) >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'
  const surplusActualTone = Number(summary.surplus_actual) >= 0 ? 'text-dosh-600 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'
  const projectedSavingsTone = Number(summary.projected_savings) >= 0 ? 'text-dosh-700 dark:text-dosh-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {format(parseISO(period.startdate), 'dd MMM yyyy')} - {format(parseISO(period.enddate), 'dd MMM yyyy')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Period ID {period.finperiodid}
          </p>
        </div>
        <div className="flex gap-2">
          {periodStatus && <span className="badge-blue">{periodStatus}</span>}
          {period.islocked && <span className="badge-amber">Locked</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Metric label="Projected Savings" value={summary.projected_savings} tone={projectedSavingsTone} />
        <Metric label="Income Budget" value={summary.income_budget} />
        <Metric label="Income Actual" value={summary.income_actual} tone="text-dosh-700 dark:text-dosh-400" />
        <Metric label="Expense Budget" value={summary.expense_budget} />
        <Metric label="Expense Actual" value={summary.expense_actual} tone="text-red-600 dark:text-red-400" />
        <Metric label="Investment Budget" value={summary.investment_budget} />
        <Metric label="Investment Actual" value={summary.investment_actual} tone="text-dosh-700 dark:text-dosh-400" />
        <Metric label="Surplus (Budget)" value={summary.surplus_budget} tone={surplusBudgetTone} />
        <Metric label="Surplus (Actual)" value={summary.surplus_actual} tone={surplusActualTone} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {periodStatus === 'Future' ? 'Ready for planning and optional removal.' : 'Open the period to review full balances, transactions, and line details.'}
        </p>
        <div className="flex gap-2">
          {summary.can_delete && (
            <button
              type="button"
              className="btn-secondary text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
              onClick={() => onDelete(summary)}
            >
              <TrashIcon className="h-4 w-4" /> Delete
            </button>
          )}
          <Link to={`/periods/${period.finperiodid}`} className="btn-primary">
            Open Period
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function BudgetPeriodsPage() {
  const { budgetId } = useParams()
  const id = parseInt(budgetId, 10)
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => getBudget(id),
  })
  const { data: periodSummaries = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['period-summaries', id],
    queryFn: () => getPeriodSummariesForBudget(id),
    enabled: !!budget,
  })
  const { data: incomeTypes = [] } = useQuery({
    queryKey: ['income-types', id],
    queryFn: () => getIncomeTypes(id),
    enabled: !!budget,
  })
  const { data: expenseItems = [] } = useQuery({
    queryKey: ['expense-items', id],
    queryFn: () => getExpenseItems(id),
    enabled: !!budget,
  })

  const activeExpenseItems = useMemo(
    () => expenseItems.filter(item => item.active),
    [expenseItems]
  )

  const periods = useMemo(
    () => periodSummaries.map(summary => summary.period),
    [periodSummaries]
  )

  const suggestedStartDate = useMemo(() => {
    if (periods.length === 0) return toDateInputValue(new Date())
    const latest = [...periods].sort((a, b) => parseISO(b.enddate) - parseISO(a.enddate))[0]
    return toDateInputValue(addDays(parseISO(latest.enddate), 1))
  }, [periods])

  const canGenerate = incomeTypes.length > 0 && activeExpenseItems.length > 0

  const createPeriod = useMutation({
    mutationFn: ({ startDate, count }) => generatePeriod({
      budgetid: id,
      startdate: `${startDate}T00:00:00`,
      count,
    }),
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ['periods', id] })
      qc.invalidateQueries({ queryKey: ['period-summaries', id] })
      setGenerateError('')
      setShowGenerate(false)
      if (created?.finperiodid) {
        qc.invalidateQueries({ queryKey: ['period', created.finperiodid] })
      }
    },
    onError: error => {
      setGenerateError(formatApiError(error, 'Unable to generate period right now.'))
    },
  })

  const removePeriod = useMutation({
    mutationFn: periodId => deletePeriod(periodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods', id] })
      qc.invalidateQueries({ queryKey: ['period-summaries', id] })
      setDeleteTarget(null)
    },
  })

  if (budgetLoading || periodsLoading) {
    return <div className="flex justify-center pt-16"><Spinner /></div>
  }
  if (!budget) {
    return <p className="text-gray-500">Budget not found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/budgets" className="hover:underline">Budgets</Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="font-medium text-gray-800 dark:text-gray-200">{budget.description || 'Untitled'}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{budget.description || 'Untitled Budget'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budgetowner} · {budget.budget_frequency}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/budgets/${id}/setup`} className="btn-secondary">
            <Cog6ToothIcon className="w-4 h-4" /> Budget Setup
          </Link>
          <button
            className="btn-primary"
            onClick={() => { setGenerateError(''); setShowGenerate(true) }}
            disabled={!canGenerate}
            title={!canGenerate ? 'Add at least one income type and one active expense item first' : 'Generate a new period'}
          >
            <PlusIcon className="w-4 h-4" /> New Period
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Existing Periods</p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{periods.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Income Types Ready</p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{incomeTypes.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Expense Items Ready</p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{activeExpenseItems.length}</p>
        </div>
      </div>

      {!canGenerate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          New periods require at least one income type and one active expense item. Finish the setup first, then come back here to generate periods.
        </div>
      )}

      {periods.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No periods yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This budget is ready to start using once you generate the first period.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to={`/budgets/${id}/setup`} className="btn-secondary">
              <Cog6ToothIcon className="w-4 h-4" /> Open Setup
            </Link>
            <button className="btn-primary" onClick={() => { setGenerateError(''); setShowGenerate(true) }} disabled={!canGenerate}>
              <PlusIcon className="w-4 h-4" /> Generate First Period
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Periods</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Next suggested start: {suggestedStartDate}
            </p>
          </div>
          <div className="grid gap-3">
            {[...periodSummaries]
              .sort((a, b) => parseISO(b.period.startdate) - parseISO(a.period.startdate))
              .map(summary => (
                <PeriodCard
                  key={summary.period.finperiodid}
                  summary={summary}
                  onDelete={setDeleteTarget}
                />
              ))}
          </div>
        </div>
      )}

      {showGenerate && (
        <Modal title={`Generate Period for ${budget.description || 'Untitled Budget'}`} onClose={() => setShowGenerate(false)}>
          <PeriodGenerateForm
            initialStartDate={suggestedStartDate}
            onSubmit={({ startDate, count }) => createPeriod.mutate({ startDate, count })}
            onClose={() => setShowGenerate(false)}
            loading={createPeriod.isPending}
            error={generateError}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Future Period" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete the future period from {format(parseISO(deleteTarget.period.startdate), 'dd MMM yyyy')} to {format(parseISO(deleteTarget.period.enddate), 'dd MMM yyyy')}?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only future periods without recorded actuals can be deleted.
            </p>
            {removePeriod.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {formatApiError(removePeriod.error, 'Unable to delete this period right now.')}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={removePeriod.isPending}
                onClick={() => removePeriod.mutate(deleteTarget.period.finperiodid)}
              >
                {removePeriod.isPending ? 'Deleting…' : 'Delete Period'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
