import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'
import { parseISO, isValid } from 'date-fns'
import DateField from '../DateField'

const PRESETS = [
  { key: 'last12', label: 'Last 12 Periods', count: 12 },
  { key: 'last6', label: 'Last 6 Periods', count: 6 },
  { key: 'all', label: 'All Periods', count: null },
]

function computePeriodRange(count, budgetPeriods) {
  if (!budgetPeriods || budgetPeriods.length === 0) {
    return { fromDate: null, toDate: null }
  }
  const effectiveCount = Math.min(count, budgetPeriods.length)
  const slice = budgetPeriods.slice(-effectiveCount)
  const first = parseISO(slice[0].startdate)
  const last = parseISO(slice[slice.length - 1].enddate)
  return { fromDate: isValid(first) ? first : null, toDate: isValid(last) ? last : null }
}

function computePresetRange(presetKey, budgetPeriods) {
  if (!budgetPeriods || budgetPeriods.length === 0) {
    return { fromDate: null, toDate: null }
  }

  if (presetKey === 'all') {
    const first = parseISO(budgetPeriods[0].startdate)
    const last = parseISO(budgetPeriods[budgetPeriods.length - 1].enddate)
    return { fromDate: isValid(first) ? first : null, toDate: isValid(last) ? last : null }
  }

  const preset = PRESETS.find(p => p.key === presetKey)
  const count = preset?.count || 12
  return computePeriodRange(count, budgetPeriods)
}

export default function CycleFilter({ budgetPeriods, onChange, defaultPreset = 'last12' }) {
  const [activePreset, setActivePreset] = useState(defaultPreset)
  const [customCount, setCustomCount] = useState('')
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [validationError, setValidationError] = useState(null)

  const applyPreset = useCallback((presetKey) => {
    setActivePreset(presetKey)
    setCustomCount('')
    if (presetKey === 'all') {
      setFromDate(null)
      setToDate(null)
      setValidationError(null)
      onChange({ fromDate: null, toDate: null })
      return
    }
    const range = computePresetRange(presetKey, budgetPeriods)
    if (range.fromDate && isValid(range.fromDate)) {
      setFromDate(range.fromDate)
      setToDate(range.toDate)
      setValidationError(null)
      onChange({ fromDate: range.fromDate, toDate: range.toDate })
    }
  }, [budgetPeriods, onChange])

  const applyCustomCount = useCallback((count) => {
    const range = computePeriodRange(count, budgetPeriods)
    if (range.fromDate && isValid(range.fromDate)) {
      setFromDate(range.fromDate)
      setToDate(range.toDate)
      setValidationError(null)
      onChange({ fromDate: range.fromDate, toDate: range.toDate })
    }
  }, [budgetPeriods, onChange])

  useEffect(() => {
    if (defaultPreset && defaultPreset !== 'custom') {
      applyPreset(defaultPreset)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetPeriods.length])

  const handleFromChange = (date) => {
    setFromDate(date)
    setActivePreset('custom')
    setCustomCount('')
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
    setCustomCount('')
    if (fromDate && date && fromDate > date) {
      setValidationError('From date must be before or equal to To date')
    } else {
      setValidationError(null)
      onChange({ fromDate, toDate: date })
    }
  }

  const handleCustomCountChange = (e) => {
    const raw = e.target.value
    setCustomCount(raw)
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val > 0) {
      setActivePreset('custom')
      applyCustomCount(val)
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
        <div
          className={clsx(
            'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors',
            activePreset === 'custom'
              ? 'border-dosh-400 bg-dosh-600 text-white'
              : 'border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          )}
        >
          <span>Last</span>
          <input
            type="number"
            min="1"
            max={budgetPeriods.length || 999}
            className={clsx(
              'w-10 rounded border bg-transparent px-1 py-0.5 text-center text-xs outline-none',
              activePreset === 'custom'
                ? 'border-white/30 text-white placeholder:text-white/50'
                : 'border-gray-300 text-gray-900 placeholder:text-gray-400 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500'
            )}
            placeholder="#"
            value={customCount}
            onChange={handleCustomCountChange}
            onFocus={() => {
              if (customCount) setActivePreset('custom')
            }}
          />
          <span>periods</span>
        </div>
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
