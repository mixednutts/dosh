export const DEFAULT_LOCALISATION = {
  locale: 'en-AU',
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  date_format: 'medium',
}

export const LOCALE_OPTIONS = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-NZ', label: 'English (New Zealand)' },
  { value: 'de-DE', label: 'German (Germany)' },
]

export const CURRENCY_OPTIONS = ['AUD', 'USD', 'GBP', 'NZD', 'EUR', 'CAD']

export const TIMEZONE_OPTIONS = [
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
]

export const DATE_FORMAT_OPTIONS = [
  { value: 'compact', label: 'Compact', sample: '10 Apr' },
  { value: 'short', label: 'Short', sample: '10 Apr 26' },
  { value: 'medium', label: 'Medium', sample: '10 Apr 2026' },
  { value: 'numeric', label: 'Numeric', sample: '10/04/2026' },
  { value: 'MM-dd-yy', label: 'MM-DD-YY', sample: '04-10-26' },
  { value: 'MMM-dd-yyyy', label: 'MMM-DD-YYYY', sample: 'Apr-10-2026' },
]

const SUPPORTED_LOCALES = new Set(LOCALE_OPTIONS.map(option => option.value))
const SUPPORTED_CURRENCIES = new Set(CURRENCY_OPTIONS)
const SUPPORTED_TIMEZONES = new Set(TIMEZONE_OPTIONS)

const DATE_PRESETS = {
  compact: { day: '2-digit', month: 'short' },
  short: { day: '2-digit', month: 'short', year: '2-digit' },
  medium: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  day: { day: 'numeric' },
  keyMonth: { year: 'numeric', month: '2-digit' },
  keyDate: { year: 'numeric', month: '2-digit', day: '2-digit' },
}

const DATE_FORMAT_TOKEN_PATTERN = /(yyyy|yy|MMMM|MMM|MM|M|dd|d|[\s.,/-]+)/g
const DATE_FORMAT_TOKEN_VALUES = new Set(['yyyy', 'yy', 'MMMM', 'MMM', 'MM', 'M', 'dd', 'd'])

const TIME_PRESETS = {
  short: { hour: '2-digit', minute: '2-digit', hour12: false },
}

const numberFormatterCache = new Map()
const dateFormatterCache = new Map()

function cleanPreference(value, fallback) {
  return value || fallback
}

function supportedPreference(value, supportedValues, fallback) {
  const cleaned = cleanPreference(value, fallback)
  return supportedValues.has(cleaned) ? cleaned : fallback
}

export function getLocalisationPreferences(source = {}) {
  const dateFormat = normalizeDateFormatPattern(source.date_format)
  return {
    locale: supportedPreference(source.locale, SUPPORTED_LOCALES, DEFAULT_LOCALISATION.locale),
    currency: supportedPreference(source.currency, SUPPORTED_CURRENCIES, DEFAULT_LOCALISATION.currency),
    timezone: supportedPreference(source.timezone, SUPPORTED_TIMEZONES, DEFAULT_LOCALISATION.timezone),
    date_format: dateFormat || DEFAULT_LOCALISATION.date_format,
  }
}

function toNumber(value) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  return new Date(value)
}

