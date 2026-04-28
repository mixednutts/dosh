import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Cog6ToothIcon, TrashIcon, ArrowUpIcon } from '@heroicons/react/24/outline'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { deleteBudget, deletePeriod, getBudget, getBudgetSetupAssessment, getPeriodDeleteOptions, getPeriodSummariesForBudget, generatePeriod } from '../api/client'
import clsx from 'clsx'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { useLocalisation } from '../components/LocalisationContext'
import { getCycleStage, getCycleStageLabel } from '../utils/periodStage'

const PERIOD_GROUP_SESSION_KEY_PREFIX = 'dosh-budget-periods-group-open'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

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

function PeriodSummaryMobileCard({ summary, onDelete }) {
  const { formatCurrency, formatDate, getToday } = useLocalisation()
  const { period } = summary
  const stage = getCycleStage(period)
  const daysUntilStart = stage === 'PLANNED' && period?.startdate
    ? Math.max(0, differenceInCalendarDays(parseISO(period.startdate), getToday()))
    : null
  const startLabel = formatDate(period.startdate)
  const endLabel = formatDate(period.enddate)

  let cycleBadgeClass = 'badge-green'
  if (stage === 'CURRENT') cycleBadgeClass = 'badge-blue'
  else if (stage === 'PENDING_CLOSURE') cycleBadgeClass = 'inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none text-center bg-slate-100 text-amber-700 dark:bg-slate-800 dark:text-amber-300'
  else if (stage === 'CLOSED') cycleBadgeClass = 'badge-gray'
  if (daysUntilStart !== null) cycleBadgeClass += ' cursor-help'

  const row = (label, budget, actual, budgetTone, actualTone) => (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-500 dark:text-gray-400">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">B</span>
          <span className={budgetTone}>{formatCurrency(budget)}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">A</span>
          <span className={actualTone}>{formatCurrency(actual)}</span>
        </span>
      </div>
    </div>
  )

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/budgets/${period.budgetid}/periods/${period.finperiodid}`}
          className="block font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug"
        >
          <span className="block">{startLabel} - {endLabel}</span>
        </Link>
        <div className="flex flex-wrap justify-end gap-1 flex-shrink-0">
          <span className={cycleBadgeClass} title={daysUntilStart !== null ? `Days until - ${daysUntilStart}` : undefined}>{getCycleStageLabel(stage)}</span>
          {period.islocked && <span className="badge-amber">Locked</span>}
        </div>
      </div>

      {row('Income', summary.income_budget, summary.income_actual, 'text-gray-600 dark:text-gray-400', 'text-success-700 dark:text-success-400')}
      {row('Expenses', summary.expense_budget, summary.expense_actual, 'text-gray-600 dark:text-gray-400',
        Number(summary.expense_actual) <= Number(summary.expense_budget) ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400')}
      {row('Investments', summary.investment_budget, summary.investment_actual, 'text-gray-600 dark:text-gray-400', 'text-success-700 dark:text-success-400')}

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-gray-500 dark:text-gray-400">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Proj. Inv.</span>
          <span className={Number(summary.projected_investment) >= 0 ? 'text-success-700 dark:text-success-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {formatCurrency(summary.projected_investment)}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Surplus (B)</span>
          <span className={Number(summary.surplus_budget) >= 0 ? 'text-success-600 dark:text-success-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {formatCurrency(summary.surplus_budget)}
          </span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Surplus (A)</span>
          <span className={Number(summary.surplus_actual) >= 0 ? 'text-success-600 dark:text-success-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {formatCurrency(summary.surplus_actual)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link to={`/budgets/${period.budgetid}/periods/${period.finperiodid}`} className="btn-primary text-xs flex-1 text-center justify-center">
          Details
        </Link>
        {summary.can_delete && (
          <button
            type="button"
            className="btn-danger min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 justify-center"
            onClick={() => onDelete(summary)}
            title="Delete budget cycle"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

PeriodSummaryMobileCard.propTypes = {
  summary: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
}

function PeriodGenerateForm({ initialStartDate, onSubmit, onClose, loading, error }) {
  const [startDate, setStartDate] = useState(initialStartDate)
  const [count, setCount] = useState(1)

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ startDate, count }) }} className="space-y-4">
      <div>
        <label htmlFor="generate-period-start-date" className="label">Start Date</label>
        <input
          id="generate-period-start-date"
          required
          type="date"
          className="input"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="generate-period-count" className="label">How Many Budget Cycles</label>
        <input
          id="generate-period-count"
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
        <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-800/30 dark:bg-red-950/10 dark:text-red-300">
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
  const ordered = periodSummaries.toSorted((a, b) => parseISO(a.period.startdate) - parseISO(b.period.startdate))

  return {
    pendingClosure: ordered.filter(({ period }) => getCycleStage(period) === 'PENDING_CLOSURE'),
    current: ordered.filter(({ period }) => getCycleStage(period) === 'CURRENT'),
    upcoming: ordered.filter(({ period }) => getCycleStage(period) === 'PLANNED'),
    historical: ordered.filter(({ period }) => getCycleStage(period) === 'CLOSED'),
  }
}

function PeriodSummaryRow({ summary, onDelete }) {
  const { formatCurrency, formatDate, getToday } = useLocalisation()
  const { period } = summary
  const stage = getCycleStage(period)
  const daysUntilStart = stage === 'PLANNED' && period?.startdate
    ? Math.max(0, differenceInCalendarDays(parseISO(period.startdate), getToday()))
    : null
  const surplusBudgetTone = Number(summary.surplus_budget) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const surplusActualTone = Number(summary.surplus_actual) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const projectedInvestmentTone = Number(summary.projected_investment) >= 0 ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const startLabel = formatDate(period.startdate)
  const endLabel = formatDate(period.enddate)
  let cycleBadgeClass = 'badge-green'
  if (stage === 'CURRENT') {
    cycleBadgeClass = 'badge-blue'
  } else if (stage === 'PENDING_CLOSURE') {
    cycleBadgeClass = 'inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none text-center bg-slate-100 text-amber-700 dark:bg-slate-800 dark:text-amber-300'
  } else if (stage === 'CLOSED') {
    cycleBadgeClass = 'badge-gray'
  }
  if (daysUntilStart !== null) cycleBadgeClass += ' cursor-help'

  return (
    <tr className="table-row align-top">
      <td className="table-cell">
        <Link
          to={`/budgets/${period.budgetid}/periods/${period.finperiodid}`}
          className="block font-medium leading-snug text-gray-900 transition-colors hover:text-dosh-700 dark:text-gray-100 dark:hover:text-dosh-300"
          title="View budget cycle details"
        >
          <span className="block whitespace-nowrap">{startLabel} -</span>
          <span className="block whitespace-nowrap">{endLabel}</span>
        </Link>
        <div className="mt-1">
          <span className={clsx('mr-1.5', cycleBadgeClass)} title={daysUntilStart !== null ? `Days until - ${daysUntilStart}` : undefined}>
            {getCycleStageLabel(stage)}
          </span>
          {period.islocked && <span className="badge-amber">Locked</span>}
        </div>
      </td>
      <td className="table-cell-muted text-right col-budget">{formatCurrency(summary.income_budget)}</td>
      <td className="table-cell text-right col-actual text-success-700 dark:text-success-400">{formatCurrency(summary.income_actual)}</td>
      <td className="table-cell-muted text-right col-budget">{formatCurrency(summary.expense_budget)}</td>
      <td className={`table-cell text-right col-actual ${Number(summary.expense_actual) <= Number(summary.expense_budget) ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(summary.expense_actual)}</td>
      <td className="table-cell-muted text-right col-budget">{formatCurrency(summary.investment_budget)}</td>
      <td className="table-cell text-right col-actual text-success-700 dark:text-success-400">{formatCurrency(summary.investment_actual)}</td>
      <td className={clsx('table-cell text-right font-semibold', projectedInvestmentTone)}>{formatCurrency(summary.projected_investment)}</td>
      <td className={clsx('table-cell text-right font-semibold', surplusBudgetTone)}>{formatCurrency(summary.surplus_budget)}</td>
      <td className={clsx('table-cell text-right font-semibold', surplusActualTone)}>{formatCurrency(summary.surplus_actual)}</td>
      <td className="table-cell">
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/budgets/${period.budgetid}/periods/${period.finperiodid}`} className="btn-primary">
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

function PeriodSummaryGroup({ title, summaries, collapsed = false, collapsible = false, onDelete, sessionStorageKey, groupId, forceOpen = false }) {
  const [open, setOpen] = useState(() => {
    if (!collapsible || !sessionStorageKey || typeof globalThis === 'undefined') {
      return !collapsed
    }

    const storedValue = globalThis.sessionStorage.getItem(`${PERIOD_GROUP_SESSION_KEY_PREFIX}:${sessionStorageKey}`)

    if (storedValue === null) {
      return !collapsed
    }

    return storedValue === 'true'
  })

  useEffect(() => {
    if (!forceOpen) return

    setOpen(true)

    if (collapsible && sessionStorageKey && typeof globalThis !== 'undefined') {
      globalThis.sessionStorage.setItem(`${PERIOD_GROUP_SESSION_KEY_PREFIX}:${sessionStorageKey}`, 'true')
    }
  }, [forceOpen, collapsible, sessionStorageKey])

  if (summaries.length === 0) return null

  const handleToggle = () => {
    if (!collapsible) return

    setOpen(current => {
      const nextOpen = !current

      if (sessionStorageKey && typeof globalThis !== 'undefined') {
        globalThis.sessionStorage.setItem(`${PERIOD_GROUP_SESSION_KEY_PREFIX}:${sessionStorageKey}`, String(nextOpen))
      }

      return nextOpen
    })
  }

  let toggleTitle
  if (collapsible) {
    toggleTitle = open
      ? `Collapse ${title.toLowerCase()} budget cycles`
      : `Expand ${title.toLowerCase()} budget cycles`
  }

  let toggleIcon = <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-60" />
  if (collapsible) {
    toggleIcon = open
      ? <ChevronDownIcon className="h-4 w-4 shrink-0" />
      : <ChevronRightIcon className="h-4 w-4 shrink-0" />
  }

  return (
    <section id={groupId} className="card scroll-mt-6">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70">
        <button
          type="button"
          className="flex items-center gap-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
          onClick={handleToggle}
          title={toggleTitle}
        >
          {toggleIcon}
          <span>{title}</span>
        </button>
      </div>

      {open && (
        <>
          <div className="hidden md:block overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[1020px] text-sm">
              {PERIOD_SUMMARY_COLGROUP}
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header-cell text-left"></th>
                  <th className="table-header-cell text-center" colSpan="2">Income</th>
                  <th className="table-header-cell text-center" colSpan="2">Expenses</th>
                  <th className="table-header-cell text-center" colSpan="3">Investments</th>
                  <th className="table-header-cell text-center" colSpan="2">Tracking</th>
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
                  <th className="table-header-cell text-right">Projected Investment</th>
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
          {process.env.NODE_ENV !== 'test' && (
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {summaries.map(summary => (
                <PeriodSummaryMobileCard
                  key={summary.period.finperiodid}
                  summary={summary}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default function BudgetPeriodsPage() {
  const { budgetId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const id = Number.parseInt(budgetId, 10)
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteMode, setDeleteMode] = useState('single')
  const [showReturnTop, setShowReturnTop] = useState(false)

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => getBudget(id),
  })
  const { data: periodSummaries = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['period-summaries', id],
    queryFn: () => getPeriodSummariesForBudget(id),
    enabled: !!budget,
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', id],
    queryFn: () => getBudgetSetupAssessment(id),
    enabled: !!budget,
  })

  useEffect(() => {
    const handleScroll = () => setShowReturnTop(globalThis.scrollY > 420)
    handleScroll()
    globalThis.addEventListener('scroll', handleScroll, { passive: true })
    return () => globalThis.removeEventListener('scroll', handleScroll)
  }, [])

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
    const latest = periods.toSorted((a, b) => parseISO(b.enddate) - parseISO(a.enddate))[0]
    return toDateInputValue(addDays(parseISO(latest.enddate), 1))
  }, [periods])

  const canGenerate = setupAssessment?.can_generate ?? false
  const missingSetupMessage = setupAssessment?.blocking_issues?.length
    ? setupAssessment.blocking_issues.join(' ')
    : 'Finish the setup first, then come back here to generate budget cycles.'
  const generateButtonTitle = canGenerate
    ? 'Generate a new budget cycle'
    : (setupAssessment?.blocking_issues?.[0] || 'Finish the setup first')
  const emptyStateMessage = canGenerate
    ? 'This budget is ready to start using once you generate the first budget cycle.'
    : 'Complete the setup steps first, then come back here to generate the first budget cycle.'

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
    mutationFn: ({ periodId, mode }) => deletePeriod(id, periodId, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods', id] })
      qc.invalidateQueries({ queryKey: ['period-summaries', id] })
      setDeleteTarget(null)
      setDeleteMode('single')
    },
  })

  const removeBudget = useMutation({
    mutationFn: () => deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      navigate('/budgets')
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
            title={generateButtonTitle}
          >
            <PlusIcon className="w-4 h-4" /> New Budget Cycle
          </button>
        </div>
      </div>

      {!canGenerate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          {missingSetupMessage}
        </div>
      )}

      {periods.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No budget cycles yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{emptyStateMessage}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to={`/budgets/${id}/setup`} className="btn-secondary">
              <Cog6ToothIcon className="w-4 h-4" /> Open Setup
            </Link>
            <button className="btn-primary" onClick={() => { setGenerateError(''); setShowGenerate(true) }} disabled={!canGenerate}>
              <PlusIcon className="w-4 h-4" /> Generate First Budget Cycle
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (globalThis.confirm('Delete this budget? This removes the budget and its setup.')) {
                  removeBudget.mutate()
                }
              }}
              disabled={removeBudget.isPending}
            >
              <TrashIcon className="w-4 h-4" /> {removeBudget.isPending ? 'Deleting…' : 'Delete Budget'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Budget Cycles</h2>
          <div className="space-y-4">
            <PeriodSummaryGroup
              key={`current-${id}`}
              title="Current"
              summaries={groupedSummaries.current}
              collapsible
              sessionStorageKey={`budget-${id}-current`}
              groupId="current"
              forceOpen={location.hash === '#current'}
              onDelete={summary => { setDeleteMode(summary.delete_mode || 'single'); setDeleteTarget(summary) }}
            />
            <PeriodSummaryGroup
              key={`upcoming-${id}`}
              title="Upcoming"
              summaries={groupedSummaries.upcoming}
              collapsed
              collapsible
              sessionStorageKey={`budget-${id}-upcoming`}
              groupId="upcoming"
              forceOpen={location.hash === '#upcoming'}
              onDelete={summary => { setDeleteMode(summary.delete_mode || 'single'); setDeleteTarget(summary) }}
            />
            <PeriodSummaryGroup
              key={`pending-closure-${id}`}
              title="Pending Closure"
              summaries={groupedSummaries.pendingClosure}
              collapsible
              sessionStorageKey={`budget-${id}-pending-closure`}
              groupId="pending-closure"
              forceOpen={location.hash === '#pending-closure'}
              onDelete={summary => { setDeleteMode(summary.delete_mode || 'single'); setDeleteTarget(summary) }}
            />
            <PeriodSummaryGroup
              key={`historical-${id}`}
              title="Historic"
              summaries={groupedSummaries.historical}
              collapsed
              collapsible
              sessionStorageKey={`budget-${id}-historical`}
              groupId="historical"
              forceOpen={location.hash === '#historical'}
              onDelete={summary => { setDeleteMode(summary.delete_mode || 'single'); setDeleteTarget(summary) }}
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
        <DeleteCycleModal
          deleteTarget={deleteTarget}
          deleteMode={deleteMode}
          setDeleteMode={setDeleteMode}
          removePeriod={removePeriod}
          onClose={() => setDeleteTarget(null)}
        />
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

function DeleteCycleModal({ deleteTarget, deleteMode, setDeleteMode, removePeriod, onClose }) {
  const { formatDateRange } = useLocalisation()
  const { data: deleteOptions } = useQuery({
    queryKey: ['period-delete-options', deleteTarget.period.finperiodid],
    queryFn: () => getPeriodDeleteOptions(deleteTarget.period.budgetid, deleteTarget.period.finperiodid),
  })
  const canDeleteSingle = !!deleteOptions?.can_delete_single
  const canDeleteFutureChain = !!deleteOptions?.can_delete_future_chain

  return (
    <Modal title="Delete Budget Cycle" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Delete the budget cycle from {formatDateRange(deleteTarget.period.startdate, deleteTarget.period.enddate)}?
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {deleteOptions?.delete_reason || 'Only cycles without actuals or transactions can be removed.'}
        </p>
        {deleteOptions?.can_delete_future_chain && deleteOptions.future_chain_count > 1 ? (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            {canDeleteSingle && (
              <label htmlFor="delete-cycle-single" className="flex items-center gap-2 text-sm cursor-pointer">
                <input id="delete-cycle-single" type="radio" checked={deleteMode === 'single'} onChange={() => setDeleteMode('single')} />
                <span>Delete only this budget cycle</span>
              </label>
            )}
            <label htmlFor="delete-cycle-future-chain" className="flex items-center gap-2 text-sm cursor-pointer">
              <input id="delete-cycle-future-chain" type="radio" checked={deleteMode === 'future_chain'} onChange={() => setDeleteMode('future_chain')} />
              <span>Delete this cycle and all upcoming cycles ({deleteOptions.future_chain_count})</span>
            </label>
          </div>
        ) : (canDeleteSingle || canDeleteFutureChain) ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">This budget cycle will be deleted.</p>
        ) : null}
        {removePeriod.isError && (
          <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-800/30 dark:bg-red-950/10 dark:text-red-300">
            {formatApiError(removePeriod.error, 'Unable to delete this budget cycle right now.')}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={removePeriod.isPending || !(canDeleteSingle || canDeleteFutureChain)}
            onClick={() => removePeriod.mutate({ periodId: deleteTarget.period.finperiodid, mode: deleteMode })}
          >
            {removePeriod.isPending ? 'Deleting…' : 'Delete Budget Cycle'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

PeriodGenerateForm.propTypes = {
  initialStartDate: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
}

PeriodSummaryRow.propTypes = {
  summary: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
}

PeriodSummaryGroup.propTypes = {
  title: PropTypes.string.isRequired,
  summaries: PropTypes.arrayOf(PropTypes.object).isRequired,
  collapsed: PropTypes.bool,
  collapsible: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
  sessionStorageKey: PropTypes.string,
  groupId: PropTypes.string.isRequired,
  forceOpen: PropTypes.bool,
}

DeleteCycleModal.propTypes = {
  deleteTarget: PropTypes.shape({
    period: PropTypes.shape({
      finperiodid: PropTypes.number.isRequired,
      startdate: PropTypes.string.isRequired,
      enddate: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  deleteMode: PropTypes.string.isRequired,
  setDeleteMode: PropTypes.func.isRequired,
  removePeriod: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool.isRequired,
    isError: PropTypes.bool.isRequired,
    error: PropTypes.any,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
}
