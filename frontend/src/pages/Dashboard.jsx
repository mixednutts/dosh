import { useQuery } from '@tanstack/react-query'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { getBudgets, getPeriodsForBudget, getPeriodDetail } from '../api/client'
import { parseISO } from 'date-fns'
import Spinner from '../components/Spinner'
import { useLocalisation } from '../components/LocalisationContext'
import { getCycleStage, getCycleStageLabel } from '../utils/periodStage'

function BudgetMobileCard({ budget }) {
  const { formatCurrency, formatDateRange, formatDate } = useLocalisation()
  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budget.budgetid],
    queryFn: () => getPeriodsForBudget(budget.budgetid),
  })

  const current = periods.find(p => getCycleStage(p) === 'CURRENT')
  const pendingClosure = periods.find(p => getCycleStage(p) === 'PENDING_CLOSURE')
  const period = current ?? pendingClosure

  if (periods.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
            {budget.description || 'Untitled'}
          </Link>
          <span className="badge-gray">{budget.budget_frequency}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          No budget cycles — <Link to={`/budgets/${budget.budgetid}/setup`} className="text-dosh-600 dark:text-dosh-400 hover:underline">set up budget</Link>
        </p>
      </div>
    )
  }

  if (!period) {
    const upcoming = [...periods].filter(p => getCycleStage(p) === 'PLANNED').sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))[0]
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
            {budget.description || 'Untitled'}
          </Link>
          <span className="badge-gray">{budget.budget_frequency}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          No current budget cycle
          {upcoming && <span className="ml-1 text-xs">Next: {formatDate(upcoming.startdate, 'medium')}</span>}
        </p>
      </div>
    )
  }

  return <PeriodMobileCard budget={budget} period={period} />
}

