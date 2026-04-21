import { useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation } from '@tanstack/react-query'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { backupBudget, inspectRestoreFile, applyRestore } from '../../api/client'
import Spinner from '../Spinner'

const TABS = ['Backup', 'Restore']

function WarningBanner({ children, variant = 'warning' }) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200',
  }
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${styles[variant]}`}>
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function BackupRestoreModal({ budgets, onClose }) {
  const [activeTab, setActiveTab] = useState('Backup')
  const [backupTarget, setBackupTarget] = useState('all')
  const [selectedBudgetId, setSelectedBudgetId] = useState('')

  const [restoreFile, setRestoreFile] = useState(null)
  const [inspectData, setInspectData] = useState(null)
  const [selectedRestoreIndices, setSelectedRestoreIndices] = useState(new Set())
  const [allowOverwrite, setAllowOverwrite] = useState(false)
  const [restoreResult, setRestoreResult] = useState(null)

  const backupMutation = useMutation({
    mutationFn: () => backupBudget(backupTarget === 'single' ? Number(selectedBudgetId) : null),
    onSuccess: () => {
      // File downloaded via triggerBrowserDownload
    },
    onError: (error) => {
      globalThis.alert(error?.response?.data?.detail || 'Backup failed.')
    },
  })

  const inspectMutation = useMutation({
    mutationFn: (file) => inspectRestoreFile(file),
    onSuccess: (data) => {
      setInspectData(data)
      setSelectedRestoreIndices(new Set(data.budgets.map(b => b.index)))
    },
    onError: (error) => {
      globalThis.alert(error?.response?.data?.detail || 'Unable to read backup file.')
      setInspectData(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () =>
      applyRestore(
        restoreFile,
        Array.from(selectedRestoreIndices),
        allowOverwrite
      ),
    onSuccess: (data) => {
      setRestoreResult(data)
    },
    onError: (error) => {
      globalThis.alert(error?.response?.data?.detail || 'Restore failed.')
    },
  })

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setRestoreFile(file)
    setInspectData(null)
    setRestoreResult(null)
    inspectMutation.mutate(file)
  }

  const toggleRestoreIndex = (index) => {
    setSelectedRestoreIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const canRestore =
    inspectData &&
    inspectData.compatibility !== 'newer_backup' &&
    selectedRestoreIndices.size > 0

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setRestoreResult(null) }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-dosh-700 shadow-sm dark:bg-gray-700 dark:text-dosh-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'Backup' ? <ArrowDownTrayIcon className="mr-1.5 inline h-4 w-4" /> : <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Backup' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            <ShieldExclamationIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <span>Backup files are stored as unencrypted JSON on your computer. Keep them in a safe location.</span>
          </div>

          <fieldset className="space-y-2">
            <legend className="label">Backup scope</legend>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
              <input
                type="radio"
                name="backup-scope"
                value="all"
                checked={backupTarget === 'all'}
                onChange={() => setBackupTarget('all')}
              />
              <span>
                <span className="block font-medium text-gray-900 dark:text-gray-100">All budgets</span>
                <span className="block text-gray-500 dark:text-gray-400">Backup every budget and all associated data.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
              <input
                type="radio"
                name="backup-scope"
                value="single"
                checked={backupTarget === 'single'}
                onChange={() => setBackupTarget('single')}
              />
              <span>
                <span className="block font-medium text-gray-900 dark:text-gray-100">Selected budget</span>
                <span className="block text-gray-500 dark:text-gray-400">Backup a single budget only.</span>
              </span>
            </label>
          </fieldset>

          {backupTarget === 'single' && (
            <div>
              <label className="label">Select budget</label>
              <select
                className="input w-full"
                value={selectedBudgetId}
                onChange={e => setSelectedBudgetId(e.target.value)}
              >
                <option value="">Choose a budget…</option>
                {budgets.map(b => (
                  <option key={b.budgetid} value={b.budgetid}>{b.description || 'Untitled'} — {b.budgetowner}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={backupMutation.isPending || (backupTarget === 'single' && !selectedBudgetId)}
              onClick={() => backupMutation.mutate()}
            >
              {backupMutation.isPending ? 'Creating backup…' : 'Download Backup'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Restore' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            <ShieldExclamationIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <span>Backup files are unencrypted. Only restore files from a trusted source.</span>
          </div>

          {!restoreResult && (
            <>
              <div>
                <label htmlFor="restore-file" className="label">Backup file</label>
                <input
                  id="restore-file"
                  type="file"
                  accept=".json,application/json"
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-dosh-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-dosh-500 dark:text-gray-300"
                  onChange={handleFileChange}
                />
              </div>

              {inspectMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Spinner className="h-4 w-4" /> Reading backup file…
                </div>
              )}

              {inspectData && (
                <div className="space-y-3">
                  {inspectData.compatibility === 'exact' && (
                    <WarningBanner variant="info">
                      This backup was created with the same app version ({inspectData.backup_version}).
                    </WarningBanner>
                  )}
                  {inspectData.compatibility === 'older_backup' && (
                    <WarningBanner variant="warning">
                      This backup was created with an older app version ({inspectData.backup_version}). Restore may work, but some newer fields may be missing. Review settings after restore.
                    </WarningBanner>
                  )}
                  {inspectData.compatibility === 'newer_backup' && (
                    <WarningBanner variant="error">
                      This backup was created with a newer app version ({inspectData.backup_version}). Please upgrade the app before restoring.
                    </WarningBanner>
                  )}

                  <div>
                    <span className="label">Budgets in this backup</span>
                    <div className="mt-1 space-y-2">
                      {inspectData.budgets.map(b => (
                        <label key={b.index} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
                          <input
                            type="checkbox"
                            checked={selectedRestoreIndices.has(b.index)}
                            onChange={() => toggleRestoreIndex(b.index)}
                            disabled={inspectData.compatibility === 'newer_backup'}
                          />
                          <span className="flex-1">
                            <span className="block font-medium text-gray-900 dark:text-gray-100">{b.description}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{b.budgetowner} · {b.budget_frequency} · {b.period_count} period(s)</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {inspectData.compatibility !== 'newer_backup' && (
                    <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-800/30 dark:bg-red-950/10">
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={allowOverwrite}
                          onChange={e => setAllowOverwrite(e.target.checked)}
                        />
                        <span className="text-red-800 dark:text-red-300">
                          <strong>Overwrite existing budgets</strong> — If a budget with the same description already exists, it will be deleted and replaced. This action cannot be undone.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      className="btn-primary"
                      disabled={!canRestore || restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate()}
                    >
                      {restoreMutation.isPending ? 'Restoring…' : 'Restore Selected Budgets'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {restoreResult && (
            <div className="space-y-3">
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-200">
                <p className="font-medium">Restore complete</p>
                <ul className="mt-1 list-disc pl-4">
                  {restoreResult.restored.map(r => (
                    <li key={r.new_budgetid}>{r.description} (ID: {r.new_budgetid})</li>
                  ))}
                </ul>
                {restoreResult.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {restoreResult.warnings.map((w, i) => (
                      <p key={i} className="text-amber-700 dark:text-amber-300">⚠ {w}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button className="btn-secondary" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

WarningBanner.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['warning', 'error', 'info']),
}

BackupRestoreModal.propTypes = {
  budgets: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
}
