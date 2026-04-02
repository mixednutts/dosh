import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRightIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { addDays, format, isWithinInterval, parseISO } from 'date-fns'
import { getBudget, getExpenseItems, getIncomeTypes, getPeriodsForBudget, generatePeriod } from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

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

function PeriodCard({ period, status }) {
  return (
    <Link
      to={`/periods/${period.finperiodid}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-dosh-300 hover:bg-dosh-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-dosh-700 dark:hover:bg-dosh-900/10"
    >
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
          {status && <span className="badge-blue">{status}</span>}
          {period.islocked && <span className="badge-amber">Locked</span>}
        </div>
      </div>
      <p className="mt-3 text-sm text-dosh-700 dark:text-dosh-400">Open period details</p>
    </Link>
  )
}

export default function BudgetPeriodsPage() {
  const { budgetId } = useParams()
  const id = parseInt(budgetId, 10)
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => getBudget(id),
  })
  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['periods', id],
    queryFn: () => getPeriodsForBudget(id),
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

  const now = new Date()
  const currentPeriodId = useMemo(() => {
    const current = periods.find(period => {
      try {
        return isWithinInterval(now, {
          start: parseISO(period.startdate),
          end: parseISO(period.enddate),
        })
      } catch {
        return false
      }
    })
    return current?.finperiodid ?? null
  }, [now, periods])

  const nextPeriodId = useMemo(() => {
    const upcoming = [...periods]
      .filter(period => parseISO(period.startdate) > now)
      .sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))[0]
    return upcoming?.finperiodid ?? null
  }, [now, periods])

  const suggestedStartDate = useMemo(() => {
    if (periods.length === 0) return toDateInputValue(new Date())
    const latest = [...periods].sort((a, b) => parseISO(b.enddate) - parseISO(a.enddate))[0]
    return toDateInputValue(addDays(parseISO(latest.enddate), 1))
  }, [periods])

  const canGenerate = incomeTypes.length > 0 && activeExpenseItems.length > 0

  const createPeriod = useMutation({
    mutationFn: ({ startDate, count }) => generatePeriod({
      budgetid: id,
      startdate: new Date(`${startDate}T00:00:00`).toISOString(),
      count,
    }),
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ['periods', id] })
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
            {[...periods]
              .sort((a, b) => parseISO(b.startdate) - parseISO(a.startdate))
              .map(period => (
                <PeriodCard
                  key={period.finperiodid}
                  period={period}
                  status={period.finperiodid === currentPeriodId ? 'Current' : period.finperiodid === nextPeriodId ? 'Next' : null}
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
    </div>
  )
}
