import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays } from 'date-fns'
import {
  PlusIcon, LockClosedIcon, LockOpenIcon, TrashIcon,
  ChevronRightIcon, CalendarIcon,
} from '@heroicons/react/24/outline'
import {
  getBudget, getPeriodsForBudget, generatePeriod, setPeriodLock, deletePeriodForce,
  getIncomeTypes, getExpenseItems,
} from '../api/client'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import IncomeTypesTab from './tabs/IncomeTypesTab'
import ExpenseItemsTab from './tabs/ExpenseItemsTab'
import InvestmentItemsTab from './tabs/InvestmentItemsTab'
import BalanceTypesTab from './tabs/BalanceTypesTab'
import SettingsTab from './tabs/SettingsTab'

const TABS = ['Periods', 'Income Types', 'Expense Items', 'Investments', 'Accounts', 'Settings']

function PeriodStatusBadge({ period }) {
  const now = new Date()
  const start = parseISO(period.startdate)
  const end = parseISO(period.enddate)
  if (period.islocked) return <span className="badge-amber">Locked</span>
  if (now < start) return <span className="badge-blue">Upcoming</span>
  if (now > end) return <span className="badge-gray">Past</span>
  return <span className="badge-green">Current</span>
}

function GeneratePeriodModal({ budget, defaultStartDate, onClose }) {
  const qc = useQueryClient()
  const [startdate, setStartdate] = useState(defaultStartDate)
  const [count, setCount] = useState(1)
  const [error, setError] = useState('')

  const gen = useMutation({
    mutationFn: generatePeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods', budget.budgetid] })
      onClose()
    },
    onError: err => setError(err.response?.data?.detail ?? 'Failed to generate period'),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); gen.mutate({ budgetid: budget.budgetid, startdate, count: parseInt(count) || 1 }) }}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Generate <strong>{budget.budget_frequency}</strong> period(s) starting from:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" required className="input" value={startdate} onChange={e => setStartdate(e.target.value)} />
          </div>
          <div>
            <label className="label">Number of Periods</label>
            <input type="number" min="1" max="24" required className="input" value={count} onChange={e => setCount(e.target.value)} />
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={gen.isPending}>
            {gen.isPending ? 'Generating…' : `Generate${count > 1 ? ` ${count} Periods` : ''}`}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function BudgetDetailPage() {
  const { budgetId } = useParams()
  const id = parseInt(budgetId)
  const qc = useQueryClient()
  const [tab, setTab] = useState('Periods')
  const [showGenerate, setShowGenerate] = useState(false)

  const { data: budget, isLoading } = useQuery({ queryKey: ['budget', id], queryFn: () => getBudget(id) })
  const { data: periods = [] } = useQuery({ queryKey: ['periods', id], queryFn: () => getPeriodsForBudget(id), enabled: !!budget })
  const { data: incomeTypes = [] } = useQuery({ queryKey: ['income-types', id], queryFn: () => getIncomeTypes(id), enabled: !!budget })
  const { data: expenseItems = [] } = useQuery({ queryKey: ['expense-items', id], queryFn: () => getExpenseItems(id), enabled: !!budget })

  const lock = useMutation({
    mutationFn: ({ periodId, islocked }) => setPeriodLock(periodId, islocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periods', id] }),
  })

  const remove = useMutation({
    mutationFn: ({ periodId, force }) => deletePeriodForce(periodId, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periods', id] }),
  })

  const handleDeletePeriod = async (p) => {
    const detail = `${format(parseISO(p.startdate), 'dd MMM yyyy')} – ${format(parseISO(p.enddate), 'dd MMM yyyy')}`
    try {
      await deletePeriodForce(p.finperiodid, false)
      qc.invalidateQueries({ queryKey: ['periods', id] })
    } catch (err) {
      if (err.response?.status === 409) {
        if (window.confirm(`Period "${detail}" has recorded actual values.\n\nDelete anyway? This cannot be undone.`)) {
          remove.mutate({ periodId: p.finperiodid, force: true })
        }
      } else if (err.response?.status === 423) {
        alert('Unlock the period before deleting.')
      } else {
        alert(err.response?.data?.detail ?? 'Delete failed')
      }
    }
  }

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (!budget) return <p className="text-gray-500">Budget not found.</p>

  const sortedPeriods = [...periods].sort((a, b) => parseISO(b.startdate) - parseISO(a.startdate))

  // Default start date = last period end + 1 day, or today
  const lastPeriod = periods.length > 0
    ? periods.reduce((a, b) => parseISO(a.enddate) > parseISO(b.enddate) ? a : b)
    : null
  const defaultStartDate = lastPeriod
    ? format(addDays(parseISO(lastPeriod.enddate), 1), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link to="/budgets" className="hover:underline">Budgets</Link>
            <ChevronRightIcon className="w-3 h-3" />
            <span className="text-gray-800 dark:text-gray-200 font-medium">{budget.description || 'Untitled'}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{budget.description || 'Untitled Budget'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budgetowner} · {budget.budget_frequency}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-dosh-600 text-dosh-700 dark:text-dosh-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Periods tab */}
      {tab === 'Periods' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {incomeTypes.length === 0 && <span className="text-amber-600 dark:text-amber-400">⚠ No income types defined. </span>}
              {expenseItems.filter(e => e.active).length === 0 && <span className="text-amber-600 dark:text-amber-400">⚠ No active expense items. </span>}
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                if (incomeTypes.length === 0) { alert('Add at least one income type before generating a period.'); return }
                if (expenseItems.filter(e => e.active).length === 0) { alert('Add at least one active expense item before generating a period.'); return }
                setShowGenerate(true)
              }}
            >
              <CalendarIcon className="w-4 h-4" /> Generate Period
            </button>
          </div>

          {sortedPeriods.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
              No periods yet. Generate one above.
            </div>
          ) : (
            <div className="card divide-y divide-gray-100 dark:divide-gray-800">
              {sortedPeriods.map(p => (
                <div key={p.finperiodid} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
                        {format(parseISO(p.startdate), 'dd MMM yyyy')} – {format(parseISO(p.enddate), 'dd MMM yyyy')}
                      </span>
                      <PeriodStatusBadge period={p} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      title={p.islocked ? 'Unlock period' : 'Lock period'}
                      className="btn-secondary"
                      onClick={() => lock.mutate({ periodId: p.finperiodid, islocked: !p.islocked })}
                    >
                      {p.islocked
                        ? <LockClosedIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        : <LockOpenIcon className="w-3.5 h-3.5" />}
                    </button>
                    <Link to={`/periods/${p.finperiodid}`} className="btn-secondary text-xs">
                      Open →
                    </Link>
                    <button className="btn-danger" onClick={() => handleDeletePeriod(p)}>
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Income Types'  && <IncomeTypesTab budgetId={id} />}
      {tab === 'Expense Items' && <ExpenseItemsTab budgetId={id} />}
      {tab === 'Investments'   && <InvestmentItemsTab budgetId={id} />}
      {tab === 'Accounts'      && <BalanceTypesTab budgetId={id} />}
      {tab === 'Settings'      && <SettingsTab budgetId={id} />}

      {showGenerate && (
        <Modal title="Generate Budget Period" onClose={() => setShowGenerate(false)}>
          <GeneratePeriodModal
            budget={budget}
            defaultStartDate={defaultStartDate}
            onClose={() => setShowGenerate(false)}
          />
        </Modal>
      )}
    </div>
  )
}
