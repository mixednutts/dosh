import { useRef } from 'react'
import PropTypes from 'prop-types'
import DatePicker from 'react-datepicker'
import { format, parseISO } from 'date-fns'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useLocalisation } from './LocalisationContext'

import 'react-datepicker/dist/react-datepicker.css'

const DATE_FIELD_FORMATS = {
  compact: {
    default: { pattern: 'dd MMM', placeholder: 'DD MMM' },
    'en-US': { pattern: 'MMM dd', placeholder: 'MMM DD' },
  },
  short: {
    default: { pattern: 'dd MMM yy', placeholder: 'DD MMM YY' },
    'en-US': { pattern: 'MMM dd yy', placeholder: 'MMM DD YY' },
  },
  medium: {
    default: { pattern: 'dd MMM yyyy', placeholder: 'DD MMM YYYY' },
    'en-US': { pattern: 'MMM dd yyyy', placeholder: 'MMM DD YYYY' },
  },
  long: {
    default: { pattern: 'EEEE, d MMMM yyyy', placeholder: 'Weekday, D Month YYYY' },
    'en-US': { pattern: 'EEEE, MMMM d yyyy', placeholder: 'Weekday, Month D YYYY' },
  },
  numeric: {
    default: { pattern: 'dd/MM/yyyy', placeholder: 'DD/MM/YYYY' },
    'en-US': { pattern: 'MM/dd/yyyy', placeholder: 'MM/DD/YYYY' },
  },
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(value)
}

function getDateFieldFormat(locale, dateFormat) {
  const configuredFormat = DATE_FIELD_FORMATS[dateFormat] || DATE_FIELD_FORMATS.medium
  return configuredFormat[locale] || configuredFormat.default
}

export default function DateField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'DD MMM YYYY',
  required = false,
}) {
  const { locale, date_format: dateFormat } = useLocalisation()
  const datePickerRef = useRef(null)
  const fieldFormat = getDateFieldFormat(locale, dateFormat)
  const resolvedPlaceholder = placeholder === 'DD MMM YYYY' ? fieldFormat.placeholder : placeholder

  return (
    <div className="relative w-full">
      <DatePicker
        ref={datePickerRef}
        id={id}
        selected={toDate(value)}
        onChange={nextDate => onChange(nextDate ? format(nextDate, 'yyyy-MM-dd') : '')}
        disabled={disabled}
        required={required}
        placeholderText={resolvedPlaceholder}
        dateFormat={fieldFormat.pattern}
        className="input w-full pr-12"
        calendarClassName="dosh-datepicker"
        popperClassName="dosh-datepicker-popper"
        popperPlacement="bottom-start"
        showPopperArrow={false}
      />
      <button
        type="button"
        aria-label="Open calendar"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
        disabled={disabled}
        onClick={() => datePickerRef.current?.setOpen(true)}
      >
        <CalendarDaysIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

DateField.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
}
