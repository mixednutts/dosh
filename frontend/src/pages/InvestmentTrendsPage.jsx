import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { getBudgets, getPeriodsForBudget, getInvestmentTrends } from '../api/client'
import InvestmentTrendsChart from '../components/reports/InvestmentTrendsChart'
import Spinner from '../components/Spinner'

function FilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-dosh-400 bg-dosh-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-dosh-300 hover:bg-dosh-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-dosh-700 dark:hover:bg-slate-800'
      )}
    >
      {label}
    </button>
  )
}

function CustomCountInput({ value, onChange, prefix, suffix }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 dark:text-slate-400">{prefix}</span>
      <input
        type="number"
        min={1}
        value={value || ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val ? Number.parseInt(val, 10) : null)
        }}
        className="w-12 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-xs text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <span className="text-xs text-gray-500 dark:text-slate-400">{suffix}</span>
    </div>
  )
}

function RangeFilterSection({ title, options, selected, onSelect, customValue, onCustomChange, customPrefix, customSuffix }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{title}</span>
      <div className="flex flex-wrap items-center gap-2">
        {options.map(opt => (
          <FilterButton
            key={opt.key}
            label={opt.label}
            active={selected === opt.key}
            onClick={() => onSelect(opt.key)}
          />
        ))}
        {selected === 'custom' && (
          <CustomCountInput
            value={customValue}
            onChange={onCustomChange}
            prefix={customPrefix}
            suffix={customSuffix}
          />
        )}
      </div>
    </div>
  )
}

function applySlice(periods, filterType, customCount) {
  if (filterType === 'all') return periods
  const count = filterType === 'custom' ? (customCount || periods.length) : Number.parseInt(filterType, 10)
  const safeCount = Math.min(count, periods.length)
  if (safeCount <= 0) return []
  return periods.slice(-safeCount)
}

function applyForwardSlice(periods, filterType, customCount) {
  if (filterType === 'all') return periods
  const count = filterType === 'custom' ? (customCount || periods.length) : Number.parseInt(filterType, 10)
  const safeCount = Math.min(count, periods.length)
  if (safeCount <= 0) return []
  return periods.slice(0, safeCount)
}

export default function InvestmentTrendsPage() {
  const [searchParams] = useSearchParams()
  const budgetId = Number.parseInt(searchParams.get('budgetId') || '', 10) || null

  const [historicalFilter, setHistoricalFilter] = useState('12')
  const [historicalCustom, setHistoricalCustom] = useState(null)
  const [upcomingFilter, setUpcomingFilter] = useState('all')
  const [upcomingCustom, setUpcomingCustom] = useState(null)

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

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['investment-trends', budgetId],
    queryFn: () => getInvestmentTrends(budgetId),
    enabled: !!budgetId,
    staleTime: 60_000,
  })

  const currentBudget = budgets.find(b => b.budgetid === budgetId) || null
  const allTrendPeriods = trendsData?.periods || []

  const chartPeriods = useMemo(() => {
    const historical = allTrendPeriods.filter(p => p.cycle_stage !== 'PLANNED')
    const upcoming = allTrendPeriods.filter(p => p.cycle_stage === 'PLANNED')

    const historicalSlice = applySlice(historical, historicalFilter, historicalCustom)
    const upcomingSlice = applyForwardSlice(upcoming, upcomingFilter, upcomingCustom)

    return [...historicalSlice, ...upcomingSlice]
  }, [allTrendPeriods, historicalFilter, historicalCustom, upcomingFilter, upcomingCustom])

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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Investment Trends</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">No budgets available.</p>
        </div>
      )
    }
    return <Navigate to={`/reports/investment-trends?budgetId=${budgets[0].budgetid}`} replace />
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
        <span className="font-medium text-gray-900 dark:text-white">Investment Trends</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Investment Trends</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/85 lg:p-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RangeFilterSection
            title="Historical Range"
            options={[
              { key: 'all', label: 'All' },
              { key: '3', label: 'Last 3' },
              { key: '6', label: 'Last 6' },
              { key: '12', label: 'Last 12' },
              { key: 'custom', label: 'Last N' },
            ]}
            selected={historicalFilter}
            onSelect={setHistoricalFilter}
            customValue={historicalCustom}
            onCustomChange={setHistoricalCustom}
            customPrefix="Last"
            customSuffix="cycles"
          />
          <RangeFilterSection
            title="Upcoming"
            options={[
              { key: 'all', label: 'All' },
              { key: '3', label: 'Next 3' },
              { key: '6', label: 'Next 6' },
              { key: '12', label: 'Next 12' },
              { key: 'custom', label: 'Next N' },
            ]}
            selected={upcomingFilter}
            onSelect={setUpcomingFilter}
            customValue={upcomingCustom}
            onCustomChange={setUpcomingCustom}
            customPrefix="Next"
            customSuffix="cycles"
          />
        </div>

        {trendsLoading ? (
          <div className="flex min-h-[20rem] items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : chartPeriods.length === 0 ? (
          <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No periods to display</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Try adjusting the range filters.</p>
          </div>
        ) : (
          <InvestmentTrendsChart data={chartPeriods} />
        )}
      </div>
    </div>
  )
}
