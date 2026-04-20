import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPeriodCloseoutPreview, closeOutPeriod } from '../../api/client'
import Spinner from '../../components/Spinner'
import { useFormatters } from '../../components/useFormatters'
import { CurrentPeriodCheckPanel } from '../../pages/BudgetsPage'

const DISMISS_KEY = 'dosh_dismiss_closeout_warning'

function useDismissedWarning() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === 'true' } catch { return false }
  })
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, 'true') } catch { /* ignore */ }
    setDismissed(true)
  }
  return { dismissed, dismiss }
}

export function CloseoutModal({ periodId, budgetId, onClose }) {
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [goals, setGoals] = useState('')
  const [createNextCycle, setCreateNextCycle] = useState(false)
  const [carryForward, setCarryForward] = useState(false)
  const { dismissed: warningDismissed, dismiss: dismissWarning } = useDismissedWarning()
  const formatters = useFormatters()
  const { data: preview, isLoading } = useQuery({
    queryKey: ['period-closeout-preview', periodId],
    queryFn: () => getPeriodCloseoutPreview(budgetId, periodId),
  })

  const closeout = useMutation({
    mutationFn: () => closeOutPeriod(budgetId, periodId, { comments, goals, create_next_cycle: createNextCycle, carry_forward: carryForward }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] })
      qc.invalidateQueries({ queryKey: ['period-balances', periodId] })
      qc.invalidateQueries({ queryKey: ['periods'] })
      qc.invalidateQueries({ queryKey: ['period-summaries'] })
      qc.invalidateQueries({ queryKey: ['budgets'] })
      onClose()
    },
  })

  if (isLoading || !preview) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  const hasPositiveSurplus = Number(preview.carry_forward_amount) > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(preview.totals).map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label.replaceAll('_', ' ')}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatters.fmt(value)}</p>
          </div>
        ))}
      </div>
      {hasPositiveSurplus && (
        <label htmlFor="carry-forward" className="flex items-center gap-2 text-sm cursor-pointer rounded-xl border border-dosh-200 bg-dosh-50 px-4 py-3 text-dosh-900 dark:border-dosh-800 dark:bg-dosh-900/20 dark:text-dosh-100">
          <input id="carry-forward" type="checkbox" checked={carryForward} onChange={e => setCarryForward(e.target.checked)} />
          <span>A surplus amount of {formatters.fmt(preview.carry_forward_amount)} exists for this period. Carry this amount forward to the next budget cycle?</span>
        </label>
      )}
      <CurrentPeriodCheckPanel assessment={preview.health} showMetricCards={false} />
      {!preview.next_cycle_exists && (
        <label htmlFor="create-next-cycle" className="flex items-center gap-2 text-sm cursor-pointer">
          <input id="create-next-cycle" type="checkbox" checked={createNextCycle} onChange={e => setCreateNextCycle(e.target.checked)} />
          <span>Create the next budget cycle automatically during close-out</span>
        </label>
      )}
      <div>
        <label htmlFor="closeout-comments" className="label">Comments / Observations</label>
        <textarea id="closeout-comments" className="input w-full resize-none" rows={4} value={comments} onChange={e => setComments(e.target.value)} />
      </div>
      <div>
        <label htmlFor="closeout-goals" className="label">Goals Going Forward</label>
        <textarea id="closeout-goals" className="input w-full resize-none" rows={4} value={goals} onChange={e => setGoals(e.target.value)} />
      </div>
      {!warningDismissed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Closing a budget cycle makes it read-only and prevents further changes from being made.
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <input
              type="checkbox"
              onChange={e => { if (e.target.checked) dismissWarning() }}
            />
            <span>Don't show this message again</span>
          </label>
        </div>
      )}
      {closeout.isError && <p className="text-sm text-red-600">{closeout.error?.response?.data?.detail || 'Unable to close out this cycle right now.'}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={closeout.isPending || (!preview.next_cycle_exists && !createNextCycle)} onClick={() => closeout.mutate()}>
          {closeout.isPending ? 'Closing…' : 'Close Out Cycle'}
        </button>
      </div>
    </div>
  )
}

CloseoutModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
}
