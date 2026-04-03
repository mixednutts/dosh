import { useMemo, useState } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { differenceInCalendarDays, format, isWithinInterval, parseISO } from 'date-fns'
import { getBudgets, createBudget, deleteBudget, getPeriodsForBudget, getBudgetHealth } from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly']

const emptyForm = { description: '', budgetowner: '', budget_frequency: 'Fortnightly' }

function healthDotClass(status) {
  if (status === 'Strong') return 'bg-dosh-500'
  if (status === 'Watch') return 'bg-amber-400'
  return 'bg-red-500'
}

function healthToneClass(status) {
  if (status === 'Strong') return 'text-dosh-700 dark:text-dosh-300'
  if (status === 'Watch') return 'text-amber-700 dark:text-amber-300'
  return 'text-red-700 dark:text-red-300'
}

function healthCircleClass(status) {
  if (status === 'Strong') return 'bg-dosh-500 text-white'
  if (status === 'Watch') return 'bg-amber-400 text-white'
  return 'bg-red-500 text-white'
}

function momentumToneClass(status) {
  if (status === 'Improving') return 'text-dosh-600 dark:text-dosh-400'
  if (status === 'Declining') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function MomentumIcon({ status }) {
  if (status === 'Improving') return <ArrowTrendingUpIcon className="h-4 w-4" />
  if (status === 'Declining') return <ArrowTrendingDownIcon className="h-4 w-4" />
  return <MinusIcon className="h-4 w-4" />
}

function formatMomentumDelta(value) {
  if (!value) return '0'
  return value > 0 ? `+${value}` : `${value}`
}

function healthStatusLabel(status) {
  if (status === 'Strong') return 'Tracking ok'
  if (status === 'Watch') return 'Check now'
  return 'Action needed'
}

function groupPeriods(periods) {
  const now = new Date()
  const ordered = [...periods].sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))

  const current = ordered.filter(period => {
    try {
      return isWithinInterval(now, { start: parseISO(period.startdate), end: parseISO(period.enddate) })
    } catch {
      return false
    }
  })
  const future = ordered.filter(period => {
    try {
      return parseISO(period.startdate) > now
    } catch {
      return false
    }
  })
  const historical = ordered.filter(period => {
    try {
      return parseISO(period.enddate) < now
    } catch {
      return false
    }
  })

  return { current, future, historical }
}

function formatPeriodRange(period) {
  return `${format(parseISO(period.startdate), 'dd MMM yy')} - ${format(parseISO(period.enddate), 'dd MMM yy')}`
}

