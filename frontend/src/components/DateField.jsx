import { useRef } from 'react'
import PropTypes from 'prop-types'
import DatePicker from 'react-datepicker'
import { format, parseISO } from 'date-fns'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

import 'react-datepicker/dist/react-datepicker.css'

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(value)
}

export default function DateField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'DD MMM YYYY',
  required = false,
}) {
  const datePickerRef = useRef(null)

  return (
    <div className="relative w-full">
      <DatePicker
        ref={datePickerRef}
        id={id}
        selected={toDate(value)}
        onChange={nextDate => onChange(nextDate ? format(nextDate, 'yyyy-MM-dd') : '')}
        disabled={disabled}
        required={required}
        placeholderText={placeholder}
        dateFormat="dd MMM yyyy"
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
