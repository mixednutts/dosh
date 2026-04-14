import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  updateBudget,
  getBudgetHealthMatrix,
  getHealthDataSources,
  createCustomMetric,
  removeMatrixItem,
  updateMatrixItem,
  updateMetricPersonalisation,
} from '../../api/client'
import LocalizedAmountInput from '../../components/LocalizedAmountInput'

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

const TONE_OPTIONS = [
  { value: 'supportive', label: 'Supportive', description: 'Encouraging and gentle feedback' },
  { value: 'factual', label: 'Factual', description: 'Straightforward and neutral' },
  { value: 'friendly', label: 'Friendly', description: 'Casual and upbeat tone' },
]

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
          <LocalizedAmountInput
            value={value === null || value === undefined ? '' : String(value)}
            onChange={onChange}
            min="0"
            placeholder="Optional"
            className="w-24 border-0 bg-transparent p-0 text-right text-xs font-semibold text-dosh-700 outline-none focus:ring-0 dark:text-dosh-300"
            ariaLabel="Maximum deficit amount"
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

function MatrixItemCard({ item, onUpdate, onUpdatePersonalisation, onRemove, allowRemove }) {
  const [localWeight, setLocalWeight] = useState(item.weight)
  const [localSensitivity, setLocalSensitivity] = useState(item.scoring_sensitivity)
  const [localEnabled, setLocalEnabled] = useState(item.is_enabled)
  const [localPers, setLocalPers] = useState(item.personalisation_value)

  useEffect(() => {
    setLocalWeight(item.weight)
    setLocalSensitivity(item.scoring_sensitivity)
    setLocalEnabled(item.is_enabled)
    setLocalPers(item.personalisation_value)
  }, [item])

  const commitWeight = () => {
    const w = Math.max(0, Math.min(1, parseFloat(localWeight) || 0))
    setLocalWeight(w)
    onUpdate({ weight: w })
  }

  const commitSensitivity = () => {
    const s = Math.max(0, Math.min(100, Math.round(localSensitivity)))
    setLocalSensitivity(s)
    onUpdate({ scoring_sensitivity: s })
  }

  const commitEnabled = next => {
    setLocalEnabled(next)
    onUpdate({ is_enabled: next })
  }

  const commitPers = () => {
    onUpdatePersonalisation({ personalisation_key: item.personalisation_key, value: localPers })
  }

  const isCustom = !item.template_key

  return (
    <div className={`rounded-lg border px-4 py-3 dark:border-gray-700 ${localEnabled ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 opacity-70 dark:bg-gray-800/60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
            {isCustom && (
              <span className="rounded bg-dosh-100 px-1.5 py-0.5 text-[10px] font-semibold text-dosh-700 dark:bg-dosh-900/30 dark:text-dosh-300">
                Custom
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={localEnabled}
              onChange={e => commitEnabled(e.target.checked)}
              className="h-4 w-4 accent-dosh-600"
            />
            <span className="text-xs text-gray-600 dark:text-gray-300">Enabled</span>
          </label>
          {allowRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              title="Remove from matrix"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Weight</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={localWeight}
              onChange={e => setLocalWeight(parseFloat(e.target.value))}
              onMouseUp={commitWeight}
              onKeyUp={commitWeight}
              className="w-full accent-dosh-600"
            />
            <span className="w-12 text-right text-xs">{Math.round(localWeight * 100)}%</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Scoring Sensitivity</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={localSensitivity}
              onChange={e => setLocalSensitivity(parseInt(e.target.value, 10))}
              onMouseUp={commitSensitivity}
              onKeyUp={commitSensitivity}
              className="w-full accent-dosh-600"
            />
            <span className="w-8 text-right text-xs">{localSensitivity}</span>
          </div>
        </div>
      </div>

      {item.personalisation_key && (
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Personalisation ({item.personalisation_key})</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localPers === null || localPers === undefined ? '' : String(localPers)}
              onChange={e => setLocalPers(e.target.value)}
              onBlur={commitPers}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MetricBuilderCard({ dataSources, onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState('OVERALL')
  const [formula, setFormula] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    const trimmedName = name.trim()
    const trimmedFormula = formula.trim()
    if (!trimmedName) {
      setError('Metric name is required')
      return
    }
    if (!trimmedFormula) {
      setError('Formula expression is required')
      return
    }

    // Extract data sources from formula
    const sourceKeys = dataSources.map(ds => ds.source_key)
    const usedSources = sourceKeys.filter(key => trimmedFormula.includes(key))

    setIsSubmitting(true)
    try {
      await onCreate({
        name: trimmedName,
        description: description.trim(),
        scope,
        formula_expression: trimmedFormula,
        data_sources: usedSources,
      })
      setName('')
      setDescription('')
      setFormula('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create metric')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-dosh-300 bg-dosh-50/30 px-4 py-4 dark:border-dosh-700 dark:bg-dosh-950/10">
      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Create Custom Metric</h4>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Savings Rate"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of what this metric measures"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Scope</label>
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="OVERALL">Overall (applies to budget health)</option>
            <option value="CURRENT_PERIOD">Current Period Only</option>
            <option value="BOTH">Both Overall and Current Period</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Formula</label>
          <input
            type="text"
            value={formula}
            onChange={e => setFormula(e.target.value)}
            placeholder="e.g., live_period_surplus / total_budgeted_income"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Use +, -, *, /, parentheses, and data source names below.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Available Data Sources</p>
          <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            {dataSources.map(ds => (
              <button
                key={ds.source_key}
                type="button"
                onClick={() => setFormula(current => current ? `${current} ${ds.source_key}` : ds.source_key)}
                className="mb-1 mr-1 inline-block rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                title={ds.description}
              >
                {ds.source_key}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary text-xs"
          >
            {isSubmitting ? 'Creating…' : 'Create Metric'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
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

  const matrixQuery = useQuery({
    queryKey: ['health-matrix', budgetId],
    queryFn: () => getBudgetHealthMatrix(budgetId),
    enabled: !!budgetId,
  })

  const dataSourcesQuery = useQuery({
    queryKey: ['health-data-sources', budgetId],
    queryFn: () => getHealthDataSources(budgetId),
    enabled: !!budgetId,
  })

  const updateMatrixItemMutation = useMutation({
    mutationFn: ({ metricId, data }) => updateMatrixItem(budgetId, metricId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const updatePersonalisationMutation = useMutation({
    mutationFn: ({ metricId, data }) => updateMetricPersonalisation(budgetId, metricId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const createCustomMetricMutation = useMutation({
    mutationFn: data => createCustomMetric(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const removeMatrixItemMutation = useMutation({
    mutationFn: metricId => removeMatrixItem(budgetId, metricId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const [showMetricBuilder, setShowMetricBuilder] = useState(false)

  const setValue = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const setMaximumDeficitAmount = nextValue => {
    const trimmedValue = nextValue.trim()
    if (trimmedValue === '') {
      setValue('maximum_deficit_amount', null)
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
    const timeoutId = globalThis.setTimeout(() => {
      savePersonalisation.mutate(form)
    }, 400)
    return () => globalThis.clearTimeout(timeoutId)
  }, [budget, form, savePersonalisation])

  const resetDefaults = () => {
    setForm(DEFAULTS)
  }

  const handleToneChange = tone => {
    savePersonalisation.mutate({ health_tone: tone })
  }

  const handleCreateMetric = async data => {
    await createCustomMetricMutation.mutateAsync(data)
    setShowMetricBuilder(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Legacy Personalisation Sliders */}
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

      {/* Tone Selector */}
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">Health Tone</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Choose how Dosh speaks to you about your budget health.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TONE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleToneChange(opt.value)}
              className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                (budget?.health_tone || 'supportive') === opt.value
                  ? 'border-dosh-500 bg-dosh-50 dark:border-dosh-400 dark:bg-dosh-950/30'
                  : 'border-gray-200 bg-white hover:border-dosh-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Item Management */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="mb-1 font-semibold text-gray-800 dark:text-gray-100">Health Matrix</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Adjust how each metric contributes to your overall budget health.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMetricBuilder(true)}
            className="btn-primary text-xs"
            disabled={showMetricBuilder}
          >
            + Add Metric
          </button>
        </div>

        {showMetricBuilder && (
          <div className="mb-4">
            <MetricBuilderCard
              dataSources={dataSourcesQuery.data || []}
              onCreate={handleCreateMetric}
              onCancel={() => setShowMetricBuilder(false)}
            />
            {createCustomMetricMutation.isError && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {formatApiError(createCustomMetricMutation.error, 'Unable to create metric.')}
              </div>
            )}
          </div>
        )}

        {matrixQuery.isLoading && <p className="text-sm text-gray-500">Loading matrix…</p>}
        {matrixQuery.isError && (
          <p className="text-sm text-red-600">{formatApiError(matrixQuery.error, 'Unable to load health matrix.')}</p>
        )}
        {matrixQuery.data && (
          <div className="space-y-3">
            {matrixQuery.data.items.map(item => (
              <MatrixItemCard
                key={item.metric_id}
                item={item}
                onUpdate={data => updateMatrixItemMutation.mutate({ metricId: item.metric_id, data })}
                onUpdatePersonalisation={data => updatePersonalisationMutation.mutate({ metricId: item.metric_id, data })}
                onRemove={() => removeMatrixItemMutation.mutate(item.metric_id)}
                allowRemove={!item.template_key}
              />
            ))}
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

MatrixItemCard.propTypes = {
  item: PropTypes.shape({
    metric_id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    weight: PropTypes.number.isRequired,
    scoring_sensitivity: PropTypes.number.isRequired,
    is_enabled: PropTypes.bool.isRequired,
    personalisation_key: PropTypes.string,
    personalisation_value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    template_key: PropTypes.string,
  }).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onUpdatePersonalisation: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  allowRemove: PropTypes.bool,
}

MetricBuilderCard.propTypes = {
  dataSources: PropTypes.arrayOf(PropTypes.shape({
    source_key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    return_type: PropTypes.string.isRequired,
  })).isRequired,
  onCreate: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
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
    health_tone: PropTypes.string,
  }),
}
