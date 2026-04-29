import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon, ArrowUpIcon } from '@heroicons/react/24/outline'
import { getBudget, getIncomeTypes, getExpenseItems, getInvestmentItems, getBalanceTypes, getBudgetSetupAssessment, updateBudget, getPeriodSummariesForBudget } from '../api/client'
import Spinner from '../components/Spinner'
import IncomeTypesTab from './tabs/IncomeTypesTab'
import ExpenseItemsTab from './tabs/ExpenseItemsTab'
import InvestmentItemsTab from './tabs/InvestmentItemsTab'
import BalanceTypesTab from './tabs/BalanceTypesTab'
import BudgetHealthTab from './tabs/BudgetHealthTab'
import SettingsTab from './tabs/SettingsTab'


const SECTIONS = [
  { id: 'budget-info', label: 'Budget Info' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'income-types', label: 'Income Sources' },
  { id: 'expense-items', label: 'Expense Items' },
  { id: 'investments', label: 'Investments' },
  { id: 'budget-health', label: 'Budget Health Engine' },
  { id: 'settings', label: 'Settings' },
]

const SETUP_ISSUE_SECTION_ORDER = {
  'budget-info': 0,
  accounts: 1,
  'income-types': 2,
  'expense-items': 3,
  investments: 4,
  'budget-health': 5,
  settings: 6,
}

const COLLAPSIBLE_SECTIONS = new Set(['budget-health', 'settings'])
const SECTION_SESSION_KEY_PREFIX = 'dosh-setup-section-collapsed'

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getIssueSectionId(issue) {
  const lower = issue.toLowerCase()

  if (lower.includes('budget owner') || lower.includes('budget name') || lower.includes('budget info')) {
    return 'budget-info'
  }
  if (lower.includes('account') || lower.includes('primary account')) {
    return 'accounts'
  }
  if (lower.includes('income type') || lower.includes('income source')) {
    return 'income-types'
  }
  if (lower.includes('expense item')) {
    return 'expense-items'
  }
  if (lower.includes('investment')) {
    return 'investments'
  }
  if (lower.includes('personalisation') || lower.includes('health')) {
    return 'budget-health'
  }
  if (lower.includes('setting')) {
    return 'settings'
  }

  return 'settings'
}

function sortBlockingIssues(issues = []) {
  return [...issues].sort((left, right) => {
    const leftOrder = SETUP_ISSUE_SECTION_ORDER[getIssueSectionId(left)] ?? Number.MAX_SAFE_INTEGER
    const rightOrder = SETUP_ISSUE_SECTION_ORDER[getIssueSectionId(right)] ?? Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return 0
  })
}


