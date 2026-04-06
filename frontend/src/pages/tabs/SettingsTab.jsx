import { useState } from 'react'
import PropTypes from 'prop-types'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateBudget } from '../../api/client'
import { ACCOUNT_NAMING_OPTIONS } from '../../utils/accountNaming'

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

export default function SettingsTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [showPrimaryHelp, setShowPrimaryHelp] = useState(false)

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

  return (
    <div className="space-y-6 max-w-lg">
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">Settings</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Use these options to control how future budget cycles are prepared and how this budget behaves.
        </p>

        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            type="checkbox"
            checked={!!budget?.auto_add_surplus_to_investment}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('auto_add_surplus_to_investment', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
              Automatically add surplus budget to Investment Savings budget when creating a new budget cycle?
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
        </label>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <input
            type="checkbox"
            checked={budget?.allow_cycle_lock !== false}
            disabled={saveSettings.isPending}
            onChange={e => handleToggle('allow_cycle_lock', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
          />
          <span className="space-y-1">
            <span className="block font-medium text-gray-900 dark:text-gray-100">
              Allow manual lock/unlock on budget cycles?
            </span>
            <span className="block text-gray-600 dark:text-gray-400">
              When enabled, locking a cycle protects budgeted amounts and blocks adding or removing income, expense, and investment lines without closing the cycle.
            </span>
          </span>
        </label>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          <label htmlFor="account-naming-preference" className="label">Preferred Primary Account Naming</label>
          <select
            id="account-naming-preference"
            className="input"
            value={budget?.account_naming_preference || 'Transaction'}
            disabled={saveSettings.isPending}
            onChange={e => handleSelectChange('account_naming_preference', e.target.value)}
          >
            {ACCOUNT_NAMING_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose the label Dosh should use when talking about your main spending account in setup and account-related screens.
          </p>
        </div>

        {saveSettings.isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
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
    account_naming_preference: PropTypes.string,
  }),
}
