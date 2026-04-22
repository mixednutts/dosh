import { Outlet, NavLink, Link, useMatch } from 'react-router-dom'
import PropTypes from 'prop-types'
import {
  WalletIcon, Bars3Icon, XMarkIcon, MoonIcon, SunIcon,
  ChevronRightIcon, ChevronDownIcon, ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { parseISO } from 'date-fns'
import Modal from './Modal'
import ReleaseNotesModal from './ReleaseNotesModal'
import Spinner from './Spinner'
import { LocalisationProvider, useLocalisation } from './LocalisationContext'
import { useDarkMode } from '../hooks/useDarkMode'
import { getAppInfo, getBudgets, getBudgetSetupAssessment, getPeriodDetail, getPeriodsForBudget, getReleaseNotes } from '../api/client'
import { getCycleStage } from '../utils/periodStage'

function displayVersion(version) {
  return `v${version || '0.6.11-alpha'}`
}

function PeriodShortcutGroup({ title, periods, activePeriodId, onNav, budgetId, emptyMessage = null, moreText = null, moreTo = null, moreSubtle = false }) {
  const { formatDateRange } = useLocalisation()

  if (periods.length === 0 && !emptyMessage) return null

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-600 dark:text-dosh-400">{title}</span>
      {periods.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 dark:border-slate-800 dark:bg-slate-950/85 dark:text-slate-300">
          {emptyMessage}
        </p>
      ) : (
        <>
          {periods.map(period => (
            <Link
              key={period.finperiodid}
              to={`/budgets/${budgetId}/periods/${period.finperiodid}`}
              onClick={onNav}
              className={clsx(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs transition-colors',
                period.finperiodid === activePeriodId
                  ? 'border-dosh-400 bg-dosh-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-dosh-400 hover:bg-dosh-50 hover:text-dosh-900 dark:border-slate-800 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:border-dosh-700 dark:hover:bg-slate-900 dark:hover:text-white'
              )}
            >
              <span className="min-w-0 truncate">
                {formatDateRange(period.startdate, period.enddate)}
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ))}
          {moreText ? (
            <Link
              to={moreTo}
              onClick={onNav}
              className={clsx(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                moreSubtle
                  ? 'border-dosh-200 bg-dosh-50 text-dosh-800 hover:border-dosh-400 hover:bg-dosh-100 dark:border-dosh-900/70 dark:bg-dosh-950/55 dark:text-dosh-200 dark:hover:border-dosh-700 dark:hover:bg-dosh-900/60'
                  : 'border-dosh-300 bg-dosh-100 text-dosh-900 hover:border-dosh-500 hover:bg-dosh-200 dark:border-dosh-800 dark:bg-dosh-950/65 dark:text-dosh-100 dark:hover:border-dosh-600 dark:hover:bg-dosh-900/70'
              )}
              title={moreText}
            >
              <span>{moreText}</span>
              <div className="flex items-center">
                <ChevronRightIcon className="h-3.5 w-3.5 opacity-70" />
                <ChevronRightIcon className="-ml-1 h-3.5 w-3.5" />
              </div>
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}

function BudgetList({ budgets, currentBudgetId, onNav }) {
  if (budgets.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-dosh-200 bg-dosh-50/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:border-dosh-700/75 dark:bg-slate-950 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dosh-700 dark:text-dosh-300">Budget List</span>
        <span className="text-[11px] text-dosh-600 dark:text-dosh-400">{budgets.length}</span>
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
                : 'border-gray-200 bg-white text-gray-700 hover:border-dosh-400 hover:bg-dosh-50 hover:text-dosh-900 dark:border-slate-800 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:border-dosh-700 dark:hover:bg-slate-900 dark:hover:text-white'
            )}
          >
            <span className="block font-medium break-words">{budget.description || 'Untitled'}</span>
            <span className={clsx('mt-0.5 block text-xs', budget.budgetid === currentBudgetId ? 'text-dosh-100' : 'text-dosh-600 dark:text-dosh-400')}>
              {budget.budgetowner} · {budget.budget_frequency}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CompactCurrentBudgetContext({ budget, activePeriodId, onNav }) {
  const initials = (budget.description || budget.budgetowner || 'Budget')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')

  return (
    <div className="mt-3 hidden flex-col items-center gap-2 lg:flex">
      <Link
        to={`/budgets/${budget.budgetid}`}
        onClick={onNav}
        title={`Current budget: ${budget.description || 'Untitled Budget'}`}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400 bg-cyan-600 text-xs font-bold text-white transition-colors hover:bg-cyan-500"
      >
        {initials || 'B'}
      </Link>
      {activePeriodId ? (
        <Link
          to={`/budgets/${budget.budgetid}/periods/${activePeriodId}`}
          onClick={onNav}
          title="Open current budget cycle context"
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-800 bg-cyan-950/40 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:border-cyan-500 hover:bg-cyan-900/40 hover:text-white"
        >
          Cy
        </Link>
      ) : null}
    </div>
  )
}

function CurrentBudgetPanel({ budget, activePeriodId, onNav, shortcutsExpanded = true }) {
  const periodsMatch = useMatch('/budgets/:budgetId')
  const setupMatch = useMatch('/budgets/:budgetId/setup')
  const viewingBudgetPeriods = periodsMatch?.params?.budgetId === String(budget.budgetid)
  const viewingBudgetSetup = setupMatch?.params?.budgetId === String(budget.budgetid)
  const viewingBudgetContext = viewingBudgetPeriods || viewingBudgetSetup

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budget.budgetid],
    queryFn: () => getPeriodsForBudget(budget.budgetid),
    staleTime: 60_000,
  })
  const { data: setupAssessment } = useQuery({
    queryKey: ['budget-setup-assessment', budget.budgetid],
    queryFn: () => getBudgetSetupAssessment(budget.budgetid),
    staleTime: 60_000,
  })

  const orderedPeriods = [...periods].sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))
  const currentPeriods = orderedPeriods.filter(period => getCycleStage(period) === 'CURRENT')
  const allFuturePeriods = orderedPeriods.filter(period => getCycleStage(period) === 'PLANNED')
  const futurePeriods = allFuturePeriods.slice(0, 2)
  const pendingClosurePeriods = orderedPeriods.filter(period => getCycleStage(period) === 'PENDING_CLOSURE')
  const visiblePendingClosurePeriods = pendingClosurePeriods.slice(0, 2)
  const allHistoricalPeriods = orderedPeriods.filter(period => getCycleStage(period) === 'CLOSED')
  const historicalPeriods = allHistoricalPeriods.slice(-4).reverse()
  const hasMoreFuturePeriods = allFuturePeriods.length > futurePeriods.length
  const hasMorePendingClosurePeriods = pendingClosurePeriods.length > visiblePendingClosurePeriods.length
  const hasMoreHistoricalPeriods = allHistoricalPeriods.length > historicalPeriods.length
  const hiddenFutureCount = Math.max(0, allFuturePeriods.length - futurePeriods.length)
  const hiddenPendingClosureCount = Math.max(0, pendingClosurePeriods.length - visiblePendingClosurePeriods.length)
  const hiddenHistoricalCount = Math.max(0, allHistoricalPeriods.length - historicalPeriods.length)
  const needsSetupAttention = setupAssessment ? !setupAssessment.can_generate : false

  return (
    <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-cyan-700/75 dark:bg-slate-950 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Current Budget</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Link
          to={`/budgets/${budget.budgetid}`}
          onClick={onNav}
          className={clsx(
            'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            viewingBudgetPeriods
              ? 'border-cyan-300 bg-cyan-600 text-white'
              : 'border-cyan-200 bg-white text-cyan-900 hover:border-cyan-400 hover:bg-cyan-100 hover:text-cyan-950 dark:border-cyan-700/75 dark:bg-cyan-950/20 dark:text-cyan-100 dark:hover:border-cyan-400 dark:hover:bg-cyan-900/35 dark:hover:text-white'
          )}
        >
          Budget Cycles
        </Link>
        {needsSetupAttention && !viewingBudgetPeriods ? (
          <Link
            to={`/budgets/${budget.budgetid}/setup`}
            onClick={onNav}
            className={clsx(
              'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              viewingBudgetSetup
                ? 'border-cyan-300 bg-cyan-600 text-white'
                : 'border-cyan-200 bg-white text-cyan-900 hover:border-cyan-400 hover:bg-cyan-100 hover:text-cyan-950 dark:border-cyan-700/75 dark:bg-cyan-950/20 dark:text-cyan-100 dark:hover:border-cyan-400 dark:hover:bg-cyan-900/35 dark:hover:text-white'
            )}
          >
            Setup
          </Link>
        ) : null}
      </div>

      {shortcutsExpanded ? (
        <div className="space-y-3 border-t border-cyan-200 pt-3 dark:border-cyan-800/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Budget Cycle Shortcuts</span>
          </div>

          {periods.length === 0 ? (
            <div className="space-y-2">
              <p className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {needsSetupAttention
                  ? 'No budget cycles yet. Finish setup, then generate your first budget cycle.'
                  : 'No budget cycles yet. Open Budget Cycles to generate your first budget cycle.'}
              </p>
              {needsSetupAttention ? (
                <Link
                  to={`/budgets/${budget.budgetid}/setup`}
                  onClick={onNav}
                  className="inline-flex rounded-xl border border-dosh-700 px-3 py-2 text-xs font-medium text-dosh-200 transition-colors hover:bg-slate-900 hover:text-white"
                >
                  Open setup
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <PeriodShortcutGroup
                title="Current"
                budgetId={budget.budgetid} periods={currentPeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
                emptyMessage="No current budget cycle right now."
              />
              <PeriodShortcutGroup
                title="Upcoming"
                budgetId={budget.budgetid}
                periods={futurePeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
                moreText={hasMoreFuturePeriods ? `View all ${allFuturePeriods.length} upcoming cycles (${hiddenFutureCount} more)` : null}
                moreTo={hasMoreFuturePeriods ? `/budgets/${budget.budgetid}#upcoming` : null}
                moreSubtle={hasMoreFuturePeriods && viewingBudgetContext}
              />
              <PeriodShortcutGroup
                title="Pending Closure"
                budgetId={budget.budgetid} periods={visiblePendingClosurePeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
                moreText={hasMorePendingClosurePeriods ? `View all ${pendingClosurePeriods.length} pending closure cycles (${hiddenPendingClosureCount} more)` : null}
                moreTo={hasMorePendingClosurePeriods ? `/budgets/${budget.budgetid}#pending-closure` : null}
                moreSubtle={hasMorePendingClosurePeriods && viewingBudgetContext}
              />
              <PeriodShortcutGroup
                title="Historic"
                budgetId={budget.budgetid}
                periods={historicalPeriods}
                activePeriodId={activePeriodId}
                onNav={onNav}
                moreText={hasMoreHistoricalPeriods ? `View all ${allHistoricalPeriods.length} historic cycles (${hiddenHistoricalCount} more)` : null}
                moreTo={hasMoreHistoricalPeriods ? `/budgets/${budget.budgetid}#historical` : null}
                moreSubtle={hasMoreHistoricalPeriods && viewingBudgetContext}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function LayoutNav({ budgets, currentBudgetId, activePeriodId, budgetsExpanded, setBudgetsExpanded, onBudgetOrPeriod, onNav }) {
  const currentBudget = budgets.find(budget => budget.budgetid === currentBudgetId)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span className="block px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">Workspace</span>
        <div className="flex items-center gap-2">
          <NavLink
            to="/budgets"
            onClick={onNav}
            end
            className={({ isActive }) =>
              clsx(
                'flex flex-1 items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors',
                (isActive || onBudgetOrPeriod)
                  ? 'border-dosh-300 bg-dosh-600 text-white'
                  : 'border-dosh-200 bg-dosh-50 text-dosh-900 hover:border-dosh-400 hover:bg-dosh-100 hover:text-dosh-950 dark:border-dosh-700/75 dark:bg-dosh-950/55 dark:text-dosh-100 dark:hover:border-dosh-500 dark:hover:bg-dosh-900/70 dark:hover:text-white'
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
                ? 'border-dosh-300 bg-dosh-600 text-white hover:bg-dosh-500'
                : 'border-dosh-200 bg-dosh-50 text-dosh-700 hover:border-dosh-400 hover:bg-dosh-100 hover:text-dosh-950 dark:border-dosh-700/75 dark:bg-dosh-950/55 dark:text-dosh-200 dark:hover:border-dosh-500 dark:hover:bg-dosh-900/70 dark:hover:text-white'
            )}
          >
            {budgetsExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {budgetsExpanded ? (
        <BudgetList
          budgets={budgets}
          currentBudgetId={currentBudgetId}
          onNav={onNav}
        />
      ) : null}

      {budgetsExpanded && currentBudget ? (
        <CurrentBudgetPanel
          budget={currentBudget}
          activePeriodId={activePeriodId}
          onNav={onNav}
          shortcutsExpanded={budgetsExpanded}
        />
      ) : null}
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const [budgetsExpanded, setBudgetsExpanded] = useState(true)
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('dosh-sidebar-collapsed') === 'true'
  })

  const budgetMatch = useMatch('/budgets/:budgetId')
  const budgetSetupMatch = useMatch('/budgets/:budgetId/setup')
  const periodMatch = useMatch('/budgets/:budgetId/periods/:periodId')

  let activeBudgetId = null
  if (budgetMatch) {
    activeBudgetId = Number.parseInt(budgetMatch.params.budgetId, 10)
  } else if (budgetSetupMatch) {
    activeBudgetId = Number.parseInt(budgetSetupMatch.params.budgetId, 10)
  } else if (periodMatch) {
    activeBudgetId = Number.parseInt(periodMatch.params.budgetId, 10)
  }
  const activePeriodId = periodMatch ? Number.parseInt(periodMatch.params.periodId, 10) : null

  const { data: periodData } = useQuery({
    queryKey: ['period', activePeriodId],
    queryFn: () => getPeriodDetail(activeBudgetId, activePeriodId),
    enabled: !!activePeriodId,
    staleTime: 60_000,
  })
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })
  const { data: appInfo } = useQuery({
    queryKey: ['app-info'],
    queryFn: getAppInfo,
    staleTime: 300_000,
  })
  const { data: releaseNotes, isLoading: releaseNotesLoading, isError: releaseNotesError } = useQuery({
    queryKey: ['release-notes'],
    queryFn: getReleaseNotes,
    staleTime: 300_000,
    enabled: releaseNotesOpen,
  })

  const currentBudgetId = activeBudgetId ?? periodData?.period?.budgetid ?? null
  const currentBudget = budgets.find(budget => budget.budgetid === currentBudgetId) ?? null
  const onBudgetOrPeriod = !!(budgetMatch || budgetSetupMatch || periodMatch)
  const versionLabel = displayVersion(appInfo?.version)
  const updateAvailable = releaseNotes?.update_available ?? false

  useEffect(() => {
    if (!currentBudgetId) setBudgetsExpanded(true)
  }, [currentBudgetId])

  useEffect(() => {
    localStorage.setItem('dosh-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <LocalisationProvider budget={currentBudget}>
    <div className="min-h-screen flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-gray-200 bg-white text-gray-900 transition-all duration-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white',
          open ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-56',
          'w-56 lg:static lg:flex lg:translate-x-0'
        )}
      >
        <div className={clsx('border-b border-gray-200 py-4 dark:border-slate-800', sidebarCollapsed ? 'px-3 lg:px-2' : 'px-5')}>
          <div className={clsx('flex items-start', sidebarCollapsed ? 'justify-center' : 'justify-between gap-3')}>
            <Link
              to="/budgets"
              onClick={() => setOpen(false)}
              className={clsx('flex min-w-0 items-center transition-colors hover:text-dosh-700 dark:hover:text-dosh-200', sidebarCollapsed ? 'justify-center' : 'gap-3')}
              title="Go to budgets"
            >
              <img src="/icon.svg" alt="Dosh" className="h-8 w-8 rounded-full" />
              {!sidebarCollapsed ? (
                <div className="min-w-0">
                  <span className="block text-2xl font-black tracking-tight text-gray-900 dark:text-white">Do$h</span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-dosh-700 dark:text-dosh-300">
                    <span className="block">Personal</span>
                    <span className="block">Finance</span>
                    <span className="block">Management</span>
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      setReleaseNotesOpen(true)
                    }}
                    className="mt-1.5 inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.16em] text-dosh-600 transition-colors hover:text-dosh-800 dark:text-dosh-400 dark:hover:text-dosh-200"
                  >
                    <span>{versionLabel}</span>
                    {updateAvailable ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.18em] text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        update
                      </span>
                    ) : null}
                  </button>
                </div>
              ) : null}
            </Link>
            {!sidebarCollapsed ? (
              <div className="hidden flex-col items-end gap-1 lg:flex">
                <button
                  onClick={() => setDark(value => !value)}
                  title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="rounded-md p-1.5 text-dosh-700 transition-colors hover:bg-dosh-100 hover:text-dosh-900 dark:text-dosh-300 dark:hover:bg-slate-950 dark:hover:text-white"
                >
                  {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  className="shrink-0 rounded-md p-1.5 text-dosh-700 transition-colors hover:bg-dosh-100 hover:text-dosh-900 dark:text-dosh-300 dark:hover:bg-slate-950 dark:hover:text-white"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          {sidebarCollapsed ? (
            <div className="mt-3 hidden flex-col items-center gap-2 lg:flex">
              <button
                onClick={() => setDark(value => !value)}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-md p-1.5 text-dosh-700 transition-colors hover:bg-dosh-100 hover:text-dosh-900 dark:text-dosh-300 dark:hover:bg-slate-950 dark:hover:text-white"
              >
                {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setReleaseNotesOpen(true)}
                className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.18em] text-dosh-600 transition-colors hover:text-dosh-800 dark:text-dosh-400 dark:hover:text-dosh-200"
              >
                <span>{versionLabel}</span>
                {updateAvailable ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                className="rounded-md p-1.5 text-dosh-700 transition-colors hover:bg-dosh-100 hover:text-dosh-900 dark:text-dosh-300 dark:hover:bg-slate-950 dark:hover:text-white"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              {currentBudget ? (
                <CompactCurrentBudgetContext
                  budget={currentBudget}
                  activePeriodId={activePeriodId}
                  onNav={() => setOpen(false)}
                />
              ) : null}
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
                      : 'border-dosh-200 bg-dosh-50 text-dosh-800 hover:border-dosh-400 hover:bg-dosh-100 hover:text-dosh-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-dosh-700 dark:hover:bg-slate-900 dark:hover:text-white'
                  )
                }
              >
                <WalletIcon className="h-5 w-5 shrink-0" />
              </NavLink>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand navigation"
                className="flex w-full items-center justify-center rounded-2xl border border-dosh-200 bg-dosh-50 px-3 py-3 text-dosh-700 transition-colors hover:border-dosh-400 hover:bg-dosh-100 hover:text-dosh-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-dosh-700 dark:hover:bg-slate-900 dark:hover:text-white"
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

      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
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
      {releaseNotesOpen ? (
        releaseNotesLoading ? (
          <Modal title="Release Notes" onClose={() => setReleaseNotesOpen(false)} size="md">
            <div className="flex min-h-[12rem] items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          </Modal>
        ) : releaseNotesError || !releaseNotes ? (
          <Modal title="Release Notes" onClose={() => setReleaseNotesOpen(false)} size="md">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Release notes could not be loaded right now.
            </p>
          </Modal>
        ) : (
          <ReleaseNotesModal releaseNotes={releaseNotes} onClose={() => setReleaseNotesOpen(false)} />
        )
      ) : null}
    </div>
    </LocalisationProvider>
  )
}

PeriodShortcutGroup.propTypes = {
  title: PropTypes.string.isRequired,
  periods: PropTypes.arrayOf(PropTypes.object).isRequired,
  activePeriodId: PropTypes.number,
  onNav: PropTypes.func.isRequired,
  emptyMessage: PropTypes.node,
  moreText: PropTypes.string,
  moreTo: PropTypes.string,
  moreSubtle: PropTypes.bool,
}

BudgetList.propTypes = {
  budgets: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentBudgetId: PropTypes.number,
  onNav: PropTypes.func.isRequired,
}

CompactCurrentBudgetContext.propTypes = {
  budget: PropTypes.object.isRequired,
  activePeriodId: PropTypes.number,
  onNav: PropTypes.func.isRequired,
}

CurrentBudgetPanel.propTypes = {
  budget: PropTypes.object.isRequired,
  activePeriodId: PropTypes.number,
  onNav: PropTypes.func.isRequired,
  shortcutsExpanded: PropTypes.bool,
}

LayoutNav.propTypes = {
  budgets: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentBudgetId: PropTypes.number,
  activePeriodId: PropTypes.number,
  budgetsExpanded: PropTypes.bool.isRequired,
  setBudgetsExpanded: PropTypes.func.isRequired,
  onBudgetOrPeriod: PropTypes.bool.isRequired,
  onNav: PropTypes.func.isRequired,
}
