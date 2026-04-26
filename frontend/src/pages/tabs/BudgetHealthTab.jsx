import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateBudget, getBudgetHealthMatrix, updateMatrixItem, getAIVendorManifest, getAIConfigStatus, verifyAIKey } from '../../api/client'
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
    const w = Math.max(0, Math.min(1, Number.parseFloat(localWeight) || 0))
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

  const saveAISettings = useMutation({
    mutationFn: data => updateBudget(budgetId, data),
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

      {/* AI Insights Settings */}
      <AIInsightsSettings budgetId={budgetId} budget={budget} saveAISettings={saveAISettings} />
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

function AIInsightsSettings({ budgetId, budget, saveAISettings }) {
  const [aiEnabled, setAiEnabled] = useState(budget?.ai_insights_enabled || false)
  const [provider, setProvider] = useState(budget?.ai_provider || 'openrouter')
  const [model, setModel] = useState(budget?.ai_model || '')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(budget?.ai_base_url || '')
  const [customModel, setCustomModel] = useState(budget?.ai_custom_model || '')
  const [systemPrompt, setSystemPrompt] = useState(budget?.ai_system_prompt || '')
  const [onCloseout, setOnCloseout] = useState(budget?.ai_insights_on_closeout || false)
  const [showKey, setShowKey] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [verifyErrorDetail, setVerifyErrorDetail] = useState(null)

  const manifestQuery = useQuery({
    queryKey: ['ai-vendor-manifest'],
    queryFn: getAIVendorManifest,
    enabled: aiEnabled && provider === 'openrouter',
    staleTime: 5 * 60 * 1000,
  })

  const configStatusQuery = useQuery({
    queryKey: ['ai-config-status'],
    queryFn: getAIConfigStatus,
    staleTime: Infinity,
  })

  const encryptionReady = configStatusQuery.data?.encryption_ready ?? true

  const models = (manifestQuery.data?.models || []).slice().sort((a, b) => a.name.localeCompare(b.name))

  const handleSave = () => {
    const payload = {
      ai_insights_enabled: aiEnabled,
      ai_provider: aiEnabled ? provider : null,
      ai_model: aiEnabled && provider === 'openrouter' ? model : null,
      ai_base_url: aiEnabled && provider === 'openai_compatible' ? baseUrl : null,
      ai_custom_model: aiEnabled && provider === 'openai_compatible' ? customModel : null,
      ai_system_prompt: aiEnabled && systemPrompt ? systemPrompt : null,
      ai_insights_on_closeout: aiEnabled ? onCloseout : false,
    }
    if (apiKey) {
      payload.ai_api_key = apiKey
    }
    saveAISettings.mutate(payload)
  }

  const handleVerify = async () => {
    setVerifyStatus('checking')
    setVerifyErrorDetail(null)
    try {
      const payload = {}
      if (apiKey) payload.api_key = apiKey
      payload.provider = provider
      if (provider === 'openrouter' && model) payload.model = model
      if (provider === 'openai_compatible') {
        if (baseUrl) payload.base_url = baseUrl
        if (customModel) payload.custom_model = customModel
      }
      await verifyAIKey(budgetId, payload)
      setVerifyStatus('valid')
    } catch (err) {
      setVerifyStatus('invalid')
      setVerifyErrorDetail(err?.response?.data?.detail || 'Verification failed.')
    }
  }

  const hasKeyConfigured = budget?.ai_api_key_configured || false
  const defaultPrompt = "You are a personal finance advisor. Review the provided budget period data and offer a concise, constructive insight. Lead with what is going well, then mention any watchouts. Keep the tone {tone}. Be specific and evidence-based. Avoid generic praise. Respond in plain text, no markdown."

  return (
    <div className="card p-5">
      <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">AI Insights</h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Optionally generate LLM-powered financial insights for your budget periods.
      </p>

      {!encryptionReady && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>AI Insights unavailable.</strong> The server administrator has not configured the encryption secret (DOSH_ENCRYPTION_SECRET). Contact your administrator to enable AI features.
          </p>
        </div>
      )}

      <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${encryptionReady ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50' : 'border-gray-200 bg-gray-100 opacity-60 dark:border-gray-700 dark:bg-gray-800/30'}`}>
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={e => setAiEnabled(e.target.checked)}
          disabled={!encryptionReady}
          className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
        />
        <span className="space-y-1">
          <span className="block font-medium text-gray-900 dark:text-gray-100">Enable AI Insights</span>
          <span className="block text-gray-600 dark:text-gray-400">
            When enabled, you can generate AI-powered insights from the Budget Cycle Details page.
          </span>
        </span>
      </label>

      {aiEnabled && (
        <>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your financial data will be sent to a third-party AI provider. Review the provider&apos;s privacy policy before enabling.
            </p>
          </div>

          <div className="mt-4">
            <label className="label">Provider</label>
            <select
              className="input"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            >
              <option value="openrouter">OpenRouter (recommended)</option>
              <option value="openai_compatible">OpenAI-compatible (custom)</option>
            </select>
          </div>

          {provider === 'openrouter' && (
            <>
              <div className="mt-4">
                <label className="label">Model</label>
                <select
                  className="input"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                >
                  <option value="">Select a model...</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {manifestQuery.isLoading && <p className="mt-1 text-xs text-gray-500">Loading models...</p>}
                {manifestQuery.isError && <p className="mt-1 text-xs text-red-500">Unable to load model list.</p>}
              </div>
              <div className="mt-2">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-dosh-700 hover:underline dark:text-dosh-300"
                >
                  Get an OpenRouter API key →
                </a>
              </div>
            </>
          )}

          {provider === 'openai_compatible' && (
            <>
              <div className="mt-4">
                <label className="label">Base URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="http://localhost:11434/v1"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="mt-4">
                <label className="label">Custom Model Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="llama3.2"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="mt-4">
            <label className="label">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                className="input flex-1"
                placeholder={hasKeyConfigured ? '•••••••• (configured)' : 'Enter API key...'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setShowKey(v => !v)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {hasKeyConfigured && !apiKey && (
              <p className="mt-1 text-xs text-gray-500">A key is already configured. Enter a new one to replace it, or leave blank to keep it.</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleVerify}
                disabled={!hasKeyConfigured && !apiKey}
              >
                Verify Key
              </button>
              {verifyStatus === 'checking' && <span className="text-xs text-gray-500">Checking...</span>}
              {verifyStatus === 'valid' && <span className="text-xs text-green-600">Key is valid</span>}
              {verifyStatus === 'invalid' && <span className="text-xs text-red-600">Key is invalid</span>}
            </div>
            {verifyStatus === 'invalid' && verifyErrorDetail && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/20">
                <p className="text-xs text-red-800 dark:text-red-300">{verifyErrorDetail}</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="label">System Prompt</label>
            <textarea
              className="input w-full resize-none"
              rows={4}
              value={systemPrompt || defaultPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              maxLength={2000}
            />
            <div className="mt-1 flex justify-between">
              <button
                type="button"
                className="text-xs text-dosh-700 hover:underline dark:text-dosh-300"
                onClick={() => setSystemPrompt(defaultPrompt)}
              >
                Reset to default
              </button>
              <span className="text-xs text-gray-500">{(systemPrompt || defaultPrompt).length} / 2000</span>
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
            <input
              type="checkbox"
              checked={onCloseout}
              onChange={e => setOnCloseout(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-dosh-600 focus:ring-dosh-500 dark:border-gray-600"
            />
            <span className="space-y-1">
              <span className="block font-medium text-gray-900 dark:text-gray-100">Generate AI Insight on Close Out</span>
              <span className="block text-gray-600 dark:text-gray-400">
                When closing a budget cycle, automatically generate an AI insight and save it with the close-out snapshot.
              </span>
            </span>
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saveAISettings.isPending}
            >
              {saveAISettings.isPending ? 'Saving...' : 'Save AI Settings'}
            </button>
          </div>

          {saveAISettings.isError && (
            <p className="mt-2 text-sm text-red-600">{formatApiError(saveAISettings.error, 'Unable to save AI settings.')}</p>
          )}
        </>
      )}
    </div>
  )
}

AIInsightsSettings.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    ai_insights_enabled: PropTypes.bool,
    ai_provider: PropTypes.string,
    ai_model: PropTypes.string,
    ai_base_url: PropTypes.string,
    ai_custom_model: PropTypes.string,
    ai_system_prompt: PropTypes.string,
    ai_insights_on_closeout: PropTypes.bool,
    ai_api_key_configured: PropTypes.bool,
  }),
  saveAISettings: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool,
    isError: PropTypes.bool,
    error: PropTypes.object,
  }).isRequired,
}

BudgetHealthTab.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budget: PropTypes.shape({
    health_tone: PropTypes.string,
    ai_insights_enabled: PropTypes.bool,
    ai_provider: PropTypes.string,
    ai_model: PropTypes.string,
    ai_base_url: PropTypes.string,
    ai_custom_model: PropTypes.string,
    ai_system_prompt: PropTypes.string,
    ai_insights_on_closeout: PropTypes.bool,
    ai_api_key_configured: PropTypes.bool,
  }),
}
