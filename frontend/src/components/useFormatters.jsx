import { useLocalisation } from './LocalisationContext'

export function useFormatters() {
  const localisation = useLocalisation()
  return {
    fmt: v => localisation.formatCurrency(v),
    fmtDate: (v, preset = 'medium') => localisation.formatDate(v, preset),
    fmtDateTime: (v, preset = 'medium') => localisation.formatDateTime(v, preset),
    fmtDateRange: (start, end, preset = 'medium') => localisation.formatDateRange(start, end, preset),
    fmtPercent: v => localisation.formatPercent(v),
  }
}
