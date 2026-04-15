import { useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation } from '@tanstack/react-query'
import { exportPeriod } from '../../api/client'

export function ExportCycleModal({ periodId, budgetId, onClose }) {
  const [format, setFormat] = useState('csv')
  const [error, setError] = useState('')
  const exportMutation = useMutation({
    mutationFn: selectedFormat => exportPeriod(budgetId, periodId, selectedFormat),
    onSuccess: () => {
      setError('')
      onClose()
    },
    onError: exportError => {
      setError(exportError?.response?.data?.detail || 'Unable to export this budget cycle right now.')
    },
  })

  const handleSubmit = event => {
    event.preventDefault()
    exportMutation.mutate(format)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
        Download this budget cycle as a flat CSV for spreadsheets or a structured JSON file.
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Export Format</legend>
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
          <input
            type="radio"
            name="period-export-format"
            value="csv"
            checked={format === 'csv'}
            onChange={event => setFormat(event.target.value)}
          />
          <span>
            <span className="block font-medium text-gray-900 dark:text-gray-100">CSV (.csv)</span>
            <span className="block text-gray-500 dark:text-gray-400">Single flat export for Excel and Google Sheets.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
          <input
            type="radio"
            name="period-export-format"
            value="json"
            checked={format === 'json'}
            onChange={event => setFormat(event.target.value)}
          />
          <span>
            <span className="block font-medium text-gray-900 dark:text-gray-100">JSON (.json)</span>
            <span className="block text-gray-500 dark:text-gray-400">Structured export with grouped cycle data and flat transaction rows.</span>
          </span>
        </label>
      </fieldset>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={exportMutation.isPending}>
          {exportMutation.isPending ? 'Exporting…' : 'Download Export'}
        </button>
      </div>
    </form>
  )
}

ExportCycleModal.propTypes = {
  periodId: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
}
