import React from 'react'
import { screen } from '@testing-library/react'

import DateField from '../components/DateField'
import { LocalisationProvider } from '../components/LocalisationContext'
import { renderWithProviders } from '../testUtils'

jest.mock('react-datepicker', () => {
  const ReactForMock = require('react')
  return ReactForMock.forwardRef(function MockDatePicker(props, ref) {
    return (
      <input
        ref={ref}
        data-testid="date-picker"
        data-locale-code={props.locale?.code}
        data-date-format={props.dateFormat}
        placeholder={props.placeholderText}
        readOnly
      />
    )
  })
})

describe('DateField', () => {
  it('uses the active budget locale for picker chrome and input format', () => {
    renderWithProviders(
      <LocalisationProvider budget={{ locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin', date_format: 'numeric' }}>
        <DateField id="due-date" value="2026-04-10" onChange={jest.fn()} />
      </LocalisationProvider>
    )

    const picker = screen.getByTestId('date-picker')
    expect(picker.getAttribute('data-locale-code')).toBe('de')
    expect(picker.getAttribute('placeholder')).toBe('DD/MM/YYYY')
  })

  it('normalizes custom date formats for the picker input', () => {
    renderWithProviders(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'MMM-DD-YYYY' }}>
        <DateField id="due-date" value="2026-04-10" onChange={jest.fn()} />
      </LocalisationProvider>
    )

    const picker = screen.getByTestId('date-picker')
    expect(picker.getAttribute('data-date-format')).toBe('MMM-dd-yyyy')
    expect(picker.getAttribute('placeholder')).toBe('MMM-DD-YYYY')
  })
})