function PeriodMobileCard({ budget, period }) {
  const { formatCurrency, formatDateRange } = useLocalisation()
  const { data, isLoading } = useQuery({
    queryKey: ['period', period.finperiodid],
    queryFn: () => getPeriodDetail(budget.budgetid, period.finperiodid),
    staleTime: 60_000,
  })

  const stage = getCycleStage(period)

  const row = (label, val, tone) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium ${tone}`}>{isLoading ? '—' : formatCurrency(val)}</span>
    </div>
  )

  let incomeBudget = 0, incomeActual = 0, expenseBudget = 0, expenseActual = 0, surplusBudget = 0, surplusActual = 0
  if (data) {
    incomeBudget = data.incomes.reduce((s, i) => s + Number(i.budgetamount), 0)
    incomeActual = data.incomes.reduce((s, i) => s + Number(i.actualamount), 0)
    expenseBudget = data.expenses.reduce((s, e) => s + Number(e.status === 'Paid' ? e.actualamount : e.budgetamount), 0)
    expenseActual = data.expenses.reduce((s, e) => s + Number(e.actualamount), 0)
    const investmentBudget = data.investments.reduce((s, inv) => s + Number(inv.budgeted_amount ?? 0), 0)
    const investmentActual = data.investments.reduce((s, inv) => s + Number(inv.actualamount ?? 0), 0)
    const investmentLinkedAccounts = new Set(
      data.investments.map(inv => inv.linked_account_desc).filter(Boolean)
    )
    const directInvestmentIncomeBudget = data.incomes.reduce((s, i) => (
      investmentLinkedAccounts.has(i.linked_account) ? s + Number(i.budgetamount) : s
    ), 0)
    const directInvestmentIncomeActual = data.incomes.reduce((s, i) => (
      investmentLinkedAccounts.has(i.linked_account) ? s + Number(i.actualamount) : s
    ), 0)
    surplusBudget = incomeBudget - expenseBudget - investmentBudget - directInvestmentIncomeBudget
    surplusActual = incomeActual - expenseActual - investmentActual - directInvestmentIncomeActual
  }

  const expenseTone = expenseActual <= expenseBudget ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const surplusBTone = surplusBudget >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'
  const surplusATone = surplusActual >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
            {budget.description || 'Untitled'}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">{budget.budgetowner} · {budget.budget_frequency}</p>
        </div>
        <span className="badge-gray flex-shrink-0">{getCycleStageLabel(stage)}</span>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {formatDateRange(period.startdate, period.enddate, 'medium')}
        {period.islocked && <span className="ml-1 badge-amber">Locked</span>}
      </div>

      {isLoading ? (
        <div className="space-y-1 animate-pulse">
          {<div className="h-4 rounded bg-gray-100 dark:bg-gray-800" />}
          {<div className="h-4 rounded bg-gray-100 dark:bg-gray-800" />}
          {<div className="h-4 rounded bg-gray-100 dark:bg-gray-800" />}
        </div>
      ) : (
        <>
          {row('Income Budget', incomeBudget, 'text-gray-600 dark:text-gray-400')}
          {row('Income Actual', incomeActual, 'text-success-700 dark:text-success-400')}
          {row('Exp. Budget', expenseBudget, 'text-gray-600 dark:text-gray-400')}
          {row('Exp. Actual', expenseActual, expenseTone)}
          {row('Surplus (B)', surplusBudget, surplusBTone)}
          {row('Surplus (A)', surplusActual, surplusATone)}
        </>
      )}

      <div className="pt-1">
        <Link to={`/budgets/${budget.budgetid}/periods/${period.finperiodid}`} className="btn-primary text-xs w-full text-center justify-center">
          View Details
        </Link>
      </div>
    </div>
  )
}

BudgetMobileCard.propTypes = {
  budget: PropTypes.shape({
    budgetid: PropTypes.number.isRequired,
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }).isRequired,
}

PeriodMobileCard.propTypes = {
  budget: PropTypes.shape({
    budgetid: PropTypes.number.isRequired,
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }).isRequired,
  period: PropTypes.shape({
    finperiodid: PropTypes.number.isRequired,
    startdate: PropTypes.string.isRequired,
    enddate: PropTypes.string.isRequired,
    islocked: PropTypes.bool,
  }).isRequired,
}

export default function Dashboard() {
  const { formatDate } = useLocalisation()
  const { data: budgets = [], isLoading } = useQuery({ queryKey: ['budgets'], queryFn: getBudgets })

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(new Date(), 'long')}</p>
      </div>

      {budgets.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">No budgets yet</p>
          <Link to="/budgets" className="btn-primary">Go to Budgets</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="table-header-cell text-left">Budget</th>
                <th className="table-header-cell text-left">Frequency</th>
                <th className="table-header-cell text-left">Current Cycle</th>
                <th className="table-header-cell text-right col-budget">Inc Budget</th>
                <th className="table-header-cell text-right col-actual">Inc Actual</th>
                <th className="table-header-cell text-right col-budget">Exp Budget</th>
                <th className="table-header-cell text-right col-actual">Exp Actual</th>
                <th className="table-header-cell text-right">Surplus (B)</th>
                <th className="table-header-cell text-right">Surplus (A)</th>
                <th className="table-header-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {budgets.map(b => <BudgetTableRows key={b.budgetid} budget={b} />)}
            </tbody>
          </table>
          </div>
          {process.env.NODE_ENV !== 'test' && (
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {budgets.map(b => <BudgetMobileCard key={b.budgetid} budget={b} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Keep these for the desktop table
function PeriodRow({ budget, period }) {
  const { formatCurrency, formatDateRange } = useLocalisation()
  const { data } = useQuery({
    queryKey: ['period', period.finperiodid],
    queryFn: () => getPeriodDetail(budget.budgetid, period.finperiodid),
    staleTime: 60_000,
  })

  const loading = !data

  const incomeBudget  = data ? data.incomes.reduce((s, i) => s + Number(i.budgetamount), 0)  : null
  const incomeActual  = data ? data.incomes.reduce((s, i) => s + Number(i.actualamount), 0)  : null
  const effectiveExpenseBudget = data ? data.expenses.reduce((s, e) => s + Number(e.status === 'Paid' ? e.actualamount : e.budgetamount), 0) : null
  const expenseActual = data ? data.expenses.reduce((s, e) => s + Number(e.actualamount), 0) : null
  const investmentBudget = data ? data.investments.reduce((s, inv) => s + Number(inv.budgeted_amount ?? 0), 0) : null
  const investmentActual = data ? data.investments.reduce((s, inv) => s + Number(inv.actualamount ?? 0), 0) : null
  const investmentLinkedAccounts = data ? new Set(
    data.investments.map(inv => inv.linked_account_desc).filter(Boolean)
  ) : new Set()
  const directInvestmentIncomeBudget = data ? data.incomes.reduce((s, i) => (
    investmentLinkedAccounts.has(i.linked_account) ? s + Number(i.budgetamount) : s
  ), 0) : null
  const directInvestmentIncomeActual = data ? data.incomes.reduce((s, i) => (
    investmentLinkedAccounts.has(i.linked_account) ? s + Number(i.actualamount) : s
  ), 0) : null
  const surplusBudget = data ? incomeBudget - effectiveExpenseBudget - investmentBudget - directInvestmentIncomeBudget : null
  const surplusActual = data ? incomeActual - expenseActual - investmentActual - directInvestmentIncomeActual : null

  const cell = (val, cls = '') => loading
    ? <td className="table-cell text-right"><span className="inline-block w-16 h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" /></td>
    : <td className={`table-cell text-right font-medium ${cls}`}>{formatCurrency(val)}</td>

  return (
    <tr className="table-row">
      <td className="table-cell">
        <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
          {budget.description || 'Untitled'}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400">{budget.budgetowner}</p>
      </td>
      <td className="table-cell-muted">
        <span className="badge-gray">{budget.budget_frequency}</span>
      </td>
      <td className="table-cell">
        <div className="text-xs">
          <p className="text-gray-700 dark:text-gray-200">{formatDateRange(period.startdate, period.enddate, 'medium')}</p>
          <span className="badge-gray mt-0.5 mr-1">{getCycleStageLabel(getCycleStage(period))}</span>
          {period.islocked && <span className="badge-amber mt-0.5">Locked</span>}
        </div>
      </td>
      {cell(incomeBudget, 'text-gray-600 dark:text-gray-300')}
      {cell(incomeActual, 'text-success-700 dark:text-success-400')}
      {cell(effectiveExpenseBudget, 'text-gray-600 dark:text-gray-300')}
      {cell(expenseActual, expenseActual <= effectiveExpenseBudget ? 'text-success-700 dark:text-success-400' : 'text-red-600 dark:text-red-400')}
      <td className={`table-cell text-right font-bold ${!loading && surplusBudget >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
        {loading ? <span className="inline-block w-16 h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" /> : formatCurrency(surplusBudget)}
      </td>
      <td className={`table-cell text-right font-bold ${!loading && surplusActual >= 0 ? 'text-success-600 dark:text-success-400' : 'text-red-600 dark:text-red-400'}`}>
        {loading ? <span className="inline-block w-16 h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" /> : formatCurrency(surplusActual)}
      </td>
      <td className="table-cell text-right">
        <Link to={`/budgets/${budget.budgetid}/periods/${period.finperiodid}`} className="badge-blue cursor-pointer whitespace-nowrap">Details →</Link>
      </td>
    </tr>
  )
}

