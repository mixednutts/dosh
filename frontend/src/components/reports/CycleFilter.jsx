import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'
import { subMonths, startOfMonth, endOfMonth, format, parseISO, isValid } from 'date-fns'
import DateField from '../DateField'

const PRESETS = [
  { key: 'last12', label: 'Last 12 Months' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'all', label: 'All Time' },
]

function computePresetRange(presetKey, latestDate) {
  if (!latestDate) return { fromDate: null, toDate: null }
  const end = endOfMonth(latestDate)
  if (presetKey === 'last12') {
    return { fromDate: startOfMonth(subMonths(end, 11)), toDate: end }
  }
  if (presetKey === 'last6') {
    return { fromDate: startOfMonth(subMonths(end, 5)), toDate: end }
  }
  return { fromDate: null, toDate: null }
}

export default function CycleFilter({ budgetPeriods, onChange, defaultPreset = 'last12' }) {
  const [activePreset, setActivePreset] = useState(defaultPreset)
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [validationError, setValidationError] = useState(null)

  const latestDate = budgetPeriods.length > 0
    ? parseISO(budgetPeriods[budgetPeriods.length - 1].enddate)
    : null

  const applyPreset = useCallback((presetKey) => {
    setActivePreset(presetKey)
    if (presetKey === 'all') {
      setFromDate(null)
      setToDate(null)
      setValidationError(null)
      onChange({ fromDate: null, toDate: null })
      return
    }
    const range = computePresetRange(presetKey, latestDate)
    if (range.fromDate && isValid(range.fromDate)) {
      setFromDate(range.fromDate)
      setToDate(range.toDate)
      setValidationError(null)
      onChange({ fromDate: range.fromDate, toDate: range.toDate })
    }
  }, [latestDate, onChange])

  useEffect(() => {
    if (defaultPreset && defaultPreset !== 'custom') {
      applyPreset(defaultPreset)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestDate?.getTime?.()])

  const handleFromChange = (date) => {
    setFromDate(date)
    setActivePreset('custom')
    if (date && toDate && date > toDate) {
      setValidationError('From date must be before or equal to To date')
    } else {
      setValidationError(null)
      onChange({ fromDate: date, toDate })
    }
  }

  const handleToChange = (date) => {
    setToDate(date)
    setActivePreset('custom')
    if (fromDate && date && fromDate > date) {
      setValidationError('From date must be before or equal to To date')
    } else {
      setValidationError(null)
      onChange({ fromDate, toDate: date })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(preset => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPreset(preset.key)}
            className={clsx(
              'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
              activePreset === preset.key
                ? 'border-dosh-400 bg-dosh-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-dosh-400 hover:bg-dosh-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-dosh-700 dark:hover:bg-slate-800'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">From</label>
          <DateField
            selected={fromDate}
            onChange={handleFromChange}
            placeholderText="Start date"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">To</label>
          <DateField
            selected={toDate}
            onChange={handleToChange}
            placeholderText="End date"
          />
        </div>
      </div>
      {validationError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
      ) : null}
    </div>
  )
}

CycleFilter.propTypes = {
  budgetPeriods: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  defaultPreset: PropTypes.string,
}
