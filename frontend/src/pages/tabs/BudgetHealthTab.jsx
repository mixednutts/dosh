import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  updateBudget,
  getBudgetHealthMatrix,
  getHealthDataSources,
  getHealthScales,
  createCustomMetric,
  removeMatrixItem,
  updateMatrixItem,
  getHealthMatrixTemplates,
  applyHealthMatrixTemplate,
  deleteBudgetHealthMatrix,
  createEmptyHealthMatrix,
  saveHealthMatrixTemplate,
  deleteHealthMatrixTemplate,
  getAppInfo,
} from '../../api/client'
import LocalizedAmountInput from '../../components/LocalizedAmountInput'

const TONE_OPTIONS = [
  { value: 'supportive', label: 'Supportive', description: 'Encouraging and gentle feedback' },
  { value: 'factual', label: 'Factual', description: 'Straightforward and neutral' },
  { value: 'friendly', label: 'Friendly', description: 'Casual and upbeat tone' },
]

const SCOPE_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'OVERALL', label: 'Overall' },
  { key: 'CURRENT_PERIOD', label: 'Current Period' },
  { key: 'BOTH', label: 'Both' },
]

function formatApiError(error, fallback) {
  return error?.response?.data?.detail || fallback
}

function sliderTrackStyle(valuePercent) {
  return {
    background: `linear-gradient(to right, rgb(13 148 136) 0%, rgb(13 148 136) ${valuePercent}%, rgb(229 231 235) ${valuePercent}%, rgb(229 231 235) 100%)`,
  }
}