function BudgetTableRows({ budget }) {
  const { formatDate } = useLocalisation()
  const { data: periods = [] } = useQuery({
    queryKey: ['periods', budget.budgetid],
    queryFn: () => getPeriodsForBudget(budget.budgetid),
  })

  const current = periods.find(p => getCycleStage(p) === 'CURRENT')
  const pendingClosure = periods.find(p => getCycleStage(p) === 'PENDING_CLOSURE')

  if (periods.length === 0) {
    return (
      <tr className="table-row">
        <td className="table-cell">
          <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
            {budget.description || 'Untitled'}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">{budget.budgetowner}</p>
        </td>
        <td className="table-cell-muted"><span className="badge-gray">{budget.budget_frequency}</span></td>
        <td colSpan={7} className="table-cell-muted italic">No budget cycles — <Link to={`/budgets/${budget.budgetid}/setup`} className="text-dosh-600 dark:text-dosh-400 hover:underline">set up budget</Link></td>
      </tr>
    )
  }

  if (!current && !pendingClosure) {
    const upcoming = [...periods].filter(p => getCycleStage(p) === 'PLANNED').sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))[0]
    return (
      <tr className="table-row">
        <td className="table-cell">
          <Link to={`/budgets/${budget.budgetid}`} className="font-semibold text-dosh-700 dark:text-dosh-400 hover:underline">
            {budget.description || 'Untitled'}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">{budget.budgetowner}</p>
        </td>
        <td className="table-cell-muted"><span className="badge-gray">{budget.budget_frequency}</span></td>
        <td colSpan={7} className="table-cell-muted italic">
          No current budget cycle
          {upcoming && <span className="ml-2 text-xs text-gray-400">Next: {formatDate(upcoming.startdate, 'medium')}</span>}
        </td>
      </tr>
    )
  }

  return <PeriodRow budget={budget} period={current ?? pendingClosure} />
}

PeriodRow.propTypes = {
  budget: PropTypes.shape({
    budgetid: PropTypes.number.isRequired,
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }).isRequired,
  period: PropTypes.shape({
    finperiodid: PropTypes.number.isRequired,
    startdate: PropTypes.string.isRequired,
    enddate: PropTypes.string.isRequired,
    islocked: PropTypes.bool,
  }).isRequired,
}

BudgetTableRows.propTypes = {
  budget: PropTypes.shape({
    budgetid: PropTypes.number.isRequired,
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }).isRequired,
}
