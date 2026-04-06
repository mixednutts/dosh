import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateBudget } from '../../api/client'

const DEFAULTS = {
  acceptable_expense_overrun_pct: 10,
  comfortable_surplus_buffer_pct: 5,
  maximum_deficit_amount: null,
  revision_sensitivity: 50,
  savings_priority: 50,
  period_criticality_bias: 50,
}

const RANGE_MARKS = {
  percent: [0, 25, 50, 75, 100],
  ten: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

const SLIDER_THUMB_WIDTH_PX = 20

const SLIDERS = [
  {
    key: 'acceptable_expense_overrun_pct',
    title: 'When would an expense going over budget start to feel uncomfortable?',
    helper: 'This helps Dosh understand how much over-budget drift feels acceptable before it should affect the health checks.',
    formatValue: value => `${value}% over budget`,
    inputSuffix: '% over budget',
    unitHint: 'Unit: percentage over budget',
    leftLabel: 'A little drift is fine',
    rightLabel: 'Flag it quickly',
    scale: 'percent',
  },
  {
    key: 'comfortable_surplus_buffer_pct',
    title: 'At what point will a budget deficit start raising a budget health concern?',
    helper: 'This setting tells Dosh how much deficit is acceptable before it becomes a budget health concern.',
    formatValue: value => `${value}% deficit`,
    inputSuffix: '% deficit',
    unitHint: 'Unit: percentage deficit threshold',
    leftLabel: 'Small deficits are okay',
    rightLabel: 'Raise concern sooner',
    scale: 'percent',
  },
  {
    key: 'revision_sensitivity',
    title: 'How quickly should repeated plan changes start to feel like a warning sign?',
    helper: 'Higher sensitivity means revised expense lines will weigh more heavily in the health checks.',
    formatValue: value => `${value}/10`,
    inputSuffix: '/10',
    unitHint: 'Unit: sensitivity score',
    leftLabel: 'Flexible plan',
    rightLabel: 'Stable plan matters',
    scale: 'ten',
  },
  {
    key: 'savings_priority',
    title: 'How important is it to keep savings and investment contributions on track?',
    helper: 'This helps Dosh decide how strongly missed or drifting savings activity should affect the health checks.',
    formatValue: value => `${value}/10`,
    inputSuffix: '/10',
    unitHint: 'Unit: importance score',
    leftLabel: 'Useful, but flexible',
    rightLabel: 'Very important',
    scale: 'ten',
  },
  {
    key: 'period_criticality_bias',
    title: 'When in the budget cycle should health issues escalate?',
    helper: 'This helps Dosh decide whether issues should feel more important earlier in the budget cycle or closer to the finish line.',
    formatValue: value => `${value}/10`,
    inputSuffix: '/10',
    unitHint: 'Unit: timing sensitivity across the budget cycle',
    leftLabel: 'Earlier in the budget cycle',
    rightLabel: 'Later in the budget cycle',
    scale: 'ten',
  },
]

const PERSONALISATION_KEYS = Object.keys(DEFAULTS)

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

function sliderTrackStyle(value) {
  return {
    background: `linear-gradient(to right, rgb(13 148 136) 0%, rgb(13 148 136) ${value}%, rgb(229 231 235) ${value}%, rgb(229 231 235) 100%)`,
  }
}

function getDisplayValue(config, storedValue) {
  if (config.scale === 'ten') {
    return Math.max(1, Math.min(10, Math.round(storedValue / 10)))
  }
  return storedValue
}

function getStoredValue(config, displayValue) {
  if (config.scale === 'ten') {
    return Math.max(10, Math.min(100, Math.round(displayValue) * 10))
  }
  return Math.max(0, Math.min(100, Math.round(displayValue)))
}

function getSliderRange(config) {
  if (config.scale === 'ten') {
    return { min: 1, max: 10, step: 1, marks: RANGE_MARKS.ten }
  }
  return { min: 0, max: 100, step: 1, marks: RANGE_MARKS.percent }
}

function markerPositionStyle(valuePercent) {
  const offsetPx = (SLIDER_THUMB_WIDTH_PX / 2) - ((SLIDER_THUMB_WIDTH_PX * valuePercent) / 100)
  return {
    left: `calc(${valuePercent}% + ${offsetPx}px)`,
  }
}

function normaliseFormValue(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function CurrencyField({ value, onChange }) {
  const displayValue = value === null || value === undefined ? '' : String(value)

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white/70 px-3 py-3 dark:border-gray-600 dark:bg-gray-900/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">And / or maximum deficit amount</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Enter the dollar amount where health issues should escalate. Entering 50 means the concern point is reached when surplus moves to -50.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-dosh-700 shadow-sm dark:bg-gray-900 dark:text-dosh-300">
          <span>$</span>
          <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={e => onChange(e.target.value)}
            placeholder="Optional"
            className="w-24 border-0 bg-transparent p-0 text-right text-xs font-semibold text-dosh-700 outline-none focus:ring-0 dark:text-dosh-300"
            aria-label="Maximum deficit amount"
          />
        </label>
      </div>
    </div>
  )
}

function SliderField({ config, value, onChange, extraContent = null }) {
  const { min, max, step, marks } = getSliderRange(config)
  const displayValue = getDisplayValue(config, value)
  const defaultDisplayValue = getDisplayValue(config, DEFAULTS[config.key])
  const valuePercent = ((displayValue - min) / (max - min)) * 100
  const defaultValuePercent = ((defaultDisplayValue - min) / (max - min)) * 100
  const setTypedValue = nextValue => {
    if (nextValue === '') return
    const numericValue = Number(nextValue)
    if (Number.isNaN(numericValue)) return
    const clampedValue = Math.max(min, Math.min(max, Math.round(numericValue)))
    onChange(config.key, getStoredValue(config, clampedValue))
  }

  return (
    <div className="block rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.title}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{config.helper}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{config.unitHint}</p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-dosh-700 shadow-sm dark:bg-gray-900 dark:text-dosh-300">
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={displayValue}
              onChange={e => setTypedValue(e.target.value)}
              className="w-12 border-0 bg-transparent p-0 text-right text-xs font-semibold text-dosh-700 outline-none focus:ring-0 dark:text-dosh-300"
              aria-label={config.title}
            />
            <span>{config.inputSuffix}</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-1">
            {marks.map(mark => (
              <span key={mark} className="h-3 w-px bg-gray-400/70 dark:bg-gray-500/70" />
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={markerPositionStyle(defaultValuePercent)}
            title="Normal default"
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide text-dosh-700 dark:text-dosh-300">
              Default
            </span>
            <span className="block h-5 w-0.5 bg-dosh-700 dark:bg-dosh-300" />
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onChange={e => onChange(config.key, getStoredValue(config, Number(e.target.value)))}
            style={sliderTrackStyle(valuePercent)}
            className="relative h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-dosh-600 dark:bg-gray-700"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
          {marks.map(mark => (
            <span key={mark}>{mark}</span>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{config.leftLabel}</span>
        <span>{config.rightLabel}</span>
      </div>
      {extraContent}
    </div>
  )
}

export default function PersonalisationTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(DEFAULTS)

  useEffect(() => {
    if (!budget) return
    setForm({
      acceptable_expense_overrun_pct: budget.acceptable_expense_overrun_pct ?? DEFAULTS.acceptable_expense_overrun_pct,
      comfortable_surplus_buffer_pct: budget.comfortable_surplus_buffer_pct ?? DEFAULTS.comfortable_surplus_buffer_pct,
      maximum_deficit_amount: budget.maximum_deficit_amount ?? DEFAULTS.maximum_deficit_amount,
      revision_sensitivity: budget.revision_sensitivity ?? DEFAULTS.revision_sensitivity,
      savings_priority: budget.savings_priority ?? DEFAULTS.savings_priority,
      period_criticality_bias: budget.period_criticality_bias ?? DEFAULTS.period_criticality_bias,
    })
  }, [budget])

  const savePersonalisation = useMutation({
    mutationFn: data => updateBudget(budgetId, data),
    onSuccess: data => {
      qc.setQueryData(['budget', budgetId], data)
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const setValue = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const setMaximumDeficitAmount = nextValue => {
    const trimmedValue = nextValue.trim()
    if (trimmedValue === '') {
      setValue('maximum_deficit_amount', null)
      return
    }

    if (!/^\d*\.?\d{0,2}$/.test(trimmedValue)) {
      return
    }

    setValue('maximum_deficit_amount', trimmedValue)
  }

  useEffect(() => {
    if (!budget) return

    const hasChanges = PERSONALISATION_KEYS.some(
      key => normaliseFormValue(form[key]) !== normaliseFormValue(budget[key] ?? DEFAULTS[key])
    )
    if (!hasChanges) return

    const timeoutId = window.setTimeout(() => {
      savePersonalisation.mutate(form)
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [budget, form, savePersonalisation])

  const resetDefaults = () => {
    setForm(DEFAULTS)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">Personalisation</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Help Dosh understand what matters most to you. These preferences gently tune the health checks so the warnings feel more relevant to how you budget.
        </p>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          The darker marker on each slider shows the normal default. Percentage controls stay in percentage units, while the preference controls use a simpler 1 to 10 scale.
        </p>

        <div className="space-y-4">
          {SLIDERS.map(config => (
            <SliderField
              key={config.key}
              config={config}
              value={form[config.key]}
              onChange={setValue}
              extraContent={
                config.key === 'comfortable_surplus_buffer_pct' ? (
                  <CurrencyField
                    value={form.maximum_deficit_amount}
                    onChange={setMaximumDeficitAmount}
                  />
                ) : null
              }
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={resetDefaults}>
            Reset to Defaults
          </button>
        </div>

        {savePersonalisation.isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {formatApiError(savePersonalisation.error, 'Unable to save personalisation right now.')}
          </div>
        )}
      </div>
    </div>
  )
}

CurrencyField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
}

SliderField.propTypes = {
  config: PropTypes.shape({
    key: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    helper: PropTypes.string.isRequired,
    inputSuffix: PropTypes.string.isRequired,
    unitHint: PropTypes.string.isRequired,
    leftLabel: PropTypes.string.isRequired,
    rightLabel: PropTypes.string.isRequired,
    scale: PropTypes.oneOf(['percent', 'ten']).isRequired,
  }).isRequired,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  extraContent: PropTypes.node,
}

PersonalisationTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    acceptable_expense_overrun_pct: PropTypes.number,
    comfortable_surplus_buffer_pct: PropTypes.number,
    maximum_deficit_amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    revision_sensitivity: PropTypes.number,
    savings_priority: PropTypes.number,
    period_criticality_bias: PropTypes.number,
  }),
}