function SectionShell({ id, title, summary, helper, children, badge, statusBadge, collapsible = false, collapsed = false, onToggle }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70 lg:px-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {collapsible ? (
                <button
                  type="button"
                  onClick={onToggle}
                  className="inline-flex items-center text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  aria-expanded={!collapsed}
                  aria-controls={`${id}-content`}
                  title={collapsed ? `Expand ${title.toLowerCase()}` : `Collapse ${title.toLowerCase()}`}
                >
                  {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </button>
              ) : null}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              {badge && <span className="badge-gray">{badge}</span>}
              {statusBadge ? <span className={statusBadge.className}>{statusBadge.label}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">{summary}</p>
            </div>
            {helper && (
              <p className="inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                {helper}
              </p>
            )}
          </div>
        </div>
        {!collapsed ? (
          <div id={`${id}-content`} className="p-4 lg:p-5">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function getSectionStatus(sectionKey, setupAssessment) {
  if (!setupAssessment) return null

  const blockingIssues = setupAssessment.blocking_issues || []
  const sectionItems = setupAssessment[sectionKey] || []
  const inUseCount = sectionItems.filter(item => item.in_use).length

  const matchesBlockingIssue = blockingIssues.some(issue => {
    const lower = issue.toLowerCase()
    if (sectionKey === 'accounts') return lower.includes('account')
    if (sectionKey === 'income_types') return lower.includes('income type') || lower.includes('income source')
    if (sectionKey === 'expense_items') return lower.includes('expense item')
    if (sectionKey === 'investment_items') return lower.includes('investment')
    return false
  })

  if (matchesBlockingIssue) {
    return { label: 'Needs Attention', className: 'badge-amber' }
  }

  if (inUseCount > 0) {
    return { label: `${inUseCount} In Use`, className: 'badge-blue' }
  }

  return { label: 'Ready', className: 'badge-green' }
}

function BudgetInfoForm({ budgetId, budget }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    description: budget.description ?? '',
    budgetowner: budget.budgetowner ?? '',
  })

  useEffect(() => {
    setForm({
      description: budget.description ?? '',
      budgetowner: budget.budgetowner ?? '',
    })
  }, [budget])

  const saveBudget = useMutation({
    mutationFn: data => updateBudget(budgetId, data),
    onSuccess: data => {
      qc.setQueryData(['budget', budgetId], data)
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  useEffect(() => {
    const currentDescription = budget.description ?? ''
    const currentOwner = budget.budgetowner ?? ''
    const isDirty = form.description !== currentDescription || form.budgetowner !== currentOwner
    if (!isDirty) return
    if (!form.budgetowner.trim()) return

    const timeoutId = globalThis.setTimeout(() => {
      saveBudget.mutate({
        description: form.description,
        budgetowner: form.budgetowner.trim(),
      })
    }, 400)

    return () => globalThis.clearTimeout(timeoutId)
  }, [budget, form, saveBudget])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-dosh-300 hover:bg-white focus-within:border-dosh-500 focus-within:bg-white dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-dosh-700 dark:hover:bg-gray-900 dark:focus-within:border-dosh-500 dark:focus-within:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Name</p>
          <input
            className="mt-2 w-full rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-dosh-500 focus:ring-2 focus:ring-dosh-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-dosh-500 dark:focus:ring-dosh-900/40"
            value={form.description}
            onChange={e => setForm(current => ({ ...current, description: e.target.value }))}
            placeholder="Untitled Budget"
            aria-label="Budget Name"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to edit. Changes save automatically.</p>
        </label>
        <label className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-dosh-300 hover:bg-white focus-within:border-dosh-500 focus-within:bg-white dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-dosh-700 dark:hover:bg-gray-900 dark:focus-within:border-dosh-500 dark:focus-within:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Owner</p>
          <input
            className="mt-2 w-full rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-dosh-500 focus:ring-2 focus:ring-dosh-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-dosh-500 dark:focus:ring-dosh-900/40"
            value={form.budgetowner}
            onChange={e => setForm(current => ({ ...current, budgetowner: e.target.value }))}
            placeholder="Budget owner"
            aria-label="Budget Owner"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to edit. Changes save automatically.</p>
        </label>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Frequency</p>
          <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{budget.budget_frequency}</p>
        </div>
      </div>

      {saveBudget.isError ? (
        <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-800/30 dark:bg-red-950/10 dark:text-red-300">
          {saveBudget.error?.response?.data?.detail || 'Unable to save budget details right now.'}
        </div>
      ) : null}

      {!form.budgetowner.trim() ? (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 text-sm font-bold text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/10 dark:text-amber-300">
          Budget Owner can&apos;t be blank, so that change won&apos;t be saved until a name is entered.
        </div>
      ) : null}
    </div>
  )
}

SectionShell.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  summary: PropTypes.node.isRequired,
  helper: PropTypes.node,
  children: PropTypes.node,
  badge: PropTypes.node,
  statusBadge: PropTypes.shape({
    className: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  }),
  collapsible: PropTypes.bool,
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func,
}

BudgetInfoForm.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }).isRequired,
}

export default function BudgetDetailPage() {
  const { budgetId } = useParams()
  const id = Number.parseInt(budgetId, 10)
  const [activeSection, setActiveSection] = useState('budget-info')
  const [showReturnTop, setShowReturnTop] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (typeof globalThis === 'undefined') {
      return { 'budget-health': true, settings: true }
    }

    return {
      'budget-health': globalThis.sessionStorage.getItem(`${SECTION_SESSION_KEY_PREFIX}:budget-health`) !== 'false',
      settings: globalThis.sessionStorage.getItem(`${SECTION_SESSION_KEY_PREFIX}:settings`) !== 'false',
    }
  })

  const { data: budget, isLoading } = useQuery({ queryKey: ['budget', id], queryFn: () => getBudget(id) })
  const { data: accounts = [] } = useQuery({ queryKey: ['balance-types', id], queryFn: () => getBalanceTypes(id), enabled: !!budget })
  const { data: incomeTypes = [] } = useQuery({ queryKey: ['income-types', id], queryFn: () => getIncomeTypes(id), enabled: !!budget })
  const { data: expenseItems = [] } = useQuery({ queryKey: ['expense-items', id], queryFn: () => getExpenseItems(id), enabled: !!budget })
  const { data: investmentItems = [] } = useQuery({ queryKey: ['investment-items', id], queryFn: () => getInvestmentItems(id), enabled: !!budget })
  const { data: setupAssessment } = useQuery({ queryKey: ['budget-setup-assessment', id], queryFn: () => getBudgetSetupAssessment(id), enabled: !!budget })
  const { data: periodSummaries = [] } = useQuery({ queryKey: ['period-summaries', id], queryFn: () => getPeriodSummariesForBudget(id), enabled: !!budget })

  useEffect(() => {
    const handleScroll = () => setShowReturnTop(globalThis.scrollY > 420)
    handleScroll()
    globalThis.addEventListener('scroll', handleScroll, { passive: true })
    return () => globalThis.removeEventListener('scroll', handleScroll)
  }, [])

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>
  if (!budget) return <p className="text-gray-500">Budget not found.</p>

  const activeExpenseItems = expenseItems.filter(item => item.active)
  const hasAccounts = accounts.length > 0
  const primaryAccount = accounts.find(account => account.is_primary)
  const accountsHelper = primaryAccount
    ? null
    : 'Choose one account as the primary account, so expenses know which account to deduct from by default.'
  const incomeHelper = hasAccounts ? null : 'Add an account first if you want income to flow into a tracked account.'
  const expenseHelper = hasAccounts ? null : 'Add an account first so future expense entries can be connected to one when you need that.'
  const investmentHelper = hasAccounts ? null : 'Add an account first if you want investment contributions linked to a tracked account.'
  const orderedBlockingIssues = sortBlockingIssues(setupAssessment?.blocking_issues)

  const jumpToSection = sectionId => {
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const returnToTop = () => {
    setActiveSection('budget-info')
    globalThis.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleSection = sectionId => {
    setCollapsedSections(current => {
      const nextCollapsed = !current[sectionId]
      if (typeof globalThis !== 'undefined') {
        globalThis.sessionStorage.setItem(`${SECTION_SESSION_KEY_PREFIX}:${sectionId}`, String(nextCollapsed))
      }

      return { ...current, [sectionId]: nextCollapsed }
    })
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
        <div className="flex overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap gap-2 pb-1 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => jumpToSection(section.id)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
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
        summary="Review the basics of this budget and check whether the setup has the pieces needed for a first cycle."
      >
        <BudgetInfoForm budgetId={id} budget={budget} />
        <div className="mt-4 grid gap-3 sm:grid-cols-1">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Setup</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {countLabel(accounts.length, 'account')}, {countLabel(incomeTypes.length, 'income source')}, {countLabel(activeExpenseItems.length, 'active expense item')}, {countLabel(investmentItems.length, 'investment')}
            </p>
          </div>
          {setupAssessment && periodSummaries.length === 0 ? (
            <div className={`rounded-xl px-4 py-3 ${
              setupAssessment.can_generate
                ? 'border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                : 'border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Setup Assessment</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                {setupAssessment.can_generate ? 'This setup is ready for your first budget cycle.' : 'A few setup details still need attention before the first budget cycle can be created.'}
              </p>
              {setupAssessment.can_generate ? (
                <Link
                  to={`/budgets/${id}`}
                  className="mt-2 inline-flex text-sm font-medium text-dosh-700 hover:underline dark:text-dosh-400"
                >
                  Review budget cycles
                </Link>
              ) : null}
              {orderedBlockingIssues.length ? (
                <div className="mt-2 space-y-1">
                  {orderedBlockingIssues.map(issue => (
                    <p key={issue} className="text-sm text-amber-800 dark:text-amber-300">{issue}</p>
                  ))}
                </div>
              ) : null}
              {setupAssessment.warnings?.length ? (
                <div className="mt-2 space-y-1">
                  {setupAssessment.warnings.map(warning => (
                    <p key={warning} className="text-sm text-gray-700 dark:text-gray-300">{warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionShell>

      <SectionShell
        id="accounts"
        title="Accounts"
        badge={countLabel(accounts.length, 'account')}
        statusBadge={getSectionStatus('accounts', setupAssessment)}
        summary="Start here by adding the accounts you want this budget to track for spending, savings, and cash."
        helper={accountsHelper}
      >
        <BalanceTypesTab budgetId={id} budget={budget} />
      </SectionShell>

      <SectionShell
        id="income-types"
        title="Income Sources"
        badge={countLabel(incomeTypes.length, 'income source')}
        statusBadge={getSectionStatus('income_types', setupAssessment)}
        summary="Add the income lines you want to plan with in each budget cycle, including steady income and optional transfers."
        helper={incomeHelper}
      >
        <IncomeTypesTab budgetId={id} budget={budget} />
      </SectionShell>

      <SectionShell
        id="expense-items"
        title="Expense Items"
        badge={countLabel(expenseItems.length, 'expense item')}
        statusBadge={getSectionStatus('expense_items', setupAssessment)}
        summary="Define the recurring and one-off expenses you want each cycle to plan around."
        helper={expenseHelper}
      >
        <ExpenseItemsTab budgetId={id} />
      </SectionShell>

      <SectionShell
        id="investments"
        title="Investments"
        badge={countLabel(investmentItems.length, 'investment')}
        statusBadge={getSectionStatus('investment_items', setupAssessment)}
        summary="Add investment lines for contributions, balances, and longer-term goals you want this budget to reflect."
        helper={investmentHelper}
      >
        <InvestmentItemsTab budgetId={id} budget={budget} />
      </SectionShell>

      <SectionShell
        id="budget-health"
        title="Budget Health Engine"
        summary="Tell Dosh what feels important to you so the health checks can be a little more aligned with your budgeting style."
        collapsible={COLLAPSIBLE_SECTIONS.has('budget-health')}
        collapsed={collapsedSections['budget-health']}
        onToggle={() => toggleSection('budget-health')}
      >
        <BudgetHealthTab budgetId={id} budget={budget} />
      </SectionShell>

      <SectionShell
        id="settings"
        title="Settings"
        summary="Optional controls that adjust budget behaviour and other setup preferences."
        collapsible={COLLAPSIBLE_SECTIONS.has('settings')}
        collapsed={collapsedSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <SettingsTab budgetId={id} budget={budget} />
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
