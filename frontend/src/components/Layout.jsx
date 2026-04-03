import { Outlet, NavLink, Link, useMatch } from 'react-router-dom'
import {
  WalletIcon, Bars3Icon, XMarkIcon, MoonIcon, SunIcon,
  ChevronRightIcon, ChevronDownIcon, ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { useDarkMode } from '../hooks/useDarkMode'
import { getBudgets, getPeriodDetail, getPeriodsForBudget } from '../api/client'

function PeriodShortcutGroup({ title, periods, activePeriodId, onNav, emptyMessage = null, moreLabel = null, moreTo = null, moreMuted = false }) {
  if (periods.length === 0 && !emptyMessage) return null

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-400">{title}</span>
      {periods.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          {emptyMessage}
        </p>
      ) : (
        <>
          {periods.map(period => (
            <Link
              key={period.finperiodid}
              to={`/periods/${period.finperiodid}`}
              onClick={onNav}
              className={clsx(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs transition-colors',
                period.finperiodid === activePeriodId
                  ? 'border-dosh-400 bg-dosh-600 text-white'
                  : 'border-slate-800 bg-slate-950/50 text-slate-200 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span className="min-w-0 truncate">
                {format(parseISO(period.startdate), 'dd MMM')} - {format(parseISO(period.enddate), 'dd MMM')}
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ))}
          {moreLabel ? (
            moreMuted ? (
              <span className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                <span>More</span>
                <div className="flex items-center">
                  <ChevronRightIcon className="h-3 w-3 opacity-70" />
                  <ChevronRightIcon className="-ml-1 h-3 w-3" />
                </div>
              </span>
            ) : (
              <Link
                to={moreTo}
                onClick={onNav}
                className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-dosh-300 transition-colors hover:text-white"
              >
                <span>More</span>
                <div className="flex items-center">
                  <ChevronRightIcon className="h-3 w-3 opacity-70" />
                  <ChevronRightIcon className="-ml-1 h-3 w-3" />
                </div>
              </Link>
            )
          ) : null}
        </>
      )}
    </div>
  )
}

function BudgetList({ budgets, currentBudgetId, onNav }) {
  if (budgets.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-400">Budget List</span>
        <span className="text-[11px] text-dosh-500">{budgets.length}</span>
      </div>
      <div className="space-y-1.5">
        {budgets.map(budget => (
          <Link
            key={budget.budgetid}
            to={`/budgets/${budget.budgetid}`}
            onClick={onNav}
            className={clsx(
              'block rounded-xl border px-3 py-2 text-sm transition-colors',
              budget.budgetid === currentBudgetId
                ? 'border-dosh-400 bg-dosh-600 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
            )}
          >
            <span className="block truncate font-medium">{budget.description || 'Untitled'}</span>
            <span className={clsx('mt-0.5 block truncate text-xs', budget.budgetid === currentBudgetId ? 'text-dosh-100' : 'text-dosh-400')}>
              {budget.budgetowner} · {budget.budget_frequency}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CurrentBudgetPanel({ budget, activePeriodId, onNav }) {
  const periodsMatch = useMatch('/budgets/:budgetId')
  const viewingBudgetPeriods = periodsMatch?.params?.budgetId === String(budget.budgetid)

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budget.budgetid],
    queryFn: () => getPeriodsForBudget(budget.budgetid),
    staleTime: 60_000,
  })

  const now = new Date()
  const orderedPeriods = [...periods].sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))
  const currentPeriods = orderedPeriods.filter(period => {
    try {
      const start = parseISO(period.startdate)
      const end = parseISO(period.enddate)
      return start <= now && end >= now
    } catch {
      return false
    }
  })
  const allFuturePeriods = orderedPeriods.filter(period => {
    try {
      return parseISO(period.startdate) > now
    } catch {
      return false
    }
  })
  const futurePeriods = allFuturePeriods.slice(0, 2)
  const allHistoricalPeriods = orderedPeriods.filter(period => {
    try {
      return parseISO(period.enddate) < now
    } catch {
      return false
    }
  })
  const historicalPeriods = allHistoricalPeriods.slice(-4).reverse()
  const hasMoreFuturePeriods = allFuturePeriods.length > futurePeriods.length
  const hasMoreHistoricalPeriods = allHistoricalPeriods.length > historicalPeriods.length

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-400">Current Budget</span>
        <div>
          <p className="truncate text-sm font-semibold text-white">{budget.description || 'Untitled Budget'}</p>
          <p className="truncate text-xs text-dosh-300">{budget.budgetowner} · {budget.budget_frequency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Link
          to={`/budgets/${budget.budgetid}`}
          onClick={onNav}
          className={clsx(
            'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            periodsMatch ? 'border-dosh-400 bg-dosh-600 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
          )}
        >
          Periods
        </Link>
      </div>

      <div className="space-y-3 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-400">Period Shortcuts</span>
        </div>

        {periods.length === 0 ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              No periods yet. Finish setup, then generate your first period.
            </p>
            <Link
              to={`/budgets/${budget.budgetid}/setup`}
              onClick={onNav}
              className="inline-flex rounded-xl border border-dosh-700 px-3 py-2 text-xs font-medium text-dosh-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Open setup
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <PeriodShortcutGroup
              title="Current"
              periods={currentPeriods}
              activePeriodId={activePeriodId}
              onNav={onNav}
              emptyMessage="No active period right now."
            />
            <PeriodShortcutGroup
              title="Upcoming"
              periods={futurePeriods}
              activePeriodId={activePeriodId}
              onNav={onNav}
              moreLabel={hasMoreFuturePeriods ? 'more' : null}
              moreTo={hasMoreFuturePeriods ? `/budgets/${budget.budgetid}` : null}
              moreMuted={hasMoreFuturePeriods && viewingBudgetPeriods}
            />
            <PeriodShortcutGroup
              title="Recent"
              periods={historicalPeriods}
              activePeriodId={activePeriodId}
              onNav={onNav}
              moreLabel={hasMoreHistoricalPeriods ? 'more' : null}
              moreTo={hasMoreHistoricalPeriods ? `/budgets/${budget.budgetid}` : null}
              moreMuted={hasMoreHistoricalPeriods && viewingBudgetPeriods}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function LayoutNav({ budgets, currentBudgetId, activePeriodId, budgetsExpanded, setBudgetsExpanded, onBudgetOrPeriod, onNav }) {
  const currentBudget = budgets.find(budget => budget.budgetid === currentBudgetId)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span className="block px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-400">Workspace</span>
        <div className="flex items-center gap-2">
          <NavLink
            to="/budgets"
            onClick={onNav}
            end
            className={({ isActive }) =>
              clsx(
                'flex flex-1 items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors',
                (isActive || onBudgetOrPeriod)
                  ? 'border-dosh-400 bg-dosh-700 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <WalletIcon className="h-4 w-4 shrink-0" />
            Budgets
          </NavLink>
          <button
            onClick={() => setBudgetsExpanded(value => !value)}
            title={budgetsExpanded ? 'Hide budget list' : 'Show budget list'}
            className={clsx(
              'rounded-2xl border p-3 transition-colors',
              budgetsExpanded
                ? 'border-dosh-400 bg-dosh-700 text-white hover:bg-dosh-600'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
            )}
          >
            {budgetsExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {budgetsExpanded ? (
        <>
          <BudgetList
            budgets={budgets}
            currentBudgetId={currentBudgetId}
            onNav={onNav}
          />

          {currentBudget ? (
            <CurrentBudgetPanel
              budget={currentBudget}
              activePeriodId={activePeriodId}
              onNav={onNav}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const [budgetsExpanded, setBudgetsExpanded] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('dosh-sidebar-collapsed') === 'true'
  })

  const budgetMatch = useMatch('/budgets/:budgetId')
  const budgetSetupMatch = useMatch('/budgets/:budgetId/setup')
  const periodMatch = useMatch('/periods/:periodId')

  const activeBudgetId = budgetMatch
    ? parseInt(budgetMatch.params.budgetId, 10)
    : budgetSetupMatch
      ? parseInt(budgetSetupMatch.params.budgetId, 10)
      : null
  const activePeriodId = periodMatch ? parseInt(periodMatch.params.periodId, 10) : null

  const { data: periodData } = useQuery({
    queryKey: ['period', activePeriodId],
    queryFn: () => getPeriodDetail(activePeriodId),
    enabled: !!activePeriodId,
    staleTime: 60_000,
  })
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })

  const currentBudgetId = activeBudgetId ?? periodData?.period?.budgetid ?? null
  const onBudgetOrPeriod = !!(budgetMatch || budgetSetupMatch || periodMatch)

  useEffect(() => {
    if (!currentBudgetId) setBudgetsExpanded(true)
  }, [currentBudgetId])

  useEffect(() => {
    localStorage.setItem('dosh-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <div className="min-h-screen flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-950 text-white transition-all duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-56',
          'w-56 lg:static lg:flex lg:translate-x-0'
        )}
      >
        <div className={clsx('border-b border-slate-800 py-4', sidebarCollapsed ? 'px-3 lg:px-2' : 'px-5')}>
          <div className={clsx('flex items-center', sidebarCollapsed ? 'justify-center' : 'justify-between gap-3')}>
            <Link
              to="/budgets"
              onClick={() => setOpen(false)}
              className={clsx('flex min-w-0 items-center transition-colors hover:text-dosh-200', sidebarCollapsed ? 'justify-center' : 'gap-3')}
              title="Go to budgets"
            >
              <img src="/icon.svg" alt="Dosh" className="h-8 w-8 rounded-full" />
              {!sidebarCollapsed ? (
                <div className="min-w-0">
                  <span className="block text-2xl font-black tracking-tight text-white">Do$h</span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-dosh-300">
                    <span className="block">Personal</span>
                    <span className="block">Finance</span>
                    <span className="block">Management</span>
                  </span>
                </div>
              ) : null}
            </Link>
            {!sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                className="hidden shrink-0 rounded-md p-1.5 text-dosh-300 transition-colors hover:bg-slate-900 hover:text-white lg:inline-flex"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {sidebarCollapsed ? (
            <div className="mt-3 hidden justify-center lg:flex">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                className="rounded-md p-1.5 text-dosh-300 transition-colors hover:bg-slate-900 hover:text-white"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {sidebarCollapsed ? (
          <nav className="flex-1 overflow-y-auto px-2 py-4">
            <div className="space-y-2">
              <NavLink
                to="/budgets"
                onClick={() => setOpen(false)}
                end
                title="Budgets"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center justify-center rounded-2xl border px-3 py-3 transition-colors',
                    (isActive || onBudgetOrPeriod)
                      ? 'border-dosh-400 bg-dosh-700 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-dosh-700 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <WalletIcon className="h-5 w-5 shrink-0" />
              </NavLink>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand navigation"
                className="flex w-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-slate-300 transition-colors hover:border-dosh-700 hover:bg-slate-800 hover:text-white"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </nav>
        ) : (
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <LayoutNav
              budgets={budgets}
              currentBudgetId={currentBudgetId}
              activePeriodId={activePeriodId}
              budgetsExpanded={budgetsExpanded}
              setBudgetsExpanded={setBudgetsExpanded}
              onBudgetOrPeriod={onBudgetOrPeriod}
              onNav={() => setOpen(false)}
            />
          </nav>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          {!sidebarCollapsed ? <span className="text-xs text-dosh-400">Do$h v1.0</span> : <span className="w-4" />}
          <button
            onClick={() => setDark(value => !value)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-md p-1.5 text-dosh-300 transition-colors hover:bg-slate-900 hover:text-white"
          >
            {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 lg:hidden">
          <button onClick={() => setOpen(value => !value)} className="rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            {open ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
          </button>
          <img src="/icon.svg" alt="Dosh" className="h-6 w-6 rounded-full" />
          <span className="font-bold text-dosh-700 dark:text-dosh-400">Do$h</span>
          <button onClick={() => setDark(value => !value)} className="ml-auto rounded p-1 text-gray-500 dark:text-gray-400">
            {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
