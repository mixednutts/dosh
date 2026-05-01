import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { getBudgets, getBudgetReportSummary } from '../api/client'
import Spinner from '../components/Spinner'

const REPORT_CARDS = [
  {
    key: 'budget-vs-actual',
    title: 'Budget vs Actual',
    description: 'Compare budgeted and actual income, expenses, and investments over time.',
    icon: ChartBarIcon,
    to: (budgetId) => `/reports/budget-vs-actual?budgetId=${budgetId}`,
    enabled: true,
  },
  {
    key: 'income-allocation',
    title: 'Income Allocation',
    description: 'Visualise how income is distributed across categories.',
    icon: ArrowTrendingUpIcon,
    to: (budgetId) => `/reports/income-allocation?budgetId=${budgetId}`,
    enabled: true,
  },
  {
    key: 'investment-trends',
    title: 'Investment Trends',
    description: 'Track investment growth and contribution patterns over time.',
    icon: CurrencyDollarIcon,
    to: (budgetId) => `/reports/investment-trends?budgetId=${budgetId}`,
    enabled: true,
  },
]

function BudgetSelectorCard({ budget }) {
  return (
    <Link
      to={`/reports/${budget.budgetid}`}
      className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-dosh-400 hover:bg-dosh-50 dark:border-slate-800 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:border-dosh-700 dark:hover:bg-slate-900"
    >
      <span className="text-base font-semibold text-gray-900 dark:text-white">{budget.description || 'Untitled'}</span>
      <span className="text-sm text-gray-500 dark:text-slate-400">{budget.budgetowner} · {budget.budget_frequency}</span>
    </Link>
  )
}

function ReportCard({ card, budgetId }) {
  const Icon = card.icon
  const target = card.to(budgetId)

  if (!card.enabled) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-5 opacity-60 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 dark:bg-slate-800">
            <Icon className="h-5 w-5 text-gray-500 dark:text-slate-400" />
          </div>
          <div className="flex-1">
            <span className="block text-base font-semibold text-gray-900 dark:text-white">{card.title}</span>
          </div>
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">{card.description}</p>
      </div>
    )
  }

  return (
    <Link
      to={target}
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-dosh-400 hover:bg-dosh-50 dark:border-slate-800 dark:bg-slate-950/85 dark:hover:border-dosh-700 dark:hover:bg-slate-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dosh-100 dark:bg-dosh-950/55">
          <Icon className="h-5 w-5 text-dosh-700 dark:text-dosh-300" />
        </div>
        <div className="flex-1">
          <span className="block text-base font-semibold text-gray-900 dark:text-white">{card.title}</span>
        </div>
        <span className="rounded-full border border-dosh-200 bg-dosh-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dosh-700 dark:border-dosh-800 dark:bg-dosh-950/40 dark:text-dosh-300">
          Active
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400">{card.description}</p>
    </Link>
  )
}

export default function ReportsLandingPage() {
  const { budgetId } = useParams()
  const numericBudgetId = budgetId ? Number.parseInt(budgetId, 10) : null

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['report-summary', numericBudgetId],
    queryFn: () => getBudgetReportSummary(numericBudgetId),
    enabled: !!numericBudgetId,
    staleTime: 60_000,
  })

  const currentBudget = useMemo(
    () => budgets.find(b => b.budgetid === numericBudgetId) || null,
    [budgets, numericBudgetId]
  )

  if (budgetsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  // No budget selected — redirect to first available budget
  if (!numericBudgetId) {
    if (budgets.length === 0) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">No budgets available.</p>
        </div>
      )
    }
    return <Navigate to={`/reports/${budgets[0].budgetid}`} replace />
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/budgets" className="text-dosh-600 hover:underline dark:text-dosh-400">Budgets</Link>
        <span className="text-gray-400 dark:text-slate-600">/</span>
        <Link to={`/budgets/${numericBudgetId}`} className="text-dosh-600 hover:underline dark:text-dosh-400">
          {currentBudget?.description || 'Budget'}
        </Link>
        <span className="text-gray-400 dark:text-slate-600">/</span>
        <span className="font-medium text-gray-900 dark:text-white">Reports</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
        {summary ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {summary.period_count} budget cycle{summary.period_count !== 1 ? 's' : ''} available
            {summary.date_range ? ` · ${summary.date_range.start} to ${summary.date_range.end}` : ''}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map(card => (
          <ReportCard key={card.key} card={card} budgetId={numericBudgetId} />
        ))}
      </div>
    </div>
  )
}
