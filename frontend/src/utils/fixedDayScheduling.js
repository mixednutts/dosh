import { addMonths } from 'date-fns'

function startOfDay(value) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

export function getFixedDayOccurrenceForMonth(year, monthIndex, day) {
  if (!day) return null

  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 0)
  monthStart.setHours(0, 0, 0, 0)
  monthEnd.setHours(0, 0, 0, 0)

  if (day <= monthEnd.getDate()) {
    return new Date(year, monthIndex, day)
  }

  const nextDay = new Date(monthEnd)
  nextDay.setDate(monthEnd.getDate() + 1)
  return nextDay
}

export function listFixedDayOccurrencesInRange(rangeStart, rangeEnd, day) {
  if (!day) return []

  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  const occurrences = []
  let cursor = startOfDay(new Date(start.getFullYear(), start.getMonth(), 1))
  cursor = addMonths(cursor, -1)

  while (cursor <= end) {
    const candidate = getFixedDayOccurrenceForMonth(cursor.getFullYear(), cursor.getMonth(), day)
    if (candidate && candidate >= start && candidate <= end) {
      occurrences.push(candidate)
    }
    cursor = addMonths(cursor, 1)
  }

  return occurrences
}

export function getNextFixedDayOccurrence(referenceDate, day) {
  if (!day) return null

  const reference = startOfDay(referenceDate)
  const candidates = [
    getFixedDayOccurrenceForMonth(reference.getFullYear(), reference.getMonth() - 1, day),
    getFixedDayOccurrenceForMonth(reference.getFullYear(), reference.getMonth(), day),
    getFixedDayOccurrenceForMonth(reference.getFullYear(), reference.getMonth() + 1, day),
  ].filter(Boolean)

  return candidates.find(candidate => candidate >= reference) ?? null
}

export function getFixedDayFallbackMessage(day) {
  if (!day || Number(day) <= 28) return null
  return `If a month does not include day ${day}, Dosh will move this expense to the next day after month end.`
}
