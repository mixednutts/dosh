import { useRef } from 'react'
import PropTypes from 'prop-types'
import DatePicker from 'react-datepicker'
import { format, parseISO } from 'date-fns'
import { de, enAU, enGB, enNZ, enUS } from 'date-fns/locale'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useLocalisation } from './LocalisationContext'
import { normalizeDateFormatPattern } from '../utils/localisation'

import 'react-datepicker/dist/react-datepicker.css'

const DATE_FIELD_FORMATS = {
  compact: {
    default: { pattern: 'dd MMM', placeholder: 'DD MMM', timePattern: 'dd MMM, h:mm aa' },
    'en-US': { pattern: 'MMM dd', placeholder: 'MMM DD', timePattern: 'MMM dd, h:mm aa' },
  },
  short: {
    default: { pattern: 'dd MMM yy', placeholder: 'DD MMM YY', timePattern: 'dd MMM yy, h:mm aa' },
    'en-US': { pattern: 'MMM dd yy', placeholder: 'MMM DD YY', timePattern: 'MMM dd yy, h:mm aa' },
  },
  medium: {
    default: { pattern: 'dd MMM yyyy', placeholder: 'DD MMM YYYY', timePattern: 'dd MMM yyyy, h:mm aa' },
    'en-US': { pattern: 'MMM dd yyyy', placeholder: 'MMM DD YYYY', timePattern: 'MMM dd yyyy, h:mm aa' },
  },
  long: {
    default: { pattern: 'EEEE, d MMMM yyyy', placeholder: 'Weekday, D Month YYYY', timePattern: 'EEEE, d MMMM yyyy, h:mm aa' },
    'en-US': { pattern: 'EEEE, MMMM d yyyy', placeholder: 'Weekday, Month D YYYY', timePattern: 'EEEE, MMMM d yyyy, h:mm aa' },
  },
  numeric: {
    default: { pattern: 'dd/MM/yyyy', placeholder: 'DD/MM/YYYY', timePattern: 'dd/MM/yyyy, h:mm aa' },
    'en-US': { pattern: 'MM/dd/yyyy', placeholder: 'MM/DD/YYYY', timePattern: 'MM/dd/yyyy, h:mm aa' },
  },
}

const DATE_PICKER_LOCALES = {
  'en-AU': enAU,
  'en-US': enUS,
  'en-GB': enGB,
  'en-NZ': enNZ,
  'de-DE': de,
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(value)
}

function getDateFieldFormat(locale, dateFormat, showTime = false) {
  const customFormat = normalizeDateFormatPattern(dateFormat)
  if (customFormat && !DATE_FIELD_FORMATS[customFormat]) {
    return { 
      pattern: showTime ? `${customFormat}, h:mm aa` : customFormat, 
      placeholder: customFormat.toUpperCase() 
    }
  }
  const configuredFormat = DATE_FIELD_FORMATS[dateFormat] || DATE_FIELD_FORMATS.medium
  const formatForLocale = configuredFormat[locale] || configuredFormat.default
  return {
    pattern: showTime ? (formatForLocale.timePattern || `${formatForLocale.pattern}, h:mm aa`) : formatForLocale.pattern,
    placeholder: formatForLocale.placeholder
  }
}

export default function DateField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'DD MMM YYYY',
  required = false,
  showTimeSelect = false,
}) {
  const { locale, date_format: dateFormat } = useLocalisation()
  const datePickerRef = useRef(null)
  const fieldFormat = getDateFieldFormat(locale, dateFormat, showTimeSelect)
  const resolvedPlaceholder = placeholder === 'DD MMM YYYY' ? fieldFormat.placeholder : placeholder
  const datePickerLocale = DATE_PICKER_LOCALES[locale] || enAU

  return (
    <div className="relative w-full">
      <DatePicker
        ref={datePickerRef}
        id={id}
        selected={toDate(value)}
        onChange={nextDate => onChange(nextDate ? format(nextDate, showTimeSelect ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd') : '')}
        disabled={disabled}
        required={required}
        placeholderText={resolvedPlaceholder}
        dateFormat={fieldFormat.pattern}
        locale={datePickerLocale}
        className="input w-full pr-12"
        calendarClassName="dosh-datepicker"
        popperClassName="dosh-datepicker-popper"
        popperPlacement="bottom-start"
        showPopperArrow={false}
        showTimeSelect={showTimeSelect}
        timeIntervals={15}
        timeCaption="Time"
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
  showTimeSelect: PropTypes.bool,
}
