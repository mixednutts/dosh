import { format, parseISO } from 'date-fns'
import Modal from './Modal'
import Spinner from './Spinner'

const fmt = v => Number(v ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

function categoryLabel(category) {
  if (category === 'income') return 'Income Type'
  if (category === 'expense') return 'Expense Item'
  if (category === 'investment') return 'Investment Line'
  return 'Item'
}

export default function SetupItemHistoryModal({ historyQuery, itemDesc, category, onClose }) {
  const { data, isLoading, error } = historyQuery
  const title = `History Details — ${itemDesc}`

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {categoryLabel(category)}
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{itemDesc}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Revision</p>
              <p className="text-sm font-semibold text-dosh-700 dark:text-dosh-300">{data?.current_revisionnum ?? 0}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner className="w-5 h-5" /></div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error?.response?.data?.detail || 'Unable to load history details right now.'}
          </div>
        ) : data?.entries?.length ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Budget Adjustment History
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[28rem] overflow-y-auto">
              {data.entries.map(entry => (
                <div key={entry.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {fmt(entry.budget_before_amount)} {'->'} {fmt(entry.budget_after_amount)}
                    </div>
                    <span className="badge-blue">{entry.budget_scope === 'future' ? 'Current + Future' : 'Current Only'}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Period {entry.period_startdate ? format(parseISO(entry.period_startdate), 'dd MMM yyyy') : '—'}
                    {' '}to{' '}
                    {entry.period_enddate ? format(parseISO(entry.period_enddate), 'dd MMM yyyy') : '—'}
                  </div>
                  {entry.note && <div className="text-sm text-gray-600 dark:text-gray-300">{entry.note}</div>}
                  <div className="text-xs text-gray-400">
                    Logged {format(parseISO(entry.entrydate), 'dd MMM yyyy HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No budget adjustment history has been recorded for this item yet.
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  )
}