function PercentSlider({ value, onChange, min = 0, max = 100, label, helper }) {
  const clamped = Math.max(min, Math.min(max, value ?? min))
  const percent = ((clamped - min) / (max - min)) * 100
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs font-semibold text-dosh-700 dark:text-dosh-300">{clamped}%</span>
      </div>
      {helper && <p className="text-[11px] text-gray-500 dark:text-gray-400">{helper}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={clamped}
        onChange={e => onChange(Number(e.target.value))}
        style={sliderTrackStyle(percent)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-dosh-600 dark:bg-gray-700"
        aria-label={label}
      />
    </div>
  )
}

function TenScaleSlider({ value, onChange, label, helper }) {
  const clamped = Math.max(1, Math.min(10, Math.round(value ?? 5)))
  const percent = ((clamped - 1) / 9) * 100
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs font-semibold text-dosh-700 dark:text-dosh-300">{clamped}/10</span>
      </div>
      {helper && <p className="text-[11px] text-gray-500 dark:text-gray-400">{helper}</p>}
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={clamped}
        onChange={e => onChange(Number(e.target.value))}
        style={sliderTrackStyle(percent)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-dosh-600 dark:bg-gray-700"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  )
}

function CurrencyInput({ value, onChange, label, helper }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      {helper && <p className="text-[11px] text-gray-500 dark:text-gray-400">{helper}</p>}
      <label className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-dosh-700 shadow-sm dark:bg-gray-900 dark:text-dosh-300">
        <LocalizedAmountInput
          value={value === null || value === undefined ? '' : String(value)}
          onChange={onChange}
          min="0"
          placeholder="Optional"
          className="w-24 border-0 bg-transparent p-0 text-right text-xs font-semibold text-dosh-700 outline-none focus:ring-0 dark:text-dosh-300"
          ariaLabel={label}
        />
      </label>
    </div>
  )
}

function ThresholdControl({ scale, value, onChange }) {
  if (!scale) {
    return (
      <input
        type="text"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={e => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
      />
    )
  }

  if (scale.scale_type === 'money') {
    return (
      <CurrencyInput
        value={value}
        onChange={onChange}
        label="Value"
        helper={scale.unit_label ? `Unit: ${scale.unit_label}` : undefined}
      />
    )
  }

  if (scale.scale_type === 'integer_range' && scale.max_value === 10 && scale.min_value === 1) {
    return (
      <TenScaleSlider
        value={value}
        onChange={onChange}
        label="Value"
        helper={scale.unit_label ? `Unit: ${scale.unit_label}` : undefined}
      />
    )
  }

  return (
    <PercentSlider
      value={value}
      onChange={onChange}
      min={scale.min_value ?? 0}
      max={scale.max_value ?? 100}
      label="Value"
      helper={scale.unit_label ? `Unit: ${scale.unit_label}` : undefined}
    />
  )
}

function MatrixItemCard({
  item,
  onUpdate,
  onRemove,
  allowRemove,
}) {
  const [localWeight, setLocalWeight] = useState(item.weight)
  const [localSensitivity, setLocalSensitivity] = useState(item.scoring_sensitivity)
  const [localEnabled, setLocalEnabled] = useState(item.is_enabled)
  const [localThreshold, setLocalThreshold] = useState(item.threshold_value)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    setLocalWeight(item.weight)
    setLocalSensitivity(item.scoring_sensitivity)
    setLocalEnabled(item.is_enabled)
    setLocalThreshold(item.threshold_value)
  }, [item])

  const commitWeight = () => {
    const w = Math.max(0, Math.min(1, parseFloat(localWeight) || 0))
    setLocalWeight(w)
    if (w !== item.weight) onUpdate({ weight: w })
  }

  const commitSensitivity = () => {
    const s = Math.max(0, Math.min(100, Math.round(localSensitivity)))
    setLocalSensitivity(s)
    if (s !== item.scoring_sensitivity) onUpdate({ scoring_sensitivity: s })
  }

  const commitEnabled = next => {
    setLocalEnabled(next)
    onUpdate({ is_enabled: next })
  }

  const commitThreshold = nextValue => {
    setLocalThreshold(nextValue)
    onUpdate({ threshold_value: nextValue })
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
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {item.scope === 'BOTH' ? 'Overall + Current' : item.scope.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800/60">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Weight</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-dosh-500"
                  style={{ width: `${Math.round(localWeight * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{Math.round(localWeight * 100)}%</span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800/60">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Sensitivity</span>
              <span className="ml-1 text-[10px] font-semibold text-gray-700 dark:text-gray-300">{localSensitivity}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(v => !v)}
            className="text-xs text-dosh-700 hover:text-dosh-800 dark:text-dosh-300 dark:hover:text-dosh-200"
          >
            {isExpanded ? 'Hide details' : 'View / Edit'}
          </button>
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

      {isExpanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Formula</p>
            <code className="mt-1 block rounded bg-gray-100 px-2 py-1 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {item.formula_expression}
            </code>
            {item.formula_data_sources_json?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.formula_data_sources_json.map(ds => (
                  <span
                    key={ds}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {ds}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`weight-${item.metric_id}`} className="text-xs font-medium text-gray-600 dark:text-gray-300">Weight</label>
              <div className="flex items-center gap-2">
                <input
                  id={`weight-${item.metric_id}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={localWeight}
                  onChange={e => setLocalWeight(Number.parseFloat(e.target.value))}
                  onMouseUp={commitWeight}
                  onKeyUp={commitWeight}
                  className="w-full accent-dosh-600"
                />
                <span className="w-12 text-right text-xs">{Math.round(localWeight * 100)}%</span>
              </div>
            </div>
            <div>
              <label htmlFor={`sensitivity-${item.metric_id}`} className="text-xs font-medium text-gray-600 dark:text-gray-300">Scoring Sensitivity</label>
              <div className="flex items-center gap-2">
                <input
                  id={`sensitivity-${item.metric_id}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={localSensitivity}
                  onChange={e => setLocalSensitivity(Number.parseInt(e.target.value, 10))}
                  onMouseUp={commitSensitivity}
                  onKeyUp={commitSensitivity}
                  className="w-full accent-dosh-600"
                />
                <span className="w-8 text-right text-xs">{localSensitivity}</span>
              </div>
            </div>
          </div>

          {item.threshold_scale && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                Threshold
                {item.threshold_scale?.unit_label ? (
                  <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">({item.threshold_scale.unit_label})</span>
                ) : null}
              </p>
              <ThresholdControl
                scale={item.threshold_scale}
                value={localThreshold}
                onChange={commitThreshold}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricBuilderCard({ dataSources, scales, onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState('OVERALL')
  const [formula, setFormula] = useState('')
  const [scaleKey, setScaleKey] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formulaRef = useRef(null)

  const selectedScale = useMemo(() => scales.find(s => s.scale_key === scaleKey) || null, [scales, scaleKey])

  const insertAtCursor = text => {
    const input = formulaRef.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const before = formula.slice(0, start)
    const after = formula.slice(end)
    const spacer = before && !before.endsWith(' ') ? ' ' : ''
    const trailing = after && !after.startsWith(' ') ? ' ' : ''
    const next = `${before}${spacer}${text}${trailing}${after}`
    setFormula(next)
    requestAnimationFrame(() => {
      input.focus()
      const pos = start + spacer.length + text.length + trailing.length
      input.setSelectionRange(pos, pos)
    })
  }

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

    const sourceKeys = dataSources.map(ds => ds.source_key)
    const usedSources = sourceKeys.filter(key => trimmedFormula.includes(key))

    let payloadDefaultValue = undefined
    if (scaleKey && defaultValue !== '') {
      if (selectedScale?.scale_type === 'money') {
        payloadDefaultValue = Number(defaultValue)
      } else if (selectedScale?.scale_type === 'integer_range') {
        payloadDefaultValue = Number.parseInt(defaultValue, 10)
      } else {
        payloadDefaultValue = defaultValue
      }
    }

    setIsSubmitting(true)
    try {
      await onCreate({
        name: trimmedName,
        description: description.trim(),
        scope,
        formula_expression: trimmedFormula,
        data_sources: usedSources,
        scale_key: scaleKey || undefined,
        default_value: payloadDefaultValue,
      })
      setName('')
      setDescription('')
      setFormula('')
      setScaleKey('')
      setDefaultValue('')
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
          <label htmlFor="metric-builder-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Name</label>
          <input
            id="metric-builder-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Savings Rate"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="metric-builder-desc" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Description (optional)</label>
          <input
            id="metric-builder-desc"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of what this metric measures"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="metric-builder-scope" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Scope</label>
          <select
            id="metric-builder-scope"
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
          <label htmlFor="metric-builder-formula" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Formula</label>
          <input
            id="metric-builder-formula"
            ref={formulaRef}
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
                onClick={() => insertAtCursor(ds.source_key)}
                className="mb-1 mr-1 inline-block rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                title={ds.description}
              >
                {ds.source_key}
              </button>
            ))}
          </div>
        </div>

        {scales.length > 0 && (
          <div>
            <label htmlFor="metric-builder-scale" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Scale (optional)</label>
            <select
              id="metric-builder-scale"
              value={scaleKey}
              onChange={e => {
                setScaleKey(e.target.value)
                setDefaultValue('')
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">None</option>
              {scales.map(s => (
                <option key={s.scale_key} value={s.scale_key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedScale && (
          <div>
            <label htmlFor="metric-builder-default" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Default Value (optional)</label>
            {selectedScale.scale_type === 'money' ? (
              <LocalizedAmountInput
                id="metric-builder-default"
                value={defaultValue}
                onChange={setDefaultValue}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            ) : (
              <input
                id="metric-builder-default"
                type="number"
                min={selectedScale.min_value ?? undefined}
                max={selectedScale.max_value ?? undefined}
                value={defaultValue}
                onChange={e => setDefaultValue(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            )}
          </div>
        )}

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

function TemplateSelector({ matrix, templates, onApply, isApplying, onDeleteMatrix, onCreateEmpty, isDeleting, devMode, onSaveTemplate, onDeleteTemplate, isDeletingTemplate }) {
  const [selected, setSelected] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDeleteWarning, setShowDeleteWarning] = useState(false)

  useEffect(() => {
    if (matrix?.based_on_template_key) {
      setSelected(matrix.based_on_template_key)
    } else if (templates.length > 0) {
      setSelected(templates[0].template_key)
    }
  }, [matrix?.based_on_template_key, templates])

  const handleApply = () => {
    if (!selected) return
    if (matrix?.is_customized) {
      setShowConfirm(true)
      return
    }
    onApply(selected)
  }

  const handleReset = () => {
    if (matrix?.based_on_template_key) {
      if (matrix?.is_customized) {
        setSelected(matrix.based_on_template_key)
        setShowConfirm(true)
        return
      }
      onApply(matrix.based_on_template_key)
    }
  }

  const selectedTemplate = templates.find(t => t.template_key === selected)
  const canDeleteTemplate = devMode && selectedTemplate

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Health Matrix Template</h3>
            {matrix?.is_customized && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Customized
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {matrix?.template_name ? `Current: ${matrix.template_name}` : matrix?.name ? `Current: ${matrix.name}` : 'No health matrix is configured for this budget.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {matrix ? (
            <>
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900"
              >
                {templates.map(t => (
                  <option key={t.template_key} value={t.template_key}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || !selected || selected === matrix?.based_on_template_key}
                className="btn-primary text-xs"
              >
                {isApplying ? 'Applying…' : 'Apply'}
              </button>
              {matrix?.is_customized && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isApplying}
                  className="btn-secondary text-xs"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteMatrix}
                disabled={isDeleting}
                className="btn-danger text-xs"
              >
                {isDeleting ? 'Deleting…' : 'Delete Matrix'}
              </button>
              {devMode && (
                <button
                  type="button"
                  onClick={onSaveTemplate}
                  className="btn-secondary text-xs"
                >
                  Save as Template
                </button>
              )}
              {canDeleteTemplate && (
                <button
                  type="button"
                  onClick={() => setShowDeleteWarning(true)}
                  disabled={isDeletingTemplate}
                  className="btn-danger text-xs"
                >
                  {isDeletingTemplate ? 'Deleting…' : 'Delete Template'}
                </button>
              )}
            </>
          ) : (
            <>
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900"
              >
                {templates.map(t => (
                  <option key={t.template_key} value={t.template_key}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || !selected}
                className="btn-primary text-xs"
              >
                {isApplying ? 'Applying…' : 'Create from Template'}
              </button>
              <button
                type="button"
                onClick={onCreateEmpty}
                disabled={isApplying}
                className="btn-secondary text-xs"
              >
                Create Empty Matrix
              </button>
              {canDeleteTemplate && (
                <button
                  type="button"
                  onClick={() => setShowDeleteWarning(true)}
                  disabled={isDeletingTemplate}
                  className="btn-danger text-xs"
                >
                  {isDeletingTemplate ? 'Deleting…' : 'Delete Template'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showDeleteWarning && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-xs text-red-800 dark:text-red-300">
            <strong>Warning:</strong> Deleting this template will also remove all metrics derived from it from every budget. This cannot be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-danger text-xs"
              onClick={() => {
                setShowDeleteWarning(false)
                onDeleteTemplate(selected)
              }}
            >
              Delete anyway
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setShowDeleteWarning(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Your current matrix has customizations. Applying a template will replace them.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-danger text-xs"
              onClick={() => {
                setShowConfirm(false)
                onApply(selected)
              }}
            >
              Replace anyway
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SaveTemplateDialog({ templates, onSave, onCancel, isSaving }) {
  const [mode, setMode] = useState('new')
  const [selectedKey, setSelectedKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false)

  useEffect(() => {
    if (templates.length > 0) {
      setSelectedKey(templates[0].template_key)
    }
  }, [templates])

  const handleSave = () => {
    if (mode === 'existing') {
      const existing = templates.find(t => t.template_key === selectedKey)
      if (existing && !showOverwriteWarning) {
        setShowOverwriteWarning(true)
        return
      }
      onSave({ template_key: selectedKey, name: existing?.name || selectedKey, description, overwrite: true })
    } else {
      if (!name.trim()) return
      const key = name.trim().toLowerCase().replace(/\s+/g, '_')
      onSave({ template_key: key, name: name.trim(), description, overwrite: false })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Save Matrix as Template</h4>

        <div className="mb-3 flex gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="save-template-mode"
              checked={mode === 'new'}
              onChange={() => { setMode('new'); setShowOverwriteWarning(false) }}
            />
            New template
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="save-template-mode"
              checked={mode === 'existing'}
              onChange={() => { setMode('existing'); setShowOverwriteWarning(false) }}
            />
            Overwrite existing
          </label>
        </div>

        {mode === 'existing' ? (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Select template</label>
            <select
              value={selectedKey}
              onChange={e => { setSelectedKey(e.target.value); setShowOverwriteWarning(false) }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              {templates.map(t => (
                <option key={t.template_key} value={t.template_key}>{t.name}</option>
              ))}
            </select>
            {showOverwriteWarning && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Warning: This will overwrite the selected template with the current matrix metrics.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Template name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., My Custom Template"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (mode === 'new' && !name.trim())}
            className="btn-primary text-xs"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BudgetHealthTab({ budgetId, budget }) {
  const qc = useQueryClient()
  const [activeScope, setActiveScope] = useState('ALL')
  const [showMetricBuilder, setShowMetricBuilder] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const appInfoQuery = useQuery({
    queryKey: ['app-info'],
    queryFn: getAppInfo,
    staleTime: 300_000,
  })
  const devMode = !!appInfoQuery.data?.dev_mode

  const matrixQuery = useQuery({
    queryKey: ['health-matrix', budgetId],
    queryFn: () => getBudgetHealthMatrix(budgetId),
    enabled: !!budgetId,
  })

  const templatesQuery = useQuery({
    queryKey: ['health-matrix-templates'],
    queryFn: () => getHealthMatrixTemplates(budgetId),
    enabled: !!budgetId,
  })

  const dataSourcesQuery = useQuery({
    queryKey: ['health-data-sources', budgetId],
    queryFn: () => getHealthDataSources(budgetId),
    enabled: !!budgetId,
  })

  const scalesQuery = useQuery({
    queryKey: ['health-scales', budgetId],
    queryFn: () => getHealthScales(budgetId),
    enabled: !!budgetId,
  })

  const updateMatrixItemMutation = useMutation({
    mutationFn: ({ metricId, data }) => updateMatrixItem(budgetId, metricId, data),
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

  const applyTemplateMutation = useMutation({
    mutationFn: templateKey => applyHealthMatrixTemplate(budgetId, { template_key: templateKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const deleteMatrixMutation = useMutation({
    mutationFn: () => deleteBudgetHealthMatrix(budgetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const createEmptyMatrixMutation = useMutation({
    mutationFn: () => createEmptyHealthMatrix(budgetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const saveTemplateMutation = useMutation({
    mutationFn: data => saveHealthMatrixTemplate(budgetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix-templates'] })
      setShowSaveTemplate(false)
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: templateKey => deleteHealthMatrixTemplate(budgetId, templateKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix-templates'] })
    },
  })

  const saveTone = useMutation({
    mutationFn: tone => updateBudget(budgetId, { health_tone: tone }),
    onSuccess: data => {
      qc.setQueryData(['budget', budgetId], data)
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  const handleCreateMetric = async data => {
    await createCustomMetricMutation.mutateAsync(data)
    setShowMetricBuilder(false)
  }

  const filteredItems = useMemo(() => {
    const items = matrixQuery.data?.items || []
    if (activeScope === 'ALL') return items
    return items.filter(i => i.scope === activeScope || i.scope === 'BOTH')
  }, [matrixQuery.data, activeScope])

  const hasMatrix = !!matrixQuery.data && !matrixQuery.isError

  return (
    <div className="max-w-3xl space-y-6">
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
              onClick={() => saveTone.mutate(opt.value)}
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

      {/* Template Selector */}
      {(Array.isArray(templatesQuery.data) && templatesQuery.data.length > 0 || devMode) && (
        <TemplateSelector
          matrix={hasMatrix ? matrixQuery.data : null}
          templates={templatesQuery.data || []}
          onApply={key => applyTemplateMutation.mutate(key)}
          isApplying={applyTemplateMutation.isPending}
          onDeleteMatrix={() => deleteMatrixMutation.mutate()}
          onCreateEmpty={() => createEmptyMatrixMutation.mutate()}
          isDeleting={deleteMatrixMutation.isPending}
          devMode={devMode}
          onSaveTemplate={() => setShowSaveTemplate(true)}
          onDeleteTemplate={key => deleteTemplateMutation.mutate(key)}
          isDeletingTemplate={deleteTemplateMutation.isPending}
        />
      )}

      {matrixQuery.isError && !hasMatrix && (
        <p className="text-sm text-red-600">{formatApiError(matrixQuery.error, 'Unable to load health matrix.')}</p>
      )}

      {/* Matrix Item Management */}
      {hasMatrix && (
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

          <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
            Weights are automatically normalized to 100% by the engine.
          </p>

          {/* Scope filter tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {SCOPE_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveScope(tab.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeScope === tab.key
                    ? 'border-dosh-600 bg-dosh-50 text-dosh-700 dark:border-dosh-500 dark:bg-dosh-900/30 dark:text-dosh-300'
                    : 'border-gray-300 text-gray-600 hover:border-dosh-300 hover:text-dosh-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-dosh-700 dark:hover:text-dosh-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {showMetricBuilder && (
            <div className="mb-4">
              <MetricBuilderCard
                dataSources={dataSourcesQuery.data || []}
                scales={scalesQuery.data || []}
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

          <div className="space-y-3">
            {filteredItems.map(item => (
              <MatrixItemCard
                key={item.metric_id}
                item={item}
                onUpdate={data => updateMatrixItemMutation.mutate({ metricId: item.metric_id, data })}
                onRemove={() => removeMatrixItemMutation.mutate(item.metric_id)}
                allowRemove={!item.template_key}
              />
            ))}
            {filteredItems.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No metrics match the selected scope.</p>
            )}
          </div>
        </div>
      )}

      {showSaveTemplate && (
        <SaveTemplateDialog
          templates={templatesQuery.data || []}
          onSave={data => saveTemplateMutation.mutate(data)}
          onCancel={() => setShowSaveTemplate(false)}
          isSaving={saveTemplateMutation.isPending}
        />
      )}
    </div>
  )
}

PercentSlider.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  label: PropTypes.string,
  helper: PropTypes.string,
}

TenScaleSlider.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  helper: PropTypes.string,
}

CurrencyInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  helper: PropTypes.string,
}

ThresholdControl.propTypes = {
  scale: PropTypes.shape({
    scale_type: PropTypes.string,
    min_value: PropTypes.number,
    max_value: PropTypes.number,
    unit_label: PropTypes.string,
  }),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
}

MatrixItemCard.propTypes = {
  item: PropTypes.shape({
    metric_id: PropTypes.number.isRequired,
    template_key: PropTypes.string,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    scope: PropTypes.string,
    formula_expression: PropTypes.string,
    formula_data_sources_json: PropTypes.arrayOf(PropTypes.string),
    weight: PropTypes.number.isRequired,
    scoring_sensitivity: PropTypes.number.isRequired,
    is_enabled: PropTypes.bool.isRequired,
    threshold_value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    threshold_scale: PropTypes.shape({
      scale_type: PropTypes.string,
      min_value: PropTypes.number,
      max_value: PropTypes.number,
      unit_label: PropTypes.string,
    }),
  }).isRequired,
  onUpdate: PropTypes.func.isRequired,
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
  scales: PropTypes.arrayOf(PropTypes.shape({
    scale_key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    scale_type: PropTypes.string,
    min_value: PropTypes.number,
    max_value: PropTypes.number,
    unit_label: PropTypes.string,
  })).isRequired,
  onCreate: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

TemplateSelector.propTypes = {
  matrix: PropTypes.shape({
    based_on_template_key: PropTypes.string,
    template_name: PropTypes.string,
    name: PropTypes.string,
    is_customized: PropTypes.bool,
  }),
  templates: PropTypes.arrayOf(PropTypes.shape({
    template_key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    is_system: PropTypes.bool,
  })).isRequired,
  onApply: PropTypes.func.isRequired,
  isApplying: PropTypes.bool,
  onDeleteMatrix: PropTypes.func.isRequired,
  onCreateEmpty: PropTypes.func.isRequired,
  isDeleting: PropTypes.bool,
  devMode: PropTypes.bool,
  onSaveTemplate: PropTypes.func.isRequired,
  onDeleteTemplate: PropTypes.func.isRequired,
  isDeletingTemplate: PropTypes.bool,
}

SaveTemplateDialog.propTypes = {
  templates: PropTypes.arrayOf(PropTypes.shape({
    template_key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    is_system: PropTypes.bool,
  })).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
}

BudgetHealthTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    health_tone: PropTypes.string,
  }),
}
