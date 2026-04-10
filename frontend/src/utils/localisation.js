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
  { value: 'long', label: 'Long', sample: 'Friday, 10 April 2026' },
  { value: 'numeric', label: 'Numeric', sample: '10/04/2026' },
]

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

const TIME_PRESETS = {
  short: { hour: '2-digit', minute: '2-digit', hour12: false },
}

function cleanPreference(value, fallback) {
  return value || fallback
}

export function getLocalisationPreferences(source = {}) {
  return {
    locale: cleanPreference(source.locale, DEFAULT_LOCALISATION.locale),
    currency: cleanPreference(source.currency, DEFAULT_LOCALISATION.currency),
    timezone: cleanPreference(source.timezone, DEFAULT_LOCALISATION.timezone),
    date_format: DATE_PRESETS[source.date_format] ? source.date_format : DEFAULT_LOCALISATION.date_format,
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

export function makeLocalisation(preferences = {}) {
  const resolved = getLocalisationPreferences(preferences)
  const { locale, currency, timezone, date_format: dateFormat } = resolved

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
  const numberFormatter = new Intl.NumberFormat(locale)
  const percentFormatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  function formatCurrency(value) {
    return currencyFormatter.format(toNumber(value))
  }

  function formatNumber(value, options = {}) {
    return new Intl.NumberFormat(locale, options).format(toNumber(value))
  }

  function formatPercent(value, options = {}) {
    if (options.isFraction) {
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, ...options }).format(toNumber(value))
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
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...(DATE_PRESETS[resolvedPreset] || DATE_PRESETS[dateFormat] || DATE_PRESETS.medium),
      ...options,
    }).format(date)
  }

  function formatTime(value, preset = 'short', options = {}) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...(TIME_PRESETS[preset] || TIME_PRESETS.short),
      ...options,
    }).format(date)
  }

  function formatDateTime(value, preset, options = {}) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    const resolvedPreset = resolveDatePreset(preset)
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...(DATE_PRESETS[resolvedPreset] || DATE_PRESETS[dateFormat] || DATE_PRESETS.medium),
      ...(TIME_PRESETS.short),
      ...options,
    }).format(date)
  }

  function formatDateRange(start, end, preset) {
    const startLabel = formatDate(start, preset)
    const endLabel = formatDate(end, preset)
    return [startLabel, endLabel].filter(Boolean).join(' - ')
  }

  function formatDateKey(value) {
    const date = toDate(value)
    if (!date || Number.isNaN(date.getTime())) return ''
    return formatDatePartsToKey(new Intl.DateTimeFormat('en-CA', {
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
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNumberParts(locale, currency) {
  const decimalParts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const currencyParts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(12345.6)
  return {
    decimal: decimalParts.find(part => part.type === 'decimal')?.value || '.',
    group: decimalParts.find(part => part.type === 'group')?.value || ',',
    currencySymbols: [...new Set(currencyParts.filter(part => part.type === 'currency').map(part => part.value))],
  }
}

function getDigitMap(locale) {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false })
  return Array.from({ length: 10 }, (_, digit) => [formatter.format(digit), String(digit)])
}

export function getAutoNumericOptions(preferences = {}, { minimumValue = null } = {}) {
  const { locale } = getLocalisationPreferences(preferences)
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
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

export function parseLocalizedAmountInput(rawValue, preferences = {}) {
  const raw = String(rawValue ?? '').trim()
  if (!raw) return null

  const { locale, currency } = getLocalisationPreferences(preferences)
  const { decimal, group, currencySymbols } = getNumberParts(locale, currency)
  let normalized = raw

  for (const [localized, digit] of getDigitMap(locale)) {
    if (localized !== digit) {
      normalized = normalized.replace(new RegExp(escapeRegExp(localized), 'g'), digit)
    }
  }

  for (const symbol of currencySymbols) {
    normalized = normalized.replace(new RegExp(escapeRegExp(symbol), 'g'), '')
  }
  normalized = normalized.replace(new RegExp(escapeRegExp(currency), 'gi'), '')
  normalized = normalized.replace(/[\s\u00a0\u202f]/g, '')
  if (group) normalized = normalized.replace(new RegExp(escapeRegExp(group), 'g'), '')
  if (decimal && decimal !== '.') normalized = normalized.replace(new RegExp(escapeRegExp(decimal), 'g'), '.')

  if (!/^[+-]?\d*(?:\.\d*)?$/.test(normalized) || ['+', '-', '.', '+.', '-.'].includes(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatLocalizedAmountForEdit(rawValue, preferences = {}) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return ''

  const { locale, currency } = getLocalisationPreferences(preferences)
  const parsed = parseLocalizedAmountInput(rawValue, preferences)
  if (parsed === null) return String(rawValue)

  const { decimal } = getNumberParts(locale, currency)
  const normalized = String(Number(parsed.toFixed(2)))
  return decimal === '.' ? normalized : normalized.replace('.', decimal)
}
