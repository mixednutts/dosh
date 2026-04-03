import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Cog6ToothIcon, TrashIcon } from '@heroicons/react/24/outline'
import { addDays, format, parseISO } from 'date-fns'
import { deletePeriod, getBudget, getExpenseItems, getIncomeTypes, getPeriodSummariesForBudget, generatePeriod } from '../api/client'
import clsx from 'clsx'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

const fmt = value => Number(value ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function toDateInputValue(value) {
  return format(value, 'yyyy-MM-dd')
}

const PERIOD_SUMMARY_COLGROUP = (
  <colgroup>
    <col style={{ width: '240px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '110px' }} />
    <col style={{ width: '130px' }} />
    <col style={{ width: '130px' }} />
    <col style={{ width: '130px' }} />
    <col style={{ width: '150px' }} />
  </colgroup>
)

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
        <label className="label">How Many Budget Cycles</label>
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
          Generate one or more consecutive budget cycles from this start date.
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
          {loading ? 'Generating…' : 'Generate Budget Cycle'}
        </button>
      </div>
    </form>
  )
}

function getGroupedPeriodSummaries(periodSummaries) {
  const now = new Date()
  const ordered = [...periodSummaries].sort((a, b) => parseISO(a.period.startdate) - parseISO(b.period.startdate))

  return {
    current: ordered.filter(({ period }) => {
      try {
        const start = parseISO(period.startdate)
        const end = parseISO(period.enddate)
        return start <= now && end >= now
      } catch {
        return false
      }
    }),
    future: ordered.filter(({ period }) => {
      try {
        return parseISO(period.startdate) > now
      } catch {
        return false
      }
    }),
    historical: ordered.filter(({ period }) => {
      try {
        return parseISO(period.enddate) < now
      } catch {
        return false
      }
    }),
  }
}

function PeriodSummaryRow({ summary, onDelete }) {
  const { period } = summary
  const surplusBudgetTone = Number(summary.surplus_budget) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const surplusActualTone = Number(summary.surplus_actual) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const projectedSavingsTone = Number(summary.projected_savings) >= 0 ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const startLabel = format(parseISO(period.startdate), 'dd MMM yy')
  const endLabel = format(parseISO(period.enddate), 'dd MMM yy')

  return (
    <tr className="table-row align-top">
      <td className="table-cell">
        <Link
          to={`/periods/${period.finperiodid}`}
          className="block font-medium leading-snug text-gray-900 transition-colors hover:text-dosh-700 dark:text-gray-100 dark:hover:text-dosh-300"
          title="View budget cycle details"
        >
          <span className="block whitespace-nowrap">{startLabel} -</span>
          <span className="block whitespace-nowrap">{endLabel}</span>
        </Link>
        <div className="mt-1">
          {period.islocked && <span className="badge-amber">Locked</span>}
        </div>
      </td>
      <td className="table-cell-muted text-right col-budget">{fmt(summary.income_budget)}</td>
      <td className="table-cell text-right col-actual text-success-700 dark:text-success-400">{fmt(summary.income_actual)}</td>
      <td className="table-cell-muted text-right col-budget">{fmt(summary.expense_budget)}</td>
      <td className="table-cell text-right col-actual text-red-600 dark:text-red-400">{fmt(summary.expense_actual)}</td>
      <td className="table-cell-muted text-right col-budget">{fmt(summary.investment_budget)}</td>
      <td className="table-cell text-right col-actual text-success-700 dark:text-success-400">{fmt(summary.investment_actual)}</td>
      <td className={clsx('table-cell text-right font-semibold', projectedSavingsTone)}>{fmt(summary.projected_savings)}</td>
      <td className={clsx('table-cell text-right font-semibold', surplusBudgetTone)}>{fmt(summary.surplus_budget)}</td>
      <td className={clsx('table-cell text-right font-semibold', surplusActualTone)}>{fmt(summary.surplus_actual)}</td>
      <td className="table-cell">
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/periods/${period.finperiodid}`} className="btn-primary">
            Details
          </Link>
          {summary.can_delete && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => onDelete(summary)}
              title="Delete budget cycle"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function PeriodSummaryGroup({ title, summaries, collapsed = false, collapsible = false, onDelete }) {
  const [open, setOpen] = useState(!collapsed)

  if (summaries.length === 0) return null

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
        <button
          type="button"
          className="flex items-center gap-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
          onClick={() => collapsible && setOpen(value => !value)}
          title={collapsible ? (open ? `Collapse ${title.toLowerCase()} budget cycles` : `Expand ${title.toLowerCase()} budget cycles`) : undefined}
        >
          {collapsible ? (
            open ? <ChevronDownIcon className="h-4 w-4 shrink-0" /> : <ChevronRightIcon className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-60" />
          )}
          <span>{title}</span>
        </button>
      </div>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-sm">
            {PERIOD_SUMMARY_COLGROUP}
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header-cell text-left"></th>
                <th className="table-header-cell text-center" colSpan="2">Income</th>
                <th className="table-header-cell text-center" colSpan="2">Expenses</th>
                <th className="table-header-cell text-center" colSpan="2">Investments</th>
                <th className="table-header-cell"></th>
                <th className="table-header-cell"></th>
                <th className="table-header-cell"></th>
                <th className="table-header-cell"></th>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="table-header-cell text-left">Budget Cycle</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">Actual</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">Actual</th>
                <th className="table-header-cell text-right col-budget">Budget</th>
                <th className="table-header-cell text-right col-actual">Actual</th>
                <th className="table-header-cell text-right">Projected Savings</th>
                <th className="table-header-cell text-right">Surplus Budget</th>
                <th className="table-header-cell text-right">Surplus Actual</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {summaries.map(summary => (
                <PeriodSummaryRow
                  key={summary.period.finperiodid}
                  summary={summary}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
  const groupedSummaries = useMemo(
    () => getGroupedPeriodSummaries(periodSummaries),
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
      setGenerateError(formatApiError(error, 'Unable to generate this budget cycle right now.'))
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
            title={!canGenerate ? 'Add at least one income type and one active expense item first' : 'Generate a new budget cycle'}
          >
            <PlusIcon className="w-4 h-4" /> New Budget Cycle
          </button>
        </div>
      </div>

      {!canGenerate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          New budget cycles require at least one income type and one active expense item. Finish the setup first, then come back here to generate budget cycles.
        </div>
      )}

      {periods.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No budget cycles yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This budget is ready to start using once you generate the first budget cycle.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to={`/budgets/${id}/setup`} className="btn-secondary">
              <Cog6ToothIcon className="w-4 h-4" /> Open Setup
            </Link>
            <button className="btn-primary" onClick={() => { setGenerateError(''); setShowGenerate(true) }} disabled={!canGenerate}>
              <PlusIcon className="w-4 h-4" /> Generate First Budget Cycle
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Budget Cycles</h2>
          <div className="space-y-4">
            <PeriodSummaryGroup title="Current" summaries={groupedSummaries.current} collapsible onDelete={setDeleteTarget} />
            <PeriodSummaryGroup title="Future" summaries={groupedSummaries.future} collapsed collapsible onDelete={setDeleteTarget} />
            <PeriodSummaryGroup
              title="Historical"
              summaries={groupedSummaries.historical}
              collapsed
              collapsible
              onDelete={setDeleteTarget}
            />
          </div>
        </div>
      )}

      {showGenerate && (
        <Modal title={`Generate Budget Cycle for ${budget.description || 'Untitled Budget'}`} onClose={() => setShowGenerate(false)}>
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
        <Modal title="Delete Future Budget Cycle" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete the future budget cycle from {format(parseISO(deleteTarget.period.startdate), 'dd MMM yyyy')} to {format(parseISO(deleteTarget.period.enddate), 'dd MMM yyyy')}?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only future budget cycles without recorded actuals can be deleted.
            </p>
            {removePeriod.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {formatApiError(removePeriod.error, 'Unable to delete this budget cycle right now.')}
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
                {removePeriod.isPending ? 'Deleting…' : 'Delete Budget Cycle'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
