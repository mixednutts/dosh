import { Outlet, NavLink, Link, useMatch } from 'react-router-dom'
import {
  HomeIcon, WalletIcon, Bars3Icon, XMarkIcon, MoonIcon, SunIcon,
  ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useDarkMode } from '../hooks/useDarkMode'
import { getBudgets, getPeriodDetail } from '../api/client'
import { format, parseISO } from 'date-fns'

function BudgetsDrilldown({ onNav }) {
  const budgetMatch  = useMatch('/budgets/:budgetId')
  const periodMatch  = useMatch('/periods/:periodId')

  const activeBudgetId = budgetMatch ? parseInt(budgetMatch.params.budgetId) : null
  const activePeriodId = periodMatch ? parseInt(periodMatch.params.periodId) : null

  // Fetch period to resolve its budgetId when we're on a period page
  const { data: periodData } = useQuery({
    queryKey: ['period', activePeriodId],
    queryFn: () => getPeriodDetail(activePeriodId),
    enabled: !!activePeriodId,
    staleTime: 60_000,
  })

  const currentBudgetId = activeBudgetId ?? periodData?.period?.budgetid ?? null

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => import('../api/client').then(m => m.getBudgets()),
    staleTime: 60_000,
  })

  if (budgets.length === 0) return null

  return (
    <div className="ml-3 mt-0.5 border-l border-dosh-700 pl-2 space-y-0.5">
      {budgets.map(b => {
        const isActive = b.budgetid === currentBudgetId
        return (
          <div key={b.budgetid}>
            <Link
              to={`/budgets/${b.budgetid}`}
              onClick={onNav}
              className={clsx(
                'flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors truncate',
                isActive && !activePeriodId
                  ? 'bg-dosh-600 text-white font-semibold'
                  : 'text-dosh-300 hover:text-white hover:bg-dosh-800'
              )}
            >
              {b.description || 'Untitled'}
            </Link>
            {isActive && activePeriodId && periodData?.period && (
              <div className="ml-3 mt-0.5 border-l border-dosh-700 pl-2">
                <Link
                  to={`/periods/${periodData.period.finperiodid}`}
                  onClick={onNav}
                  className="flex items-center gap-1 text-xs py-1 px-2 rounded bg-dosh-600 text-white font-semibold truncate"
                >
                  <ChevronRightIcon className="w-3 h-3 shrink-0" />
                  {format(parseISO(periodData.period.startdate), 'dd MMM')}–{format(parseISO(periodData.period.enddate), 'dd MMM')}
                </Link>
              </div>
            )}
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
  const periodMatch = useMatch('/periods/:periodId')
  const onBudgetOrPeriod = !!(budgetMatch || periodMatch)

  // Auto-expand when navigating into a budget or period
  useEffect(() => {
    if (onBudgetOrPeriod) setBudgetsExpanded(true)
  }, [onBudgetOrPeriod])

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-56 bg-dosh-900 text-white flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:flex'
        )}
      >
        <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-5 py-4 border-b border-dosh-800 hover:bg-dosh-800 transition-colors">
          <img src="/icon.svg" alt="Dosh" className="w-8 h-8 rounded-full" />
          <span className="text-2xl font-black tracking-tight text-white">Dosh</span>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive ? 'bg-dosh-700 text-white' : 'text-dosh-200 hover:bg-dosh-800 hover:text-white'
              )
            }
          >
            <HomeIcon className="w-4 h-4 shrink-0" />
            Dashboard
          </NavLink>

          {/* Budgets with expand toggle */}
          <div>
            <div className="flex items-center">
              <NavLink
                to="/budgets"
                onClick={() => setOpen(false)}
                end
                className={({ isActive }) =>
                  clsx(
                    'flex-1 flex items-center gap-2.5 px-3 py-2 rounded-l-md text-sm font-medium transition-colors',
                    (isActive || onBudgetOrPeriod) ? 'bg-dosh-700 text-white' : 'text-dosh-200 hover:bg-dosh-800 hover:text-white'
                  )
                }
              >
                <WalletIcon className="w-4 h-4 shrink-0" />
                Budgets
              </NavLink>
              <button
                onClick={() => setBudgetsExpanded(v => !v)}
                title={budgetsExpanded ? 'Collapse budgets' : 'Expand budgets'}
                className={clsx(
                  'p-2 rounded-r-md text-xs transition-colors',
                  onBudgetOrPeriod ? 'bg-dosh-700 text-white hover:bg-dosh-600' : 'text-dosh-300 hover:bg-dosh-800 hover:text-white'
                )}
              >
                {budgetsExpanded
                  ? <ChevronDownIcon className="w-3.5 h-3.5" />
                  : <ChevronRightIcon className="w-3.5 h-3.5" />}
              </button>
            </div>

            {budgetsExpanded && (
              <BudgetsDrilldown onNav={() => setOpen(false)} />
            )}
          </div>
        </nav>

        <div className="px-4 py-3 border-t border-dosh-800 flex items-center justify-between">
          <span className="text-xs text-dosh-400">Dosh v1.0</span>
          <button
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-md text-dosh-300 hover:text-white hover:bg-dosh-800 transition-colors"
          >
            {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <button onClick={() => setOpen(v => !v)} className="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            {open ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
          <img src="/icon.svg" alt="Dosh" className="w-6 h-6 rounded-full" />
          <span className="font-bold text-dosh-700 dark:text-dosh-400">Dosh</span>
          <button onClick={() => setDark(d => !d)} className="ml-auto p-1 rounded text-gray-500 dark:text-gray-400">
            {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