function TrafficLight({ status }) {
  const lights = [
    { key: 'Strong', label: 'Green' },
    { key: 'Watch', label: 'Amber' },
    { key: 'Needs Attention', label: 'Red' },
  ]

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        {lights.map(light => (
          <span
            key={light.key}
            title={light.label}
            className={`h-3.5 w-3.5 rounded-full border ${
              status === light.key
                ? `${healthDotClass(light.key)} border-transparent shadow-sm`
                : 'border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${healthToneClass(status)}`}>
        {healthStatusLabel(status)}
      </span>
    </div>
  )
}

function BudgetStats({ periods = [], health, onOpenHealth, onOpenCurrentPeriodCheck }) {
  const grouped = useMemo(() => groupPeriods(periods), [periods])
  const currentPeriod = grouped.current[0] ?? null
  const daysRemaining = currentPeriod
    ? Math.max(0, differenceInCalendarDays(parseISO(currentPeriod.enddate), new Date()) + 1)
    : null

  const stats = [
    {
      label: 'Current Period',
      value: currentPeriod ? formatPeriodRange(currentPeriod) : 'No active period',
      detail: currentPeriod ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining` : 'Generate a period to begin tracking',
    },
    {
      label: 'Future',
      value: grouped.future.length,
      detail: grouped.future.length === 1 ? 'planned period' : 'planned periods',
    },
    {
      label: 'Historical',
      value: grouped.historical.length,
      detail: grouped.historical.length === 1 ? 'completed period' : 'completed periods',
    },
  ]

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Period</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{stats[0].value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stats[0].detail}</p>
            {currentPeriod ? (
              <Link
                to={`/periods/${currentPeriod.finperiodid}`}
                className="mt-2 inline-block text-xs font-medium text-dosh-700 hover:underline dark:text-dosh-400"
              >
                Open current period
              </Link>
            ) : null}
          </div>
          {health?.current_period_check ? (
            <button type="button" className="btn-secondary" onClick={onOpenCurrentPeriodCheck}>
              Details
            </button>
          ) : null}
        </div>
        {health?.current_period_check ? (
          <div className="mt-3 space-y-2">
            <TrafficLight status={health.current_period_check.status} />
            <p className={`text-sm font-medium ${healthToneClass(health.current_period_check.status)}`}>
              {health.current_period_check.summary}
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="h-10 w-36 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        )}
      </div>
      {stats.slice(1).map(stat => (
        <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{stat.value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{stat.detail}</p>
        </div>
      ))}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Health</p>
        {health ? (
          <>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${healthCircleClass(health.overall_status)}`}>
                  <span className="text-3xl font-light tracking-tight">{health.overall_score}</span>
                </div>
                <div className={`
                  absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full
                  border-2 border-white text-xs font-semibold shadow-sm dark:border-gray-800
                  ${healthCircleClass(health.overall_status)}
                `}>
                  <div className="flex flex-col items-center leading-none">
                    <MomentumIcon status={health.momentum_status} />
                    <span className="mt-0.5 text-[10px]">{formatMomentumDelta(health.momentum_delta)}</span>
                  </div>
                </div>
              </div>
              <button type="button" className="btn-secondary" onClick={onOpenHealth} disabled={!health}>
                Details
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{health.momentum_summary}</p>
          </>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        )}
      </div>
    </div>
  )
}

