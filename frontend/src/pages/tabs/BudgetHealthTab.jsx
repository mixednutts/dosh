import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateBudget, getBudgetHealthMatrix, updateMatrixItem } from '../../api/client'
import LocalizedAmountInput from '../../components/LocalizedAmountInput'

const TONE_OPTIONS = [
  { value: 'supportive', label: 'Supportive', description: 'Encouraging and gentle feedback' },
  { value: 'factual', label: 'Factual', description: 'Straightforward and neutral' },
  { value: 'friendly', label: 'Friendly', description: 'Casual and upbeat tone' },
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

function IntInput({ value, onChange, label, helper }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      {helper && <p className="text-[11px] text-gray-500 dark:text-gray-400">{helper}</p>}
      <input
        type="number"
        min={0}
        step={1}
        value={value ?? 0}
        onChange={e => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="mt-1 w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
        aria-label={label}
      />
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
      <label className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-dosh-700 shadow-sm dark:bg-gray-900 dark:text-dosh-300">
        <LocalizedAmountInput
          value={value === null || value === undefined ? '' : String(value)}
          onChange={onChange}
          min="0"
          placeholder="0"
          className="w-24 border-0 bg-transparent p-0 text-right text-xs font-semibold text-dosh-700 outline-none focus:ring-0 dark:text-dosh-300"
          ariaLabel={label}
        />
      </label>
    </div>
  )
}

function MatrixItemCard({ item, onUpdate }) {
  const [localWeight, setLocalWeight] = useState(item.weight)
  const [localSensitivity, setLocalSensitivity] = useState(item.scoring_sensitivity)
  const [localEnabled, setLocalEnabled] = useState(item.is_enabled)
  const [localParams, setLocalParams] = useState(item.parameters || {})
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    setLocalWeight(item.weight)
    setLocalSensitivity(item.scoring_sensitivity)
    setLocalEnabled(item.is_enabled)
    setLocalParams(item.parameters || {})
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

  const commitParameter = (key, value) => {
    const next = { ...localParams, [key]: value }
    setLocalParams(next)
    onUpdate({ parameters: { [key]: value } })
  }

  return (
    <div className={`rounded-lg border px-4 py-3 dark:border-gray-700 ${localEnabled ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 opacity-70 dark:bg-gray-800/60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
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
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`weight-${item.metric_key}`} className="text-xs font-medium text-gray-600 dark:text-gray-300">Weight</label>
              <div className="flex items-center gap-2">
                <input
                  id={`weight-${item.metric_key}`}
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
              <label htmlFor={`sensitivity-${item.metric_key}`} className="text-xs font-medium text-gray-600 dark:text-gray-300">Scoring Sensitivity</label>
              <div className="flex items-center gap-2">
                <input
                  id={`sensitivity-${item.metric_key}`}
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

          {item.metric_key === 'setup_health' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <IntInput
                  label="Minimum income lines"
                  helper="At least this many income sources"
                  value={localParams.min_income_lines ?? 1}
                  onChange={v => commitParameter('min_income_lines', v)}
                />
                <IntInput
                  label="Minimum expense lines"
                  helper="At least this many active expenses"
                  value={localParams.min_expense_lines ?? 1}
                  onChange={v => commitParameter('min_expense_lines', v)}
                />
                <IntInput
                  label="Minimum investment lines"
                  helper="At least this many active investments"
                  value={localParams.min_investment_lines ?? 1}
                  onChange={v => commitParameter('min_investment_lines', v)}
                />
              </div>
            </div>
          )}

          {item.metric_key === 'budget_vs_actual_amount' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CurrencyInput
                  label="Upper tolerance amount"
                  helper="Dollar amount above budgeted expenses"
                  value={localParams.upper_tolerance_amount ?? 50}
                  onChange={v => commitParameter('upper_tolerance_amount', Number(v) || 0)}
                />
                <PercentSlider
                  label="Upper tolerance percentage"
                  helper="Percentage of total budgeted expenses"
                  value={localParams.upper_tolerance_pct ?? 5}
                  min={0}
                  max={100}
                  onChange={v => commitParameter('upper_tolerance_pct', v)}
                />
              </div>
            </div>
          )}

          {item.metric_key === 'budget_vs_actual_lines' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <IntInput
                  label="Upper tolerance instances"
                  helper="Number of over-budget lines allowed"
                  value={localParams.upper_tolerance_instances ?? 2}
                  onChange={v => commitParameter('upper_tolerance_instances', v)}
                />
                <PercentSlider
                  label="Upper tolerance percentage"
                  helper="Percentage of total expense lines"
                  value={localParams.upper_tolerance_pct ?? 10}
                  min={0}
                  max={100}
                  onChange={v => commitParameter('upper_tolerance_pct', v)}
                />
              </div>
            </div>
          )}

          {item.metric_key === 'in_cycle_budget_adjustments' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <IntInput
                  label="Upper tolerance instances"
                  helper="Number of budget adjustment transactions allowed"
                  value={localParams.upper_tolerance_instances ?? 1}
                  onChange={v => commitParameter('upper_tolerance_instances', v)}
                />
              </div>
            </div>
          )}

          {item.metric_key === 'revisions_on_paid_expenses' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <IntInput
                  label="Upper tolerance instances"
                  helper="Number of revision transactions allowed"
                  value={localParams.upper_tolerance_instances ?? 2}
                  onChange={v => commitParameter('upper_tolerance_instances', v)}
                />
              </div>
            </div>
          )}

          {item.metric_key === 'budget_cycles_pending_closeout' && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">Parameters</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <IntInput
                  label="Upper tolerance instances"
                  helper="Number of budget cycles pending close-out allowed"
                  value={localParams.upper_tolerance_instances ?? 0}
                  onChange={v => commitParameter('upper_tolerance_instances', v)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BudgetHealthTab({ budgetId, budget }) {
  const qc = useQueryClient()

  const matrixQuery = useQuery({
    queryKey: ['health-matrix', budgetId],
    queryFn: () => getBudgetHealthMatrix(budgetId),
    enabled: !!budgetId,
  })

  const updateMatrixItemMutation = useMutation({
    mutationFn: ({ metricKey, data }) => updateMatrixItem(budgetId, metricKey, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-matrix', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const saveTone = useMutation({
    mutationFn: tone => updateBudget(budgetId, { health_tone: tone }),
    onSuccess: data => {
      qc.setQueryData(['budget', budgetId], data)
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  const items = matrixQuery.data?.items || []
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

      {matrixQuery.isError && !hasMatrix && (
        <p className="text-sm text-red-600">{formatApiError(matrixQuery.error, 'Unable to load health matrix.')}</p>
      )}

      {/* Matrix Item Management */}
      {hasMatrix && (
        <div className="card p-5">
          <div className="mb-4">
            <h3 className="mb-1 font-semibold text-gray-800 dark:text-gray-100">Health Metrics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Adjust how each metric contributes to your overall budget health.
            </p>
          </div>

          <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
            Weights are automatically normalised to 100% by the engine.
          </p>

          <div className="space-y-3">
            {items.map(item => (
              <MatrixItemCard
                key={item.metric_key}
                item={item}
                onUpdate={data => updateMatrixItemMutation.mutate({ metricKey: item.metric_key, data })}
              />
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No metrics configured.</p>
            )}
          </div>
        </div>
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

IntInput.propTypes = {
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

MatrixItemCard.propTypes = {
  item: PropTypes.shape({
    metric_key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    scope: PropTypes.string,
    weight: PropTypes.number.isRequired,
    scoring_sensitivity: PropTypes.number.isRequired,
    is_enabled: PropTypes.bool.isRequired,
    parameters: PropTypes.object,
  }).isRequired,
  onUpdate: PropTypes.func.isRequired,
}

BudgetHealthTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    health_tone: PropTypes.string,
  }),
}
