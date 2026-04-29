import { useState } from 'react'
import PropTypes from 'prop-types'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLocalisationOptions, updateBudget } from '../../api/client'
import { CURRENCY_OPTIONS, DATE_FORMAT_OPTIONS, LOCALE_OPTIONS, TIMEZONE_OPTIONS } from '../../utils/localisation'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

function resolveValueOptions(serverValues, fallbackValues) {
  return serverValues?.length ? serverValues : fallbackValues
}

function resolveLabelledOptions(serverValues, fallbackOptions) {
  if (!serverValues?.length) return fallbackOptions
  return serverValues.map(value => fallbackOptions.find(option => option.value === value) || { value, label: value })
}

export default function SettingsTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [showPrimaryHelp, setShowPrimaryHelp] = useState(false)
  const { data: localisationOptions } = useQuery({
    queryKey: ['localisation-options'],
    queryFn: getLocalisationOptions,
    staleTime: Infinity,
  })
  const localeOptions = resolveLabelledOptions(localisationOptions?.locales, LOCALE_OPTIONS)
  const currencyOptions = resolveValueOptions(localisationOptions?.currencies, CURRENCY_OPTIONS)
  const timezoneOptions = resolveValueOptions(localisationOptions?.timezones, TIMEZONE_OPTIONS)
  const dateFormatOptions = resolveLabelledOptions(localisationOptions?.date_formats, DATE_FORMAT_OPTIONS)
  const currentDateFormat = budget?.date_format || 'medium'
  const selectableDateFormatOptions = dateFormatOptions.some(option => option.value === currentDateFormat)
    ? dateFormatOptions
    : [...dateFormatOptions, { value: currentDateFormat, label: currentDateFormat, sample: currentDateFormat }]

  const saveSettings = useMutation({
    mutationFn: data => updateBudget(budgetId, data),
    onSuccess: data => {
      qc.setQueryData(['budget', budgetId], data)
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const handleToggle = (field, checked) => {
    saveSettings.mutate({ [field]: checked })
  }

  const handleSelectChange = (field, value) => {
    saveSettings.mutate({ [field]: value })
  }

  const handleOffsetChange = value => {
    const parsed = Number.parseInt(value, 10)
    saveSettings.mutate({ auto_expense_offset_days: Number.isNaN(parsed) ? 0 : parsed })
  }

  const handleMaxForwardCyclesChange = value => {
    const parsed = Number.parseInt(value, 10)
    const clamped = Number.isNaN(parsed) ? 10 : Math.max(1, Math.min(50, parsed))
    saveSettings.mutate({ max_forward_balance_cycles: clamped })
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">Settings</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Use these options to control how future budget cycles are prepared and how this budget behaves.
        </p>

        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            id="auto-add-surplus-to-investment"
            type="checkbox"
            checked={!!budget?.auto_add_surplus_to_investment}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('auto_add_surplus_to_investment', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
              <label htmlFor="auto-add-surplus-to-investment" className="cursor-pointer">
              Automatically add surplus budget to Investment Savings budget when creating a new budget cycle?
              </label>
              <span className="relative inline-flex">
                <button
                  type="button"
                  aria-label="More information about primary investment allocation"
                  className="text-gray-400 transition-colors hover:text-dosh-600 dark:text-gray-500 dark:hover:text-dosh-300"
                  onMouseEnter={() => setShowPrimaryHelp(true)}
                  onMouseLeave={() => setShowPrimaryHelp(false)}
                  onFocus={() => setShowPrimaryHelp(true)}
                  onBlur={() => setShowPrimaryHelp(false)}
                  onClick={() => setShowPrimaryHelp(v => !v)}
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </button>
                {showPrimaryHelp && (
                  <span className="absolute left-1/2 top-6 z-10 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg dark:bg-gray-700">
                    Will only assign to the primary investment line.
                  </span>
                )}
              </span>
            </span>
            <span className="block text-gray-600 dark:text-gray-400">
              When turned on, Dosh will calculate the new budget cycle&apos;s starting surplus budget and allocate it to the active primary investment line.
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Set one active investment line as primary to control where this automatic allocation goes.
            </span>
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            id="allow-cycle-lock"
            type="checkbox"
            checked={budget?.allow_cycle_lock !== false}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('allow_cycle_lock', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <label htmlFor="allow-cycle-lock" className="block cursor-pointer font-medium text-gray-900 dark:text-gray-100">
              Allow manual lock/unlock on budget cycles?
            </label>
            <span className="block text-gray-600 dark:text-gray-400">
              When enabled, locking a cycle protects budgeted amounts and blocks adding or removing income, expense, and investment lines without closing the cycle.
            </span>
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            id="record-line-status-changes"
            type="checkbox"
            checked={!!budget?.record_line_status_changes}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('record_line_status_changes', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
              <label htmlFor="record-line-status-changes" className="cursor-pointer">
                Record budget line Paid/Revised status changes as non-financial transactions?
              </label>
              <span
                className="text-gray-400 hover:text-gray-600 cursor-help dark:text-gray-500 dark:hover:text-gray-300"
                title="When enabled, marking items as Paid or Revised will create a history record visible in the transaction details. This helps track planning changes over time and feeds into budget health analysis."
              >
                <QuestionMarkCircleIcon className="h-4 w-4" />
              </span>
            </span>
            <span className="block text-gray-600 dark:text-gray-400">
              Creates an audit trail when you mark income, expense, or investment lines as Paid or Revised.
            </span>
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            id="allow-overdraft-transactions"
            type="checkbox"
            checked={!!budget?.allow_overdraft_transactions}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('allow_overdraft_transactions', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <label htmlFor="allow-overdraft-transactions" className="block cursor-pointer font-medium text-gray-900 dark:text-gray-100">
              Allow overdraft transactions?
            </label>
            <span className="block text-gray-600 dark:text-gray-400">
              When enabled, manual transactions that would overdraw an account are allowed. When disabled, transactions are blocked if the debit account does not have sufficient balance.
            </span>
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-start gap-3">
            <input
              id="auto-expense-enabled"
              type="checkbox"
              checked={!!budget?.auto_expense_enabled}
              disabled={saveSettings.isPending}
              onChange={e => handleToggle('auto_expense_enabled', e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
            />
            <span className="flex-1 space-y-2">
              <label htmlFor="auto-expense-enabled" className="block cursor-pointer font-medium text-gray-900 dark:text-gray-100">
                Enable Auto Expense?
              </label>
              <span className="block text-gray-600 dark:text-gray-400">
                When enabled, Dosh can automatically create due expense transactions for scheduled expense items marked AUTO.
              </span>
              <div>
                <label htmlFor="auto-expense-offset-days" className="label">Offset Days</label>
                <input
                  id="auto-expense-offset-days"
                  type="number"
                  min="0"
                  className="input max-w-32"
                  value={budget?.auto_expense_offset_days ?? 0}
                  disabled={saveSettings.isPending || !budget?.auto_expense_enabled}
                  onChange={e => handleOffsetChange(e.target.value)}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Use `0` to create the transaction on the due date. Dosh will not push a last-day due expense past the end of the budget cycle.
                </p>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Auto Expense will create transactions even if the debit account has insufficient funds. This feature is not restricted by the &quot;Allow overdraft transactions&quot; setting above.
                </p>
              </div>
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="locale-preference" className="label">Locale</label>
          <select
            id="locale-preference"
            className="input"
            value={budget?.locale || 'en-AU'}
            disabled={saveSettings.isPending}
            onChange={e => handleSelectChange('locale', e.target.value)}
          >
            {localeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose the regional format Dosh should use for numbers, dates, and currency display.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="currency-preference" className="label">Currency</label>
          <select
            id="currency-preference"
            className="input"
            value={budget?.currency || 'AUD'}
            disabled={saveSettings.isPending}
            onChange={e => handleSelectChange('currency', e.target.value)}
          >
            {currencyOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose the currency symbol and amount format for this budget.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="timezone-preference" className="label">Timezone</label>
          <select
            id="timezone-preference"
            className="input"
            value={budget?.timezone || 'Australia/Sydney'}
            disabled={saveSettings.isPending}
            onChange={e => handleSelectChange('timezone', e.target.value)}
          >
            {timezoneOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose the local time Dosh should use for displayed timestamps and day-based guidance.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="date-format-preference" className="label">Date Format</label>
          <select
            id="date-format-preference"
            className="input"
            value={currentDateFormat}
            disabled={saveSettings.isPending}
            onChange={e => handleSelectChange('date_format', e.target.value)}
          >
            {selectableDateFormatOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label} - {option.sample}</option>
            ))}
          </select>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose the default date shape Dosh should use in budget screens.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="max-forward-balance-cycles" className="label">Maximum Forward Balance Calculation Cycles</label>
          <input
            id="max-forward-balance-cycles"
            type="number"
            min="1"
            max="50"
            className="input max-w-32"
            value={budget?.max_forward_balance_cycles ?? 10}
            disabled={saveSettings.isPending}
            onChange={e => handleMaxForwardCyclesChange(e.target.value)}
          />
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Controls how many planned budget cycles Dosh will calculate account balances for dynamically.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Larger values may impact performance. Minimum 1, maximum 50.
          </p>
        </div>

        {saveSettings.isError && (
          <div className="mt-3 rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-800/30 dark:bg-red-950/10 dark:text-red-300">
            {formatApiError(saveSettings.error, 'Unable to save this setting right now.')}
          </div>
        )}
      </div>
    </div>
  )
}

SettingsTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    auto_add_surplus_to_investment: PropTypes.bool,
    allow_cycle_lock: PropTypes.bool,
    allow_overdraft_transactions: PropTypes.bool,
    locale: PropTypes.string,
    currency: PropTypes.string,
    timezone: PropTypes.string,
    date_format: PropTypes.string,
    auto_expense_enabled: PropTypes.bool,
    auto_expense_offset_days: PropTypes.number,
    max_forward_balance_cycles: PropTypes.number,
  }),
}