function CurrentPeriodCheckModal({ budget, assessment, evaluatedAt, onClose }) {
  return (
    <Modal title={`Current Period Check — ${budget.description || 'Untitled Budget'}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900 dark:bg-none">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <TrafficLight status={assessment.status} />
              <p className={`text-sm font-semibold ${healthToneClass(assessment.status)}`}>{assessment.summary}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Evaluated {format(parseISO(evaluatedAt), 'dd MMM yyyy HH:mm')} local time
              </p>
            </div>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-light shadow-sm ${healthCircleClass(assessment.status)}`}>
              {assessment.score}
            </div>
          </div>
        </div>

        <section className="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{assessment.title}</h3>
            <span className={`h-3.5 w-3.5 rounded-full ${healthDotClass(assessment.status)}`} />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Score {assessment.score}</span>
          </div>
          <div className="space-y-2">
            {assessment.evidence.map(item => (
              <div key={`${assessment.key}-${item.label}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/80">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
                </div>
                {item.detail ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}

function BudgetHealthModal({ budget, health, onClose }) {
  return (
    <Modal title={`Budget Health — ${budget.description || 'Untitled Budget'}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-dosh-50 to-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900 dark:bg-none">
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${healthCircleClass(health.overall_status)}`}>
                <span className="text-3xl font-light tracking-tight">{health.overall_score}</span>
              </div>
              <div className={`
                absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full
                border-2 border-white text-xs font-semibold shadow-sm dark:border-gray-800
                ${healthCircleClass(health.overall_status)}
              `}>
                <div className="flex flex-col items-center leading-none">
                  <MomentumIcon status={health.momentum_status} />
                  <span className="mt-0.5 text-[10px]">{formatMomentumDelta(health.momentum_delta)}</span>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{health.overall_summary}</p>
              <p className={`mt-1 flex items-center gap-1 text-sm ${momentumToneClass(health.momentum_status)}`}>
                <MomentumIcon status={health.momentum_status} />
                <span>{health.momentum_summary}</span>
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Evaluated {format(parseISO(health.evaluated_at), 'dd MMM yyyy HH:mm')} local time
              </p>
            </div>
          </div>
        </div>

        {health.pillars.map(pillar => (
          <section key={pillar.key} className="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pillar.title}</h3>
              <span className={`h-3.5 w-3.5 rounded-full ${healthDotClass(pillar.status)}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Score {pillar.score}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{pillar.summary}</p>
            <div className="space-y-2">
              {pillar.evidence.map(item => (
                <div key={`${pillar.key}-${item.label}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
                  </div>
                  {item.detail && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}

function BudgetForm({ initial = emptyForm, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Household Budget 2025" />
      </div>
      <div>
        <label className="label">Owner <span className="text-red-500">*</span></label>
        <input required className="input" value={form.budgetowner} onChange={e => set('budgetowner', e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label className="label">Frequency <span className="text-red-500">*</span></label>
        <select required className="input" value={form.budget_frequency} onChange={e => set('budget_frequency', e.target.value)}>
          {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function BudgetsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [healthModal, setHealthModal] = useState(null)
  const [currentCheckModal, setCurrentCheckModal] = useState(null)

  const { data: budgets = [], isLoading } = useQuery({ queryKey: ['budgets'], queryFn: getBudgets })
  const periodQueries = useQueries({
    queries: budgets.map(budget => ({
      queryKey: ['periods', budget.budgetid],
      queryFn: () => getPeriodsForBudget(budget.budgetid),
      staleTime: 60_000,
    })),
  })
  const healthQueries = useQueries({
    queries: budgets.map(budget => ({
      queryKey: ['budget-health', budget.budgetid],
      queryFn: () => getBudgetHealth(budget.budgetid),
      staleTime: 60_000,
    })),
  })

  const create = useMutation({
    mutationFn: createBudget,
    onSuccess: (newBudget) => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      navigate(`/budgets/${newBudget.budgetid}/setup`)
    },
  })

  const remove = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const handleSubmit = form => {
    create.mutate(form)
  }

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budgets</h1>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <PlusIcon className="w-4 h-4" /> New Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <p className="mb-3">No budgets yet. Create one to get started.</p>
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon className="w-4 h-4" /> Create Budget
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {budgets.map((b, index) => (
            <div key={b.budgetid} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/budgets/${b.budgetid}`} className="font-medium text-dosh-700 dark:text-dosh-400 hover:underline">
                    {b.description || 'Untitled'}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{b.budgetowner} · {b.budget_frequency}</p>
                  <Link to={`/budgets/${b.budgetid}/setup`} className="mt-1 inline-block text-xs text-gray-500 hover:text-dosh-700 dark:text-gray-400 dark:hover:text-dosh-400">
                    Open setup
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => navigate(`/budgets/${b.budgetid}/setup`)}>
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn-danger" onClick={() => { if (window.confirm(`Delete "${b.description}"?`)) remove.mutate(b.budgetid) }}>
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {periodQueries[index]?.isLoading ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="mt-2 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="mt-2 h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
              ) : (
                <BudgetStats
                  periods={periodQueries[index]?.data ?? []}
                  health={healthQueries[index]?.data ?? null}
                  onOpenHealth={() => healthQueries[index]?.data && setHealthModal({ budget: b, health: healthQueries[index].data })}
                  onOpenCurrentPeriodCheck={() => healthQueries[index]?.data && setCurrentCheckModal({
                    budget: b,
                    assessment: healthQueries[index].data.current_period_check,
                    evaluatedAt: healthQueries[index].data.evaluated_at,
                  })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="New Budget" onClose={() => setModal(null)}>
          <BudgetForm
            initial={emptyForm}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            loading={create.isPending}
          />
        </Modal>
      )}

      {healthModal && (
        <BudgetHealthModal
          budget={healthModal.budget}
          health={healthModal.health}
          onClose={() => setHealthModal(null)}
        />
      )}

      {currentCheckModal && (
        <CurrentPeriodCheckModal
          budget={currentCheckModal.budget}
          assessment={currentCheckModal.assessment}
          evaluatedAt={currentCheckModal.evaluatedAt}
          onClose={() => setCurrentCheckModal(null)}
        />
      )}
    </div>
  )
}