function formatDatePartsToKey(parts) {
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function normalizeDateFormatPattern(value) {
  if (!value) return null
  const normalized = String(value).trim().replaceAll('Y', 'y').replaceAll('D', 'd')
  if (DATE_PRESETS[normalized]) return normalized

  const tokens = normalized.match(DATE_FORMAT_TOKEN_PATTERN) || []
  if (tokens.join('') !== normalized) return null

  const tokenValues = new Set(tokens.filter(token => DATE_FORMAT_TOKEN_VALUES.has(token)))
  const hasDay = tokenValues.has('d') || tokenValues.has('dd')
  const hasMonth = tokenValues.has('M') || tokenValues.has('MM') || tokenValues.has('MMM') || tokenValues.has('MMMM')
  const hasYear = tokenValues.has('yy') || tokenValues.has('yyyy')
  return hasDay && hasMonth && hasYear ? normalized : null
}

function cachedNumberFormatter(locale, options = {}) {
  const key = `${locale}|${JSON.stringify(options)}`
  if (!numberFormatterCache.has(key)) {
    numberFormatterCache.set(key, new Intl.NumberFormat(locale, options))
  }
  return numberFormatterCache.get(key)
}

function cachedDateFormatter(locale, options = {}) {
  const key = `${locale}|${JSON.stringify(options)}`
  if (!dateFormatterCache.has(key)) {
    dateFormatterCache.set(key, new Intl.DateTimeFormat(locale, options))
  }
  return dateFormatterCache.get(key)
}

function getCustomDateParts(date, locale, timezone) {
  const numericMonthParts = Object.fromEntries(cachedDateFormatter(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  const shortMonth = cachedDateFormatter(locale, {
    timeZone: timezone,
    month: 'short',
  }).formatToParts(date).find(part => part.type === 'month')?.value || numericMonthParts.month
  const longMonth = cachedDateFormatter(locale, {
    timeZone: timezone,
    month: 'long',
  }).formatToParts(date).find(part => part.type === 'month')?.value || shortMonth

  return {
    yyyy: numericMonthParts.year,
    yy: numericMonthParts.year?.slice(-2) || '',
    MMMM: longMonth,
    MMM: shortMonth,
    MM: numericMonthParts.month,
    M: numericMonthParts.month?.replace(/^0/, '') || '',
    dd: numericMonthParts.day,
    d: numericMonthParts.day?.replace(/^0/, '') || '',
  }
}

function formatCustomDate(date, pattern, locale, timezone) {
  const parts = getCustomDateParts(date, locale, timezone)
  return pattern.replaceAll(/yyyy|yy|MMMM|MMM|MM|M|dd|d/g, token => parts[token] || token)
}

export function makeLocalisation(preferences = {}) {
  const resolved = getLocalisationPreferences(preferences)
  const { locale, currency, timezone, date_format: dateFormat } = resolved

  const currencyFormatter = cachedNumberFormatter(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
  const numberFormatter = cachedNumberFormatter(locale)
  const percentFormatter = cachedNumberFormatter(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  function formatCurrency(value) {
    return currencyFormatter.format(toNumber(value))
  }

  function formatNumber(value, options = {}) {
    return cachedNumberFormatter(locale, options).format(toNumber(value))
  }

  function formatPercent(value, options = {}) {
    if (options.isFraction) {
      return cachedNumberFormatter(locale, { style: 'percent', maximumFractionDigits: 0, ...options }).format(toNumber(value))
    }
    return percentFormatter.format(toNumber(value) / 100)
  }

  function resolveDatePreset(preset) {
    return preset === undefined || preset === 'medium' ? dateFormat : preset
  }

  function formatDate(value, preset, options = {}) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    const resolvedPreset = resolveDatePreset(preset)
    if (!DATE_PRESETS[resolvedPreset]) {
      return formatCustomDate(date, resolvedPreset, locale, timezone)
    }
    return cachedDateFormatter(locale, {
      timeZone: timezone,
      ...(DATE_PRESETS[resolvedPreset] || DATE_PRESETS[dateFormat] || DATE_PRESETS.medium),
      ...options,
    }).format(date)
  }

  function formatTime(value, preset = 'short', options = {}) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    return cachedDateFormatter(locale, {
      timeZone: timezone,
      ...(TIME_PRESETS[preset] || TIME_PRESETS.short),
      ...options,
    }).format(date)
  }

  function formatDateTime(value, preset, options = {}) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    const resolvedPreset = resolveDatePreset(preset)
    if (!DATE_PRESETS[resolvedPreset]) {
      const dateLabel = formatCustomDate(date, resolvedPreset, locale, timezone)
      const timeLabel = cachedDateFormatter(locale, {
        timeZone: timezone,
        ...(TIME_PRESETS.short),
        ...options,
      }).format(date)
      return [dateLabel, timeLabel].filter(Boolean).join(', ')
    }
    return cachedDateFormatter(locale, {
      timeZone: timezone,
      ...(DATE_PRESETS[resolvedPreset] || DATE_PRESETS[dateFormat] || DATE_PRESETS.medium),
      ...(TIME_PRESETS.short),
      ...options,
    }).format(date)
  }

  function formatDateRange(start, end, preset) {
    const startDate = toDate(start)
    const endDate = toDate(end)
    if (!startDate || Number.isNaN(startDate.getTime())) return formatDate(end, preset)
    if (!endDate || Number.isNaN(endDate.getTime())) return formatDate(start, preset)
    const resolvedPreset = resolveDatePreset(preset)
    if (!DATE_PRESETS[resolvedPreset]) {
      const startLabel = formatCustomDate(startDate, resolvedPreset, locale, timezone)
      const endLabel = formatCustomDate(endDate, resolvedPreset, locale, timezone)
      return [startLabel, endLabel].filter(Boolean).join(' - ')
    }
    const formatter = cachedDateFormatter(locale, {
      timeZone: timezone,
      ...(DATE_PRESETS[resolvedPreset] || DATE_PRESETS[dateFormat] || DATE_PRESETS.medium),
    })
    if (typeof formatter.formatRange === 'function') {
      return formatter.formatRange(startDate, endDate)
    }
    const startLabel = formatter.format(startDate)
    const endLabel = formatter.format(endDate)
    return [startLabel, endLabel].filter(Boolean).join(' - ')
  }

  function formatDateKey(value) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    return formatDatePartsToKey(cachedDateFormatter('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date))
  }

  function getToday() {
    const key = formatDateKey(new Date())
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return {
    ...resolved,
    currencyFormatter,
    numberFormatter,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatDate,
    formatTime,
    formatDateTime,
    formatDateRange,
    formatDateKey,
    getToday,
  }
}

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNumberParts(locale, currency) {
  const decimalParts = cachedNumberFormatter(locale).formatToParts(12345.6)
  const currencyParts = cachedNumberFormatter(locale, { style: 'currency', currency }).formatToParts(12345.6)
  return {
    decimal: decimalParts.find(part => part.type === 'decimal')?.value || '.',
    group: decimalParts.find(part => part.type === 'group')?.value || ',',
    currencySymbols: [...new Set(currencyParts.filter(part => part.type === 'currency').map(part => part.value))],
  }
}

function getDigitMap(locale) {
  const formatter = cachedNumberFormatter(locale, { useGrouping: false })
  return Array.from({ length: 10 }, (_, digit) => [formatter.format(digit), String(digit)])
}

export function getNumericInputOptions(preferences = {}, { minimumValue = null } = {}) {
  const { locale } = getLocalisationPreferences(preferences)
  const parts = cachedNumberFormatter(locale).formatToParts(12345.6)
  const decimalCharacter = parts.find(part => part.type === 'decimal')?.value || '.'
  const digitGroupSeparator = parts.find(part => part.type === 'group')?.value || ','

  const options = {
    allowDecimalPadding: false,
    currencySymbol: '',
    decimalCharacter,
    decimalCharacterAlternative: decimalCharacter === ',' ? '.' : ',',
    digitGroupSeparator,
    decimalPlaces: 2,
    emptyInputBehavior: 'null',
    formulaMode: false,
    modifyValueOnWheel: false,
    outputFormat: '.',
    unformatOnSubmit: true,
    watchExternalChanges: false,
  }

  if (minimumValue !== null && minimumValue !== undefined) {
    options.minimumValue = String(minimumValue)
  }

  return options
}

function hasValidGrouping(integerPart, groupSeparator) {
  if (!groupSeparator || !integerPart.includes(groupSeparator)) return true
  const groups = integerPart.split(groupSeparator)
  return groups[0].length >= 1
    && groups[0].length <= 3
    && groups.slice(1).every(group => group.length === 3)
}

function normalizeDecimalString(normalized) {
  if (!/^\d*(?:\.\d*)?$/.test(normalized) || ['.', ''].includes(normalized)) {
    return null
  }

  let [integerPart = '', fractionPart = ''] = normalized.split('.')
  integerPart = integerPart.replace(/^0+(?=\d)/, '') || '0'
  fractionPart = fractionPart.padEnd(3, '0')

  const cents = Number.parseInt(fractionPart.slice(0, 2), 10)
  const roundingDigit = Number.parseInt(fractionPart[2], 10)
  if (!Number.isFinite(cents) || !Number.isFinite(roundingDigit)) return null

  const roundedCents = cents + (roundingDigit >= 5 ? 1 : 0)
  if (roundedCents >= 100) {
    integerPart = String(BigInt(integerPart) + 1n)
    return `${integerPart}.00`
  }

  return `${integerPart}.${String(roundedCents).padStart(2, '0')}`
}

export function normalizeLocalizedAmountInput(rawValue, preferences = {}) {
  const raw = String(rawValue ?? '').trim()
  if (!raw) return null

  const { locale, currency } = getLocalisationPreferences(preferences)
  const { decimal, group, currencySymbols } = getNumberParts(locale, currency)
  let normalized = raw

  if (/^\(.*\)$/.test(normalized)) {
    return null
  }

  for (const [localized, digit] of getDigitMap(locale)) {
    if (localized !== digit) {
      normalized = normalized.replaceAll(new RegExp(escapeRegExp(localized), 'g'), digit)
    }
  }

  for (const symbol of currencySymbols) {
    normalized = normalized.replaceAll(new RegExp(escapeRegExp(symbol), 'g'), '')
  }
  normalized = normalized.replaceAll(new RegExp(escapeRegExp(currency), 'gi'), '')
  normalized = normalized.replaceAll(/[\s\u00a0\u202f]/g, '')

  const decimalIndex = decimal ? normalized.lastIndexOf(decimal) : -1
  const integerPart = decimalIndex >= 0 ? normalized.slice(0, decimalIndex) : normalized
  const fractionPart = decimalIndex >= 0 ? normalized.slice(decimalIndex + decimal.length) : ''
  if (
    (decimalIndex >= 0 && normalized.indexOf(decimal) !== decimalIndex)
    || (group && fractionPart.includes(group))
    || !hasValidGrouping(integerPart, group)
  ) {
    return null
  }

  if (group) normalized = normalized.replaceAll(new RegExp(escapeRegExp(group), 'g'), '')
  if (decimal && decimal !== '.') normalized = normalized.replaceAll(new RegExp(escapeRegExp(decimal), 'g'), '.')

  return normalizeDecimalString(normalized)
}

export function parseLocalizedAmountInput(rawValue, preferences = {}) {
  const normalized = normalizeLocalizedAmountInput(rawValue, preferences)
  if (normalized === null) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatLocalizedAmountForEdit(rawValue, preferences = {}) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return ''

  const { locale, currency } = getLocalisationPreferences(preferences)
  const normalized = normalizeLocalizedAmountInput(rawValue, preferences)
  if (normalized === null) return String(rawValue)

  const { decimal } = getNumberParts(locale, currency)
  const editableValue = normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  return decimal === '.' ? editableValue : editableValue.replace('.', decimal)
}
