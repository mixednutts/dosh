import { useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPeriodCloseoutPreview, closeOutPeriod } from '../../api/client'
import Spinner from '../../components/Spinner'
import { useFormatters } from '../../components/useFormatters'

export function CloseoutModal({ periodId, onClose }) {
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [goals, setGoals] = useState('')
  const [createNextCycle, setCreateNextCycle] = useState(false)
  const formatters = useFormatters()
  const { data: preview, isLoading } = useQuery({
    queryKey: ['period-closeout-preview', periodId],
    queryFn: () => getPeriodCloseoutPreview(periodId),
  })

  const closeout = useMutation({
    mutationFn: () => closeOutPeriod(periodId, { comments, goals, create_next_cycle: createNextCycle }),
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
      <div className="rounded-xl border border-dosh-200 bg-dosh-50 px-4 py-3 text-sm text-dosh-900 dark:border-dosh-800 dark:bg-dosh-900/20 dark:text-dosh-100">
        <p className="font-semibold">Carry Forward</p>
        <p className="mt-1">{formatters.fmt(preview.carry_forward_amount)} will be placed into the next cycle as a `Carried Forward` income budget line.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.health.summary}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Score {preview.health.score} • {preview.health.status}</p>
      </div>
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
        Closing this cycle makes it read-only. Any later corrections should be handled through reconciliation.
      </div>
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
