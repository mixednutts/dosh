import { formatLocalizedAmountForEdit, getNumericInputOptions, makeLocalisation, normalizeDateFormatPattern, normalizeLocalizedAmountInput, parseLocalizedAmountInput } from '../utils/localisation'

describe('localisation utilities', () => {
  it('formats currency, percent, and dates with the selected locale preferences', () => {
    const au = makeLocalisation({ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney' })
    const auNumeric = makeLocalisation({ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'numeric' })
    const auGbp = makeLocalisation({ locale: 'en-AU', currency: 'GBP', timezone: 'Australia/Sydney' })
    const us = makeLocalisation({ locale: 'en-US', currency: 'USD', timezone: 'America/New_York' })
    const de = makeLocalisation({ locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin' })
    const invalid = makeLocalisation({ locale: 'fr-FR', currency: 'ZZZ', timezone: 'Mars/Colony' })

    expect(au.formatCurrency(1234.56)).toBe('$1,234.56')
    expect(auGbp.formatCurrency(1234.56)).toBe('£1,234.56')
    expect(auGbp.formatCurrency(1234.56)).not.toContain('GBP')
    expect(us.formatCurrency(1234.56)).toBe('$1,234.56')
    expect(de.formatCurrency(1234.56)).toContain('1.234,56')
    expect(de.formatCurrency(1234.56)).toContain('€')

    expect(au.formatPercent(95)).toBe('95%')
    expect(de.formatPercent(95)).toBe('95 %')
    expect(us.formatDate('2026-04-10T12:00:00Z', 'medium')).toContain('Apr')
    expect(auNumeric.formatDate('2026-04-10T12:00:00Z')).toBe('10/04/2026')
    expect(au.formatDateRange('2026-04-10T12:00:00Z', '2026-04-12T12:00:00Z', 'medium')).toContain('2026')
    expect(invalid.locale).toBe('en-AU')
    expect(invalid.currency).toBe('AUD')
    expect(invalid.timezone).toBe('Australia/Sydney')
  })

  it('normalizes and formats supported custom date patterns', () => {
    const custom = makeLocalisation({ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'MMM-DD-YYYY' })

    expect(normalizeDateFormatPattern('MM-DD-YY')).toBe('MM-dd-yy')
    expect(normalizeDateFormatPattern('yyyy-QQ-dd')).toBeNull()
    expect(custom.date_format).toBe('MMM-dd-yyyy')
    expect(custom.formatDate('2026-04-10T12:00:00Z')).toBe('Apr-10-2026')
    expect(custom.formatDateTime('2026-04-10T12:00:00Z')).toContain('Apr-10-2026')
  })

  it('normalizes localized currency and grouped amount input into decimal strings', () => {
    expect(normalizeLocalizedAmountInput('$1,234.56', { locale: 'en-AU', currency: 'AUD' })).toBe('1234.56')
    expect(normalizeLocalizedAmountInput('1.234,56 €', { locale: 'de-DE', currency: 'EUR' })).toBe('1234.56')
    expect(normalizeLocalizedAmountInput('0001.2', { locale: 'en-AU', currency: 'AUD' })).toBe('1.20')
    expect(normalizeLocalizedAmountInput('1.235', { locale: 'en-AU', currency: 'AUD' })).toBe('1.24')
    expect(normalizeLocalizedAmountInput('999.999', { locale: 'en-AU', currency: 'AUD' })).toBe('1000.00')
  })

  it('parses localized currency and grouped amount input into normalized numbers', () => {
    expect(parseLocalizedAmountInput('$1,234.56', { locale: 'en-AU', currency: 'AUD' })).toBe(1234.56)
    expect(parseLocalizedAmountInput('1.234,56 €', { locale: 'de-DE', currency: 'EUR' })).toBe(1234.56)
    expect(parseLocalizedAmountInput('(1,234.56)', { locale: 'en-AU', currency: 'AUD' })).toBeNull()
    expect(parseLocalizedAmountInput('-1,234.56', { locale: 'en-AU', currency: 'AUD' })).toBeNull()
    expect(parseLocalizedAmountInput('١٬٢٣٤٫٥٦', { locale: 'ar-EG', currency: 'AUD' })).toBeNull()
    expect(parseLocalizedAmountInput('1,234,56', { locale: 'en-AU', currency: 'AUD' })).toBeNull()
    expect(parseLocalizedAmountInput('1.234.56', { locale: 'de-DE', currency: 'EUR' })).toBeNull()
    expect(parseLocalizedAmountInput('not money', { locale: 'en-AU', currency: 'AUD' })).toBeNull()
  })

  it('keeps amount entry masks numeric without currency symbols or codes', () => {
    const auGbpOptions = getNumericInputOptions({ locale: 'en-AU', currency: 'GBP' })
    const deEurOptions = getNumericInputOptions({ locale: 'de-DE', currency: 'EUR' })

    expect(auGbpOptions.currencySymbol).toBe('')
    expect(auGbpOptions.allowDecimalPadding).toBe(false)
    expect(auGbpOptions.formulaMode).toBe(false)
    expect(auGbpOptions.decimalCharacter).toBe('.')
    expect(auGbpOptions.digitGroupSeparator).toBe(',')
    expect(deEurOptions.currencySymbol).toBe('')
    expect(deEurOptions.decimalCharacter).toBe(',')
    expect(deEurOptions.digitGroupSeparator).toBe('.')
  })

  it('formats amount values for focused editing without grouping', () => {
    expect(formatLocalizedAmountForEdit('1,200', { locale: 'en-AU', currency: 'AUD' })).toBe('1200')
    expect(formatLocalizedAmountForEdit('1.200,5', { locale: 'de-DE', currency: 'EUR' })).toBe('1200,5')
  })
})
