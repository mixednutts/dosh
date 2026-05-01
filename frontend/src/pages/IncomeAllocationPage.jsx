import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { getBudgets, getPeriodsForBudget, getIncomeAllocationTrends } from '../api/client'
import IncomeAllocationChart from '../components/reports/IncomeAllocationChart'
import CycleFilter from '../components/reports/CycleFilter'
import Spinner from '../components/Spinner'

function formatUTCDate(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function TogglePill({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
        checked
          ? 'border-dosh-400 bg-dosh-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-dosh-300 hover:bg-dosh-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-dosh-700 dark:hover:bg-slate-800'
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full', checked ? 'bg-white' : 'bg-gray-300 dark:bg-slate-600')} />
      {label}
    </button>
  )
}

export default function IncomeAllocationPage() {
  const [searchParams] = useSearchParams()
  const budgetId = Number.parseInt(searchParams.get('budgetId') || '', 10) || null
  const [showExpenses, setShowExpenses] = useState(true)
  const [showInvestments, setShowInvestments] = useState(true)
  const [showPercentages, setShowPercentages] = useState(false)
  const [includeCurrentPeriod, setIncludeCurrentPeriod] = useState(true)

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })

  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budgetId],
    queryFn: () => getPeriodsForBudget(budgetId),
    enabled: !!budgetId,
    staleTime: 60_000,
  })

  const [filterParams, setFilterParams] = useState({ fromDate: null, toDate: null })

  const nonPlannedPeriods = useMemo(() =>
    periods.filter(p => p.cycle_stage !== 'PLANNED'),
  [periods])

  const queryParams = useMemo(() => {
    const params = {}
    if (filterParams.fromDate) {
      params.from_date = formatUTCDate(filterParams.fromDate)
    }
    if (filterParams.toDate) {
      params.to_date = formatUTCDate(filterParams.toDate)
    }
    return params
  }, [filterParams])

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['income-allocation-trends', budgetId, queryParams],
    queryFn: () => getIncomeAllocationTrends(budgetId, queryParams),
    enabled: !!budgetId,
    staleTime: 60_000,
  })

  const currentBudget = budgets.find(b => b.budgetid === budgetId) || null
  const rawTrendPeriods = trendsData?.periods || []

  const trendPeriods = useMemo(() => {
    if (includeCurrentPeriod) return rawTrendPeriods
    return rawTrendPeriods.filter(p => p.cycle_stage !== 'CURRENT')
  }, [rawTrendPeriods, includeCurrentPeriod])

  if (!budgetId) {
    if (budgetsLoading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      )
    }
    if (budgets.length === 0) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Income Allocation</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">No budgets available.</p>
        </div>
      )
    }
    return <Navigate to={`/reports/income-allocation?budgetId=${budgets[0].budgetid}`} replace />
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/budgets" className="text-dosh-600 hover:underline dark:text-dosh-400">Budgets</Link>
        <span className="text-gray-400 dark:text-slate-600">/</span>
        <Link to={`/budgets/${budgetId}`} className="text-dosh-600 hover:underline dark:text-dosh-400">
          {currentBudget?.description || 'Budget'}
        </Link>
        <span className="text-gray-400 dark:text-slate-600">/</span>
        <Link to={`/reports/${budgetId}`} className="text-dosh-600 hover:underline dark:text-dosh-400">Reports</Link>
        <span className="text-gray-400 dark:text-slate-600">/</span>
        <span className="font-medium text-gray-900 dark:text-white">Income Allocation</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Income Allocation</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/85 lg:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Range</span>
            <CycleFilter
              budgetPeriods={nonPlannedPeriods}
              onChange={setFilterParams}
              defaultPreset="last12"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Filters</span>
            <div className="flex flex-wrap items-center gap-2">
              <TogglePill label="Expenses" checked={showExpenses} onChange={setShowExpenses} />
              <TogglePill label="Investments" checked={showInvestments} onChange={setShowInvestments} />
              <TogglePill label="Percentages" checked={showPercentages} onChange={setShowPercentages} />
              <TogglePill label="Current Cycle" checked={includeCurrentPeriod} onChange={setIncludeCurrentPeriod} />
            </div>
          </div>
        </div>

        {trendsLoading ? (
          <div className="flex min-h-[20rem] items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : trendPeriods.length === 0 ? (
          <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No periods in selected date range</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Try adjusting the filter to include more budget cycles.</p>
          </div>
        ) : (
          <IncomeAllocationChart
            data={trendPeriods}
            showExpenses={showExpenses}
            showInvestments={showInvestments}
            showPercentages={showPercentages}
          />
        )}
      </div>
    </div>
  )
}
