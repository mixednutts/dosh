import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { getBudgets, getPeriodsForBudget, getBudgetVsActualTrends } from '../api/client'
import BudgetVsActualChart from '../components/reports/BudgetVsActualChart'
import CycleFilter from '../components/reports/CycleFilter'
import Spinner from '../components/Spinner'

export default function BudgetVsActualPage() {
  const [searchParams] = useSearchParams()
  const budgetId = Number.parseInt(searchParams.get('budgetId') || '', 10) || null
  const [showSurplus, setShowSurplus] = useState(true)

  const { data: budgets = [] } = useQuery({
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

  const queryParams = useMemo(() => {
    const params = {}
    if (filterParams.fromDate) {
      params.from_date = format(filterParams.fromDate, 'yyyy-MM-dd')
    }
    if (filterParams.toDate) {
      params.to_date = format(filterParams.toDate, 'yyyy-MM-dd')
    }
    params.include_surplus = showSurplus
    return params
  }, [filterParams, showSurplus])

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['budget-vs-actual-trends', budgetId, queryParams],
    queryFn: () => getBudgetVsActualTrends(budgetId, queryParams),
    enabled: !!budgetId,
    staleTime: 60_000,
  })

  const currentBudget = budgets.find(b => b.budgetid === budgetId) || null
  const trendPeriods = trendsData?.periods || []

  const handleBudgetChange = (event) => {
    const newId = event.target.value
    if (newId) {
      window.location.href = `/reports/budget-vs-actual?budgetId=${newId}`
    }
  }

  if (!budgetId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Budget vs Actual</h1>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/85">
          <p className="text-sm text-gray-600 dark:text-slate-300">Select a budget to view this report.</p>
          <div className="mt-4">
            <select
              onChange={handleBudgetChange}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              defaultValue=""
            >
              <option value="" disabled>Choose a budget...</option>
              {budgets.map(b => (
                <option key={b.budgetid} value={b.budgetid}>{b.description || 'Untitled'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
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
        <span className="font-medium text-gray-900 dark:text-white">Budget vs Actual</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Budget vs Actual</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Track how actuals compare to budget over time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={budgetId || ''}
              onChange={handleBudgetChange}
              className="appearance-none rounded-xl border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {budgets.map(b => (
                <option key={b.budgetid} value={b.budgetid}>{b.description || 'Untitled'}</option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/85 lg:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <CycleFilter
              budgetPeriods={periods}
              onChange={setFilterParams}
              defaultPreset="last12"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showSurplus}
              onChange={(e) => setShowSurplus(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-slate-700 dark:bg-slate-900"
            />
            Show surplus
          </label>
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
          <BudgetVsActualChart data={trendPeriods} showSurplus={showSurplus} />
        )}
      </div>
    </div>
  )
}
