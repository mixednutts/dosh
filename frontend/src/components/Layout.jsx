import { Outlet, NavLink, Link, useMatch } from 'react-router-dom'
import {
  HomeIcon, WalletIcon, Bars3Icon, XMarkIcon, MoonIcon, SunIcon,
  ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useDarkMode } from '../hooks/useDarkMode'
import { getBudgets, getPeriodDetail, getPeriodsForBudget } from '../api/client'
import { format, parseISO } from 'date-fns'

function PeriodGroup({ title, periods, activePeriodId, onNav }) {
  if (periods.length === 0) return null

  return (
    <div className="space-y-0.5">
      <span className="block px-2 py-1 text-[11px] uppercase tracking-wide text-dosh-400">{title}</span>
      {periods.map(period => (
        <Link
          key={period.finperiodid}
          to={`/periods/${period.finperiodid}`}
          onClick={onNav}
          className={clsx(
            'flex items-center gap-1 truncate rounded px-2 py-1 text-xs transition-colors',
            period.finperiodid === activePeriodId
              ? 'bg-dosh-600 font-semibold text-white'
              : 'text-dosh-300 hover:bg-dosh-800 hover:text-white'
          )}
        >
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
          {format(parseISO(period.startdate), 'dd MMM')} - {format(parseISO(period.enddate), 'dd MMM')}
        </Link>
      ))}
    </div>
  )
}

function BudgetPeriodsNav({ budgetId, activePeriodId, defaultOpen, onNav }) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budgetId],
    queryFn: () => getPeriodsForBudget(budgetId),
    staleTime: 60_000,
  })

  const now = new Date()
  const orderedPeriods = [...periods].sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))
  const currentPeriods = orderedPeriods.filter(period => {
    try {
      return parseISO(period.enddate) >= now
    } catch {
      return false
    }
  })
  const historicalPeriods = orderedPeriods.filter(period => {
    try {
      return parseISO(period.enddate) < now
    } catch {
      return false
    }
  })
  const limitedHistoricalPeriods = historicalPeriods.slice(-10)

  return (
    <div className="ml-3 mt-0.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] uppercase tracking-wide text-dosh-400 transition-colors hover:bg-dosh-800 hover:text-white"
      >
        {open ? <ChevronDownIcon className="h-3 w-3 shrink-0" /> : <ChevronRightIcon className="h-3 w-3 shrink-0" />}
        Periods
      </button>
      {open && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-dosh-700 pl-2">
          {periods.length === 0 ? (
            <span className="block px-2 py-1 text-xs text-dosh-400">No periods yet</span>
          ) : (
            <>
              <PeriodGroup
                title="Current"
                periods={currentPeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
              />
              <PeriodGroup
                title="Historical"
                periods={limitedHistoricalPeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BudgetsDrilldown({ onNav }) {
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

  const currentBudgetId = activeBudgetId ?? periodData?.period?.budgetid ?? null

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })

  if (budgets.length === 0) return null

  return (
    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-dosh-700 pl-2">
      {budgets.map(b => {
        const isActive = b.budgetid === currentBudgetId
        return (
          <div key={b.budgetid}>
            <Link
              to={`/budgets/${b.budgetid}`}
              onClick={onNav}
              className={clsx(
                'flex items-center gap-1 truncate rounded px-2 py-1 text-xs transition-colors',
                isActive && !activePeriodId
                  ? 'bg-dosh-600 font-semibold text-white'
                  : 'text-dosh-300 hover:bg-dosh-800 hover:text-white'
              )}
            >
              {b.description || 'Untitled'}
            </Link>
            <BudgetPeriodsNav
              budgetId={b.budgetid}
              activePeriodId={activePeriodId}
              defaultOpen={isActive}
              onNav={onNav}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const [budgetsExpanded, setBudgetsExpanded] = useState(false)

  const budgetMatch = useMatch('/budgets/:budgetId')
  const budgetSetupMatch = useMatch('/budgets/:budgetId/setup')
  const periodMatch = useMatch('/periods/:periodId')
  const onBudgetOrPeriod = !!(budgetMatch || budgetSetupMatch || periodMatch)

  useEffect(() => {
    if (onBudgetOrPeriod) setBudgetsExpanded(true)
  }, [onBudgetOrPeriod])

  return (
    <div className="min-h-screen flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-dosh-900 text-white transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:flex lg:translate-x-0'
        )}
      >
        <Link
          to="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 border-b border-dosh-800 px-5 py-4 transition-colors hover:bg-dosh-800"
        >
          <img src="/icon.svg" alt="Dosh" className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <span className="block text-2xl font-black tracking-tight text-white">Dosh</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-dosh-300">
              <span className="block">Personal</span>
              <span className="block">Finance</span>
              <span className="block">Management</span>
            </span>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLink
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-dosh-700 text-white' : 'text-dosh-200 hover:bg-dosh-800 hover:text-white'
              )
            }
          >
            <HomeIcon className="h-4 w-4 shrink-0" />
            Dashboard
          </NavLink>

          <div>
            <div className="flex items-center">
              <NavLink
                to="/budgets"
                onClick={() => setOpen(false)}
                end
                className={({ isActive }) =>
                  clsx(
                    'flex flex-1 items-center gap-2.5 rounded-l-md px-3 py-2 text-sm font-medium transition-colors',
                    (isActive || onBudgetOrPeriod) ? 'bg-dosh-700 text-white' : 'text-dosh-200 hover:bg-dosh-800 hover:text-white'
                  )
                }
              >
                <WalletIcon className="h-4 w-4 shrink-0" />
                Budgets
              </NavLink>
              <button
                onClick={() => setBudgetsExpanded(v => !v)}
                title={budgetsExpanded ? 'Collapse budgets' : 'Expand budgets'}
                className={clsx(
                  'rounded-r-md p-2 text-xs transition-colors',
                  onBudgetOrPeriod ? 'bg-dosh-700 text-white hover:bg-dosh-600' : 'text-dosh-300 hover:bg-dosh-800 hover:text-white'
                )}
              >
                {budgetsExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
              </button>
            </div>

            {budgetsExpanded && <BudgetsDrilldown onNav={() => setOpen(false)} />}
          </div>
        </nav>

        <div className="flex items-center justify-between border-t border-dosh-800 px-4 py-3">
          <span className="text-xs text-dosh-400">Dosh v1.0</span>
          <button
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-md p-1.5 text-dosh-300 transition-colors hover:bg-dosh-800 hover:text-white"
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
          <button onClick={() => setOpen(v => !v)} className="rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            {open ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
          </button>
          <img src="/icon.svg" alt="Dosh" className="h-6 w-6 rounded-full" />
          <span className="font-bold text-dosh-700 dark:text-dosh-400">Dosh</span>
          <button onClick={() => setDark(d => !d)} className="ml-auto rounded p-1 text-gray-500 dark:text-gray-400">
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
