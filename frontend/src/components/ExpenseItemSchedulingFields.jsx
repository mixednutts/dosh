import PropTypes from 'prop-types'
import DateField from './DateField'
import { getFixedDayFallbackMessage } from '../utils/fixedDayScheduling'

const FREQTYPES = [
  { value: 'Always', label: 'Always' },
  { value: 'Fixed Day of Month', label: 'Fixed Day of Month' },
  { value: 'Every N Days', label: 'Every N Days' },
]

const PAYTYPES = ['AUTO', 'MANUAL']

export default function ExpenseItemSchedulingFields({
  formIdPrefix,
  description,
  onDescriptionChange,
  freqtype,
  onFreqtypeChange,
  frequencyValue,
  onFrequencyValueChange,
  paytype,
  onPaytypeChange,
  effectivedate,
  onEffectivedateChange,
  disableDescription = false,
  showDescription = true,
}) {
  const isAlways = freqtype === 'Always'
  const isScheduled = !isAlways && !!frequencyValue && !!effectivedate
  const freqValueLabel = freqtype === 'Every N Days' ? 'Interval (days)' : 'Day of Month (1-31)'
  const fixedDayFallbackMessage = freqtype === 'Fixed Day of Month'
    ? getFixedDayFallbackMessage(frequencyValue)
    : null

  return (
    <div className="space-y-3">
      {showDescription && (
        <div>
          <label className="label" htmlFor={`${formIdPrefix}-description`}>Description <span className="text-red-500">*</span></label>
          <input
            id={`${formIdPrefix}-description`}
            required
            className="input"
            value={description}
            onChange={event => onDescriptionChange(event.target.value)}
            placeholder="e.g. Netflix"
            disabled={disableDescription}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`${formIdPrefix}-freq-type`}>Frequency Type</label>
          <select
            id={`${formIdPrefix}-freq-type`}
            className="input"
            value={freqtype}
            onChange={event => onFreqtypeChange(event.target.value)}
          >
            {FREQTYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={`label ${isAlways ? 'opacity-40' : ''}`} htmlFor={`${formIdPrefix}-freq-value`}>{freqValueLabel}</label>
          <input
            id={`${formIdPrefix}-freq-value`}
            type="number"
            min="1"
            max={freqtype === 'Fixed Day of Month' ? 31 : undefined}
            className="input"
            value={frequencyValue}
            onChange={event => onFrequencyValueChange(event.target.value)}
            disabled={isAlways}
          />
        </div>
      </div>
      <div className={`grid gap-2 ${isAlways ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div>
          <label className="label" htmlFor={`${formIdPrefix}-pay-type`}>Pay Type</label>
          <select
            id={`${formIdPrefix}-pay-type`}
            className="input"
            value={isAlways ? 'MANUAL' : paytype}
            onChange={event => onPaytypeChange(event.target.value)}
            disabled={isAlways}
          >
            {PAYTYPES.map(option => (
              <option key={option} value={option} disabled={option === 'AUTO' && !isScheduled}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            AUTO is only available for scheduled expenses and only runs when Auto Expense is enabled in budget settings.
          </p>
        </div>
        {!isAlways && (
          <div>
            <label className="label" htmlFor={`${formIdPrefix}-effective-date`}>Effective Date</label>
            <DateField
              id={`${formIdPrefix}-effective-date`}
              value={effectivedate}
              onChange={onEffectivedateChange}
            />
          </div>
        )}
      </div>
      {fixedDayFallbackMessage && (
        <p className="rounded bg-dosh-50 px-3 py-2 text-xs text-dosh-600 dark:bg-dosh-900/20 dark:text-dosh-400">
          {fixedDayFallbackMessage}
        </p>
      )}
    </div>
  )
}

ExpenseItemSchedulingFields.propTypes = {
  formIdPrefix: PropTypes.string.isRequired,
  description: PropTypes.string,
  onDescriptionChange: PropTypes.func,
  freqtype: PropTypes.string.isRequired,
  onFreqtypeChange: PropTypes.func.isRequired,
  frequencyValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onFrequencyValueChange: PropTypes.func.isRequired,
  paytype: PropTypes.string.isRequired,
  onPaytypeChange: PropTypes.func.isRequired,
  effectivedate: PropTypes.string.isRequired,
  onEffectivedateChange: PropTypes.func.isRequired,
  disableDescription: PropTypes.bool,
  showDescription: PropTypes.bool,
}
