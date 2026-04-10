import { formatLocalizedAmountForEdit, getAutoNumericOptions, makeLocalisation, parseLocalizedAmountInput } from '../utils/localisation'

describe('localisation utilities', () => {
  it('formats currency, percent, and dates with the selected locale preferences', () => {
    const au = makeLocalisation({ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney' })
    const auNumeric = makeLocalisation({ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'numeric' })
    const auGbp = makeLocalisation({ locale: 'en-AU', currency: 'GBP', timezone: 'Australia/Sydney' })
    const us = makeLocalisation({ locale: 'en-US', currency: 'USD', timezone: 'America/New_York' })
    const de = makeLocalisation({ locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin' })

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
  })

  it('parses localized currency and grouped amount input into normalized numbers', () => {
    expect(parseLocalizedAmountInput('$1,234.56', { locale: 'en-AU', currency: 'AUD' })).toBe(1234.56)
    expect(parseLocalizedAmountInput('1.234,56 €', { locale: 'de-DE', currency: 'EUR' })).toBe(1234.56)
    expect(parseLocalizedAmountInput('not money', { locale: 'en-AU', currency: 'AUD' })).toBeNull()
  })

  it('keeps amount entry masks numeric without currency symbols or codes', () => {
    const auGbpOptions = getAutoNumericOptions({ locale: 'en-AU', currency: 'GBP' })
    const deEurOptions = getAutoNumericOptions({ locale: 'de-DE', currency: 'EUR' })

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
