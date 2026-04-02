import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRightIcon, ArrowUpIcon } from '@heroicons/react/24/outline'
import { getBudget, getIncomeTypes, getExpenseItems, getInvestmentItems, getBalanceTypes } from '../api/client'
import Spinner from '../components/Spinner'
import IncomeTypesTab from './tabs/IncomeTypesTab'
import ExpenseItemsTab from './tabs/ExpenseItemsTab'
import InvestmentItemsTab from './tabs/InvestmentItemsTab'
import BalanceTypesTab from './tabs/BalanceTypesTab'
import SettingsTab from './tabs/SettingsTab'

const SECTIONS = [
  { id: 'budget-info', label: 'Budget Info' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'income-types', label: 'Income Types' },
  { id: 'expense-items', label: 'Expense Items' },
  { id: 'investments', label: 'Investments' },
  { id: 'settings', label: 'Settings' },
]

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function SectionShell({ id, title, summary, helper, children, badge }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {badge && <span className="badge-gray">{badge}</span>}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{summary}</p>
          {helper && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 inline-flex rounded-md px-2.5 py-1">
              {helper}
            </p>
          )}
        </div>
      </div>
      <div className="card p-4 lg:p-5">
        {children}
      </div>
    </section>
  )
}

export default function BudgetDetailPage() {
  const { budgetId } = useParams()
  const id = parseInt(budgetId, 10)
  const [activeSection, setActiveSection] = useState('budget-info')
  const [showReturnTop, setShowReturnTop] = useState(false)

  const { data: budget, isLoading } = useQuery({ queryKey: ['budget', id], queryFn: () => getBudget(id) })
  const { data: accounts = [] } = useQuery({ queryKey: ['balance-types', id], queryFn: () => getBalanceTypes(id), enabled: !!budget })
  const { data: incomeTypes = [] } = useQuery({ queryKey: ['income-types', id], queryFn: () => getIncomeTypes(id), enabled: !!budget })
  const { data: expenseItems = [] } = useQuery({ queryKey: ['expense-items', id], queryFn: () => getExpenseItems(id), enabled: !!budget })
  const { data: investmentItems = [] } = useQuery({ queryKey: ['investment-items', id], queryFn: () => getInvestmentItems(id), enabled: !!budget })

  useEffect(() => {
    const handleScroll = () => setShowReturnTop(window.scrollY > 420)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (!budget) return <p className="text-gray-500">Budget not found.</p>

  const activeExpenseItems = expenseItems.filter(item => item.active)
  const hasAccounts = accounts.length > 0
  const primaryAccount = accounts.find(account => account.is_primary)

  const jumpToSection = sectionId => {
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const returnToTop = () => {
    setActiveSection('budget-info')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/budgets" className="hover:underline">Budgets</Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link to={`/budgets/${id}`} className="hover:underline">{budget.description || 'Untitled'}</Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="font-medium text-gray-800 dark:text-gray-200">Setup</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{budget.description || 'Untitled Budget'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{budget.budgetowner} · {budget.budget_frequency}</p>
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-4 border-y border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-950/95 lg:-mx-6 lg:px-6">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => jumpToSection(section.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'border-dosh-600 bg-dosh-50 text-dosh-700 dark:border-dosh-500 dark:bg-dosh-900/30 dark:text-dosh-300'
                  : 'border-gray-300 text-gray-600 hover:border-dosh-300 hover:text-dosh-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-dosh-700 dark:hover:text-dosh-300'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <SectionShell
        id="budget-info"
        title="Budget Info"
        summary="Review the core details for this budget before working through the setup steps below."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Owner</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{budget.budgetowner}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Frequency</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{budget.budget_frequency}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Setup</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {countLabel(accounts.length, 'account')}, {countLabel(incomeTypes.length, 'income type')}, {countLabel(activeExpenseItems.length, 'active expense item')}, {countLabel(investmentItems.length, 'investment')}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dosh-200 bg-dosh-50 px-4 py-3 text-sm text-dosh-800 dark:border-dosh-800 dark:bg-dosh-900/20 dark:text-dosh-200">
          Periods are managed from this budget's periods page. Use this page to build and maintain the setup that future periods will be generated from.
        </div>
      </SectionShell>

      <SectionShell
        id="accounts"
        title="Accounts"
        badge={countLabel(accounts.length, 'account')}
        summary="Start here by creating the accounts this budget will use for balances, savings transfers, and linked transactions."
        helper={!primaryAccount ? 'Set one account as the primary account so expense movements have a default home.' : null}
      >
        <BalanceTypesTab budgetId={id} />
      </SectionShell>

      <SectionShell
        id="income-types"
        title="Income Types"
        badge={countLabel(incomeTypes.length, 'income type')}
        summary="Add the income lines you want to include in generated periods, including fixed income and any savings transfers."
        helper={!hasAccounts ? 'Create at least one account first so account-linked income options are ready when you need them.' : null}
      >
        <IncomeTypesTab budgetId={id} />
      </SectionShell>

      <SectionShell
        id="expense-items"
        title="Expense Items"
        badge={countLabel(expenseItems.length, 'expense item')}
        summary="Define the recurring and one-off expenses that should appear in generated periods."
        helper={!hasAccounts ? 'Create at least one account first so expense tracking has an account structure in place as that behaviour develops.' : null}
      >
        <ExpenseItemsTab budgetId={id} />
      </SectionShell>

      <SectionShell
        id="investments"
        title="Investments"
        badge={countLabel(investmentItems.length, 'investment')}
        summary="Add investment lines for contributions, balances, and account-linked investment activity."
        helper={!hasAccounts ? 'Create at least one account first so linked investment accounts are available when needed.' : null}
      >
        <InvestmentItemsTab budgetId={id} />
      </SectionShell>

      <SectionShell
        id="settings"
        title="Settings"
        summary="Optional controls that adjust budget behaviour and page layout."
      >
        <SettingsTab />
      </SectionShell>

      {showReturnTop && (
        <button
          type="button"
          onClick={returnToTop}
          className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-dosh-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-dosh-700 dark:bg-dosh-700 dark:hover:bg-dosh-600"
          title="Return to top"
        >
          <ArrowUpIcon className="h-4 w-4" />
          Return to Top
        </button>
      )}
    </div>
  )
}
