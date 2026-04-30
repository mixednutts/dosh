import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArchiveBoxArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, CalendarDaysIcon, MinusIcon, PlusIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { getBudgets, createBudget, createDemoBudget, deleteBudget, getPeriodsForBudget, getBudgetHealth, getPeriodDetail, generateAIInsight, getCurrentPeriodDetail } from '../api/client'
import Modal from '../components/Modal'
import { BackupRestoreModal } from '../components/modals'
import Spinner from '../components/Spinner'
import { LocalisationProvider, useLocalisation } from '../components/LocalisationContext'
import { listFixedDayOccurrencesInRange } from '../utils/fixedDayScheduling'
import { getCycleStage } from '../utils/periodStage'
import { LOCALE_OPTIONS, CURRENCY_OPTIONS, TIMEZONE_OPTIONS, DATE_FORMAT_OPTIONS } from '../utils/localisation'

const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly']
const CUSTOM_DAY_CYCLE_VALUE = '__custom_day_cycle__'

const emptyForm = {
  description: '',
  budgetowner: '',
  budget_frequency: 'Fortnightly',
  locale: 'en-AU',
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  date_format: 'medium',
}

function parseCustomDayCycle(frequency) {
  const match = /^Every (\d+) Days$/.exec(frequency || '')
  return match ? match[1] : ''
}

function healthDotClass(status) {
  if (status === 'Strong') return 'bg-success-500'
  if (status === 'Watch') return 'bg-amber-400'
  return 'bg-red-500'
}

function healthToneClass(status) {
  if (status === 'Strong') return 'text-success-700 dark:text-success-300'
  if (status === 'Watch') return 'text-amber-700 dark:text-amber-300'
  return 'text-red-700 dark:text-red-300'
}

function healthCircleClass(status) {
  if (status === 'Strong') return 'bg-success-500 text-white'
  if (status === 'Watch') return 'bg-amber-400 text-white'
  return 'bg-red-500 text-white'
}

function momentumToneClass(status) {
  if (status === 'Improving') return 'text-success-600 dark:text-success-400'
  if (status === 'Declining') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function MomentumIcon({ status }) {
  if (status === 'Improving') return <ArrowTrendingUpIcon className="h-4 w-4" />
  if (status === 'Declining') return <ArrowTrendingDownIcon className="h-4 w-4" />
  return <MinusIcon className="h-4 w-4" />
}

function formatMomentumDelta(value) {
  if (!value) return '0'
  return value > 0 ? `+${value}` : `${value}`
}


function healthStatusLabel(status) {
  if (status === 'Strong') return 'Tracking ok'
  if (status === 'Watch') return 'Check now'
  return 'Action needed'
}

function groupPeriods(periods) {
  const ordered = [...periods].sort((a, b) => parseISO(a.startdate) - parseISO(b.startdate))

  const pendingClosure = ordered.filter(period => getCycleStage(period) === 'PENDING_CLOSURE')
  const current = ordered.filter(period => getCycleStage(period) === 'CURRENT')
  const future = ordered.filter(period => getCycleStage(period) === 'PLANNED')
  const historical = ordered.filter(period => getCycleStage(period) === 'CLOSED')

  return { pendingClosure, current, future, historical }
}

function formatPeriodRange(period, formatDateRange) {
  return formatDateRange(period.startdate, period.enddate, 'short')
}

function startOfDay(date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function expenseOccurrencesInRange(expense, periodStart, periodEnd) {
  if (!expense?.freqtype || expense.freqtype === 'Always') return []

  if (expense.freqtype === 'Fixed Day of Month') {
    const day = Number.parseInt(expense.frequency_value, 10)
    if (!day) return []
    return listFixedDayOccurrencesInRange(periodStart, periodEnd, day)
  }

  if (expense.freqtype === 'Every N Days') {
    const interval = Number.parseInt(expense.frequency_value, 10)
    if (!interval || !expense.effectivedate) return []

    const occurrences = []
    let cursor = startOfDay(parseISO(expense.effectivedate))
    if (cursor > periodEnd) return []

    if (cursor < periodStart) {
      const deltaDays = Math.ceil((periodStart - cursor) / 86400000)
      const steps = Math.ceil(deltaDays / interval)
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + (steps * interval))
    }

    while (cursor <= periodEnd) {
      occurrences.push(new Date(cursor))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + interval)
    }

    return occurrences
  }

  return []
}

function buildCalendarEvents(currentPeriod, currentPeriodDetail) {
  const details = Array.isArray(currentPeriodDetail) ? currentPeriodDetail.filter(Boolean) : []

  if (details.length === 0) {
    return {
      events: [],
    }
  }

  const allEvents = details.flatMap(detail => {
    const periodStart = startOfDay(parseISO(detail.period.startdate))
    const periodEnd = startOfDay(parseISO(detail.period.enddate))
    const incomes = detail.incomes ?? []
    const expenses = detail.expenses ?? []

    const cycleStartEvent = {
      key: `cycle-start-${detail.period.finperiodid}`,
      date: periodStart,
      kind: 'cycle-start',
      title: 'Budget cycle starts',
      amount: null,
      finperiodid: detail.period.finperiodid,
      cycleStatus: detail.period.cycle_status,
    }

    const incomeEvents = incomes
      .filter(income => Number(income.budgetamount ?? 0) > 0)
      .map(income => ({
        key: `income-${detail.period.finperiodid}-${income.incomedesc}`,
        date: periodStart,
        kind: 'income',
        title: income.incomedesc,
        amount: income.budgetamount,
        finperiodid: detail.period.finperiodid,
        cycleStatus: detail.period.cycle_status,
      }))

    const expenseEvents = expenses.flatMap(expense =>
      expenseOccurrencesInRange(expense, periodStart, periodEnd).map((date, index) => ({
        key: `expense-${detail.period.finperiodid}-${expense.expensedesc}-${index}-${date.toISOString()}`,
        date,
        kind: 'expense',
        title: expense.expensedesc,
        amount: expense.budgetamount,
        finperiodid: detail.period.finperiodid,
        cycleStatus: detail.period.cycle_status,
      }))
    )

    return [cycleStartEvent, ...incomeEvents, ...expenseEvents]
  })

  const sortedEvents = allEvents.toSorted((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) return a.date - b.date
    const rank = { 'cycle-start': 0, income: 1, expense: 2 }
    if (a.kind !== b.kind) return rank[a.kind] - rank[b.kind]
    return a.title.localeCompare(b.title)
  })

  return {
    events: sortedEvents,
  }
}

function buildMonthGrid(monthDate) {
  const monthStart = startOfMonth(monthDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
  const days = []

  let cursor = new Date(calendarStart)
  while (cursor <= calendarEnd) {
    days.push(new Date(cursor))
    const nextCursor = new Date(cursor)
    nextCursor.setDate(nextCursor.getDate() + 1)
    cursor = nextCursor
  }

  const weeks = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

function getCalendarDefaultMonth(currentPeriod, today) {
  if (!currentPeriod) return today

  const cycleStart = startOfDay(parseISO(currentPeriod.startdate))
  const cycleEnd = startOfDay(parseISO(currentPeriod.enddate))
  if (today >= cycleStart && today <= cycleEnd) return today
  return cycleStart
}

function buildEventsByDate(events, visibleMonth, formatDateKey) {
  return events
    .filter(event => isSameMonth(event.date, visibleMonth))
    .reduce((acc, event) => {
      const key = formatDateKey(event.date)
      acc[key] = [...(acc[key] ?? []), event]
      return acc
    }, {})
}

function buildCompactDayIndicators(dayEvents, formatCurrency) {
  const incomeEvents = dayEvents.filter(event => event.kind === 'income')
  const expenseEvents = dayEvents.filter(event => event.kind === 'expense')

  const indicators = []

  if (incomeEvents.length > 0) {
    indicators.push({
      key: 'income',
      kind: 'income',
      title: incomeEvents.map(event => `${event.title} · ${formatCurrency(event.amount)}`).join('\n'),
    })
  }

  if (expenseEvents.length > 0) {
    indicators.push({
      key: 'expense',
      kind: 'expense',
      title: expenseEvents.map(event => `${event.title} · ${formatCurrency(event.amount)}`).join('\n'),
    })
  }

  return indicators
}

function buildDayEventsTitle(dayEvents, formatCurrency) {
  return dayEvents
    .map(event => {
      if (event.kind === 'cycle-start') return event.title
      return `${event.title} · ${formatCurrency(event.amount)}`
    })
    .join('\n')
}

function getEventContainerClass(kind) {
  if (kind === 'cycle-start') {
    return 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20'
  }
  if (kind === 'income') {
    return 'border-dosh-200 bg-dosh-50 dark:border-dosh-800 dark:bg-dosh-950/20'
  }
  return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
}

function getEventKindLabel(kind) {
  if (kind === 'cycle-start') return 'Cycle start'
  if (kind === 'income') return 'Income'
  return 'Expense'
}

function getCalendarDaySurfaceClass({ isToday, hasCycleStart, isCycleDay }) {
  if (isToday) {
    return 'border-dosh-400 bg-dosh-50 shadow-sm dark:border-dosh-500 dark:bg-dosh-950/30'
  }
  if (hasCycleStart) {
    return 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-600 dark:bg-sky-950/30'
  }
  if (isCycleDay) {
    return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/70'
  }
  return 'border-transparent bg-transparent'
}

function getCalendarEventPillClass(kind) {
  if (kind === 'cycle-start') {
    return 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100'
  }
  if (kind === 'income') {
    return 'bg-dosh-100 text-dosh-900 dark:bg-dosh-900/40 dark:text-dosh-100'
  }
  return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
}

function getCurrentPeriodDetailText(daysRemaining, cycleStage = null) {
  if (cycleStage === 'PENDING_CLOSURE') {
    return 'Cycle end has passed and close-out is still outstanding'
  }
  if (daysRemaining == null) {
    return 'Generate a budget cycle to begin tracking'
  }
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
}

function PendingClosureList({ periods, budgetId }) {
  const { formatDateRange } = useLocalisation()

  if (periods.length === 0) return null

  const visiblePeriods = periods.slice(0, 3)
  const hiddenCount = Math.max(0, periods.length - visiblePeriods.length)

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800/70 dark:bg-amber-950/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Pending Closure</p>
        <span className="text-[11px] text-amber-700 dark:text-amber-400">{periods.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {visiblePeriods.map(period => (
          <div key={period.finperiodid} className="flex items-start justify-between gap-2 rounded-lg border border-amber-200/80 bg-white px-2.5 py-2 dark:border-amber-900/60 dark:bg-slate-900/70">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium leading-tight text-gray-900 dark:text-gray-100">{formatPeriodRange(period, formatDateRange)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                to={`/budgets/${budgetId}/periods/${period.finperiodid}`}
                className="inline-flex h-7 shrink-0 items-center rounded-md border border-slate-300 px-2 text-[11px] font-medium text-slate-700 transition-colors hover:border-dosh-400 hover:text-dosh-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-dosh-500 dark:hover:text-white"
              >
                Open
              </Link>
              <Link
                to={`/budgets/${budgetId}/periods/${period.finperiodid}?closeout=1`}
                className="inline-flex h-7 shrink-0 items-center rounded-md border border-slate-300 px-2 text-[11px] font-medium text-slate-700 transition-colors hover:border-dosh-400 hover:text-dosh-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-dosh-500 dark:hover:text-white"
              >
                Close Out
              </Link>
            </div>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <Link
            to={`/budgets/${budgetId}#pending-closure`}
            className="inline-block text-xs font-medium text-amber-800 hover:underline dark:text-amber-300"
          >
            View {hiddenCount} more pending closure cycle{hiddenCount === 1 ? '' : 's'}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function CalendarDayEventsModal({ date, events, onClose }) {
  const { formatCurrency, formatDate } = useLocalisation()
  const orderedEvents = [...events].sort((a, b) => {
    const rank = { 'cycle-start': 0, income: 1, expense: 2 }
    if (a.kind !== b.kind) return rank[a.kind] - rank[b.kind]
    return a.title.localeCompare(b.title)
  })

  return (
    <Modal title={formatDate(date, 'long')} onClose={onClose} size="md">
      <div className="space-y-2">
        {orderedEvents.map(event => (
          <div
            key={`day-event-${event.key}`}
            className={`rounded-md border px-3 py-2 ${getEventContainerClass(event.kind)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{event.title}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {getEventKindLabel(event.kind)}
                </p>
              </div>
              {event.amount !== null ? (
                <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(event.amount)}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function getCalendarRelevantPeriods(periods, today) {
  const lookaheadEnd = endOfMonth(addMonths(today, 2))

  return periods.filter(period => {
    if (!['CURRENT', 'PENDING_CLOSURE', 'PLANNED'].includes(getCycleStage(period))) return false
    const periodStart = startOfDay(parseISO(period.startdate))
    const periodEnd = startOfDay(parseISO(period.enddate))
    return periodStart <= lookaheadEnd && periodEnd >= today
  })
}

function dayFallsWithinPeriods(day, periods) {
  return periods.some(period => {
    const periodStart = startOfDay(parseISO(period.startdate))
    const periodEnd = startOfDay(parseISO(period.enddate))
    return day >= periodStart && day <= periodEnd
  })
}

function CalendarMonthGrid({ periods, visibleMonth, onChangeMonth, today, events, compact = false, onSelectDay = null }) {
  const { formatCurrency, formatDate, formatDateKey } = useLocalisation()
  const monthWeeks = buildMonthGrid(visibleMonth)
  const eventsByDate = buildEventsByDate(events, visibleMonth, formatDateKey)

  return (
    <div className={`rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-dosh-300 hover:text-dosh-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-dosh-700 dark:hover:text-dosh-300 ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
          onClick={() => onChangeMonth(startOfMonth(subMonths(visibleMonth, 1)))}
          aria-label="Previous month"
        >
          <ArrowLeftIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
        <div className="text-center">
          <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-900 dark:text-gray-100`}>
            {formatDate(visibleMonth, 'monthYear')}
          </p>
          {!compact ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Current cycle timing</p>
          ) : null}
        </div>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-dosh-300 hover:text-dosh-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-dosh-700 dark:hover:text-dosh-300 ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
          onClick={() => onChangeMonth(startOfMonth(addMonths(visibleMonth, 1)))}
          aria-label="Next month"
        >
          <ArrowRightIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>
      <div className={`grid grid-cols-7 gap-1 text-center font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className={compact ? 'py-0.5' : 'py-1'}>{day}</div>
        ))}
      </div>
      <div className="mt-1 space-y-1">
        {monthWeeks.map((week, weekIndex) => (
          <div key={`${formatDateKey(visibleMonth)}-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const dateKey = formatDateKey(day)
              const dayEvents = eventsByDate[dateKey] ?? []
              const hasCycleStart = dayEvents.some(event => event.kind === 'cycle-start')
              const inCurrentMonth = isSameMonth(day, visibleMonth)
              const isToday = isSameDay(day, today)
              const isCycleDay = dayFallsWithinPeriods(day, periods)
              const canOpenDay = dayEvents.length > 0 && typeof onSelectDay === 'function'
              const dayTitle = canOpenDay ? buildDayEventsTitle(dayEvents, formatCurrency) : undefined

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={`rounded-md border px-1 py-1 ${
                    compact ? 'min-h-[36px]' : 'min-h-[72px]'
                  } ${getCalendarDaySurfaceClass({ isToday, hasCycleStart, isCycleDay })} ${
                    canOpenDay ? 'cursor-pointer hover:border-dosh-300 dark:hover:border-dosh-700' : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (canOpenDay) onSelectDay(day, dayEvents)
                  }}
                  disabled={!canOpenDay}
                  aria-label={canOpenDay ? `View events for ${formatDate(day, 'long')}` : undefined}
                  title={dayTitle}
                >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-semibold ${
                        inCurrentMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'
                      }`}>
                        {formatDate(day, 'day')}
                      </span>
                  </div>
                  {compact ? (
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {buildCompactDayIndicators(dayEvents, formatCurrency).map(indicator => (
                        <span
                          key={`${dateKey}-${indicator.key}`}
                          className={`h-1.5 w-2.5 rounded-full ${indicator.kind === 'income' ? 'bg-dosh-500' : 'bg-amber-500'}`}
                          title={indicator.title}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div
                          key={event.key}
                          className={`rounded px-1.5 py-1 text-[10px] leading-tight ${getCalendarEventPillClass(event.kind)}`}
                          title={event.kind === 'cycle-start' ? event.title : `${event.title} · ${formatCurrency(event.amount)}`}
                        >
                          <div className="truncate font-semibold">{event.title}</div>
                          <div className="truncate opacity-80">
                            {event.kind === 'cycle-start' ? 'Cycle start' : formatCurrency(event.amount)}
                          </div>
                        </div>
                      ))}
                      {dayEvents.length > 2 ? (
                        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                          +{dayEvents.length - 2} more
                        </div>
                      ) : null}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function FullCalendarModal({ budgetName, periods, events, today, onClose }) {
  const { formatDate } = useLocalisation()
  const todayMonth = startOfMonth(getCalendarDefaultMonth(periods[0], today))
  const [visibleMonth, setVisibleMonth] = useState(todayMonth)
  const viewingTodayMonth = isSameMonth(visibleMonth, todayMonth)
  const [selectedDay, setSelectedDay] = useState(null)

  return (
    <>
      <Modal title={`Calendar for ${budgetName || 'Untitled Budget'}`} onClose={onClose} size="xl">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className={`rounded-full border border-dosh-200 bg-dosh-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-dosh-800 transition-colors hover:bg-dosh-100 dark:border-dosh-800 dark:bg-dosh-950/30 dark:text-dosh-200 dark:hover:bg-dosh-950/50 ${viewingTodayMonth ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
              onClick={() => {
                if (!viewingTodayMonth) setVisibleMonth(todayMonth)
              }}
              disabled={viewingTodayMonth}
            >
              Today {formatDate(today, 'compact')}
            </button>
          </div>
          <CalendarMonthGrid
            periods={periods}
            visibleMonth={visibleMonth}
            onChangeMonth={setVisibleMonth}
            today={today}
            events={events}
            onSelectDay={(date, dayEvents) => setSelectedDay({ date, events: dayEvents })}
          />
        </div>
      </Modal>
      {selectedDay ? (
        <CalendarDayEventsModal
          date={selectedDay.date}
          events={selectedDay.events}
          onClose={() => setSelectedDay(null)}
        />
      ) : null}
    </>
  )
}


function BalanceSummaryCard({ currentPeriod, currentPeriodDetail, isLoading }) {
  const { formatCurrency } = useLocalisation()
  if (!currentPeriod) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Balance</p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">No current budget cycle</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Generate a budget cycle to start tracking balances</p>
      </div>
    )
  }

  if (isLoading || !currentPeriodDetail) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-3 w-36 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    )
  }

  const balances = currentPeriodDetail.balances ?? []
  const totalClosing = balances.reduce((sum, balance) => sum + Number(balance.closing_amount ?? 0), 0)

  if (balances.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Balance</p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">No accounts yet</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add account balances in setup to see a summary here</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Balance</p>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span>Account</span>
        <span className="text-right">Closing</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {balances.map(balance => (
          <div key={balance.balancedesc} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-xs">
            <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">{balance.balancedesc}</span>
            <span className="shrink-0 text-right font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(balance.closing_amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-gray-200 pt-2 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</span>
        <span className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalClosing)}</span>
      </div>
    </div>
  )
}

function CalendarSummaryCard({ currentPeriod, calendarPeriods, calendarPeriodDetails, isLoading, budgetName }) {
  const { getToday } = useLocalisation()
  const today = startOfDay(getToday())
  const defaultMonth = getCalendarDefaultMonth(currentPeriod, today)
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(defaultMonth))
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    setVisibleMonth(startOfMonth(defaultMonth))
  }, [defaultMonth.getTime()])

  if (!currentPeriod) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Calendar</p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">No current budget cycle</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Generate a budget cycle to map income timing and due dates</p>
      </div>
    )
  }

  if (isLoading || calendarPeriodDetails.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-3 space-y-2">
          <div className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    )
  }

  const { events } = buildCalendarEvents(currentPeriod, calendarPeriodDetails)

  return (
    <>
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Calendar</p>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-dosh-300 hover:text-dosh-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-dosh-700 dark:hover:text-dosh-300"
            onClick={() => setShowFullCalendar(true)}
            aria-label="Open full calendar"
            title="Open full calendar"
          >
            <CalendarDaysIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <CalendarMonthGrid
          periods={calendarPeriods}
          visibleMonth={visibleMonth}
          onChangeMonth={setVisibleMonth}
          today={today}
          events={events}
          compact
          onSelectDay={(date, dayEvents) => setSelectedDay({ date, events: dayEvents })}
        />
      </div>
    </div>
    {selectedDay ? (
      <CalendarDayEventsModal
        date={selectedDay.date}
        events={selectedDay.events}
        onClose={() => setSelectedDay(null)}
      />
    ) : null}
    {showFullCalendar ? (
      <FullCalendarModal
        budgetName={budgetName}
        periods={calendarPeriods}
        events={events}
        today={today}
        onClose={() => setShowFullCalendar(false)}
      />
    ) : null}
    </>
  )
}

function BudgetStats({ budgetId, budgetName, periods = [], currentPeriodDetail, calendarPeriods = [], calendarPeriodDetails = [], currentPeriodDetailLoading, health, onOpenHealth, onOpenCurrentPeriodCheck }) {
  const { formatDateRange, getToday } = useLocalisation()
  const grouped = useMemo(() => groupPeriods(periods), [periods])
  const currentPeriod = grouped.current[0] ?? null
  const currentPeriodStage = currentPeriod ? getCycleStage(currentPeriod) : null
  const daysRemaining = currentPeriod
    ? Math.max(0, differenceInCalendarDays(parseISO(currentPeriod.enddate), getToday()) + 1)
    : null
  const currentPeriodValue = currentPeriod ? formatPeriodRange(currentPeriod, formatDateRange) : 'No current budget cycle'
  const currentPeriodDetailText = getCurrentPeriodDetailText(daysRemaining, currentPeriodStage)

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Budget Cycle</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{currentPeriodValue}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{currentPeriodDetailText}</p>
            {currentPeriod ? (
              <Link
                to={`/budgets/${budgetId}/periods/${currentPeriod.finperiodid}`}
                className="mt-2 inline-block text-xs font-medium text-dosh-700 hover:underline dark:text-dosh-400"
              >
                Open current budget cycle
              </Link>
            ) : null}
          </div>
          {health?.current_period_check ? (
            <div className="flex flex-col items-center gap-2">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${healthCircleClass(health.current_period_check.status)}`}>
                {health.current_period_check.score}
              </div>
              <button type="button" className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" onClick={onOpenCurrentPeriodCheck}>
                Health Details
              </button>
            </div>
          ) : null}
        </div>
        {health?.current_period_check && (
          <p className={`mt-3 text-sm font-medium ${healthToneClass(health.current_period_check.status)}`}>
            {health.current_period_check.summary}
          </p>
        )}
        <PendingClosureList periods={grouped.pendingClosure} budgetId={budgetId} />
      </div>
      <BalanceSummaryCard
        currentPeriod={currentPeriod}
        currentPeriodDetail={currentPeriodDetail}
        isLoading={currentPeriodDetailLoading}
      />
      <CalendarSummaryCard
        currentPeriod={currentPeriod}
        calendarPeriods={calendarPeriods}
        calendarPeriodDetails={calendarPeriodDetails}
        isLoading={currentPeriodDetailLoading}
        budgetName={budgetName}
      />
      {health && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Budget Health</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${healthCircleClass(health.overall_status)}`}>
                <span className="text-3xl font-light tracking-tight">{health.overall_score}</span>
              </div>
            </div>
            <button type="button" className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" onClick={onOpenHealth}>
              Overall Health Details
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{health.momentum_summary}</p>
        </div>
      )}
    </div>
  )
}

const SCORING_CURVE_DESCRIPTIONS = {
  setup_health: 'Pass/fail per category. All categories met = 100. Missing categories are penalised based on sensitivity.',
  budget_vs_actual_amount: 'Within tolerance = 100. Linear decay to 70 as overrun approaches tolerance. Beyond tolerance, penalty per dollar over.',
  budget_vs_actual_lines: 'Within tolerance = 100. Linear decay to 70 as over-budget lines approach tolerance. Beyond tolerance, penalty per line over.',
  in_cycle_budget_adjustments: 'Zero adjustments = 100. Each adjustment within tolerance reduces score by 15. Beyond tolerance, penalty per adjustment over.',
  revisions_on_paid_expenses: 'Zero revisions = 100. Each revision within tolerance reduces score by 15. Beyond tolerance, penalty per revision over.',
  budget_cycles_pending_closeout: 'Zero pending = 100. Each pending cycle within tolerance reduces score by 20. Beyond tolerance, penalty per cycle over.',
}

function EvidenceRow({ item }) {
  if (typeof item === 'string') {
    return <p className="text-xs text-gray-500 dark:text-gray-400">{item}</p>
  }
  const overLimit = item.raw_limit !== undefined && item.raw_value !== undefined && item.raw_value > item.raw_limit
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/80">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${overLimit ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{item.value}</p>
          {item.limit && <span className="text-xs text-gray-400 dark:text-gray-500">/ {item.limit}</span>}
        </div>
      </div>
      {item.detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>}
    </div>
  )
}

EvidenceRow.propTypes = {
  item: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({
    label: PropTypes.string,
    value: PropTypes.string,
    raw_value: PropTypes.number,
    raw_unit: PropTypes.string,
    limit: PropTypes.string,
    raw_limit: PropTypes.number,
    detail: PropTypes.string,
  })]).isRequired,
}

function MetricCard({ metric }) {
  const [expanded, setExpanded] = useState(false)
  const [showFormula, setShowFormula] = useState(false)
  const metricKey = metric.metric_key || metric.key
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{metric.name}</h3>
            <span className={`h-3.5 w-3.5 rounded-full ${healthDotClass(metric.status)}`} />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Score {metric.score}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{metric.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            {metric.evidence.map((item, idx) => (
              <EvidenceRow key={`${metricKey || metric.name}-${item.label || idx}`} item={item} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowFormula(v => !v)}
            className="w-full rounded-md border border-dosh-200 bg-dosh-50 px-3 py-2 text-xs font-medium text-dosh-800 hover:bg-dosh-100 dark:border-dosh-800 dark:bg-dosh-950 dark:text-dosh-200 dark:hover:bg-dosh-900"
          >
            {showFormula ? 'Hide Formula' : 'Show Formula'}
          </button>
          {showFormula && (
            <div className="space-y-2 rounded-md border border-dosh-100 bg-dosh-50/40 px-3 py-2 dark:border-dosh-900 dark:bg-dosh-950/20">
              {metricKey && SCORING_CURVE_DESCRIPTIONS[metricKey] && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Scoring curve:</span> {SCORING_CURVE_DESCRIPTIONS[metricKey]}
                </p>
              )}
              {metric.calculation && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Calculation:</span> {metric.calculation}
                </p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Weight:</span> {Math.round((metric.weight || 0) * 100)}%
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Contribution:</span> {metric.score} × {Math.round((metric.weight || 0) * 100)}% = {metric.weighted_contribution ?? (metric.score * (metric.weight || 0)).toFixed(1)} pts
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

MetricCard.propTypes = {
  metric: PropTypes.shape({
    name: PropTypes.string.isRequired,
    key: PropTypes.string,
    metric_key: PropTypes.string,
    score: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    summary: PropTypes.string,
    weight: PropTypes.number,
    weighted_contribution: PropTypes.number,
    evidence: PropTypes.array.isRequired,
    calculation: PropTypes.string,
  }).isRequired,
}

export function CurrentPeriodCheckPanel({ assessment, evaluatedAt, showMetricCards = true, defaultMetricCardsOpen = true }) {
  const { formatDateTime, timezone } = useLocalisation()
  const metrics = assessment.metrics || []
  const [metricsOpen, setMetricsOpen] = useState(defaultMetricCardsOpen)
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900 dark:bg-none">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className={`text-sm font-semibold ${healthToneClass(assessment.status)}`}>{assessment.summary}</p>
            {evaluatedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Evaluated {formatDateTime(evaluatedAt, 'medium')} {timezone}
              </p>
            )}
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-light shadow-sm ${healthCircleClass(assessment.status)}`}>
            {assessment.score}
          </div>
        </div>
      </div>

      {showMetricCards && (
        <div>
          <button
            type="button"
            onClick={() => setMetricsOpen(v => !v)}
            className="text-xs font-medium text-dosh-700 hover:text-dosh-800 dark:text-dosh-300 dark:hover:text-dosh-200"
          >
            {metricsOpen ? '[-] Hide details' : '[+] Show details'}
          </button>
          {metricsOpen && (
            <div className="mt-3 space-y-3">
              {metrics.map(metric => (
                <MetricCard key={metric.key || metric.name} metric={metric} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

CurrentPeriodCheckPanel.propTypes = {
  assessment: PropTypes.shape({
    status: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    metrics: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  evaluatedAt: PropTypes.string,
  showMetricCards: PropTypes.bool,
  defaultMetricCardsOpen: PropTypes.bool,
}

function CurrentPeriodCheckModal({ budget, assessment, evaluatedAt, onClose }) {
  const [aiInsight, setAiInsight] = useState(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const [aiInsightError, setAiInsightError] = useState(null)
  const aiEnabled = budget?.ai_insights_enabled && budget?.ai_api_key_configured

  const handleGenerateInsight = async () => {
    setAiInsightLoading(true)
    setAiInsightError(null)
    try {
      const period = await getCurrentPeriodDetail(budget.budgetid)
      const result = await generateAIInsight(budget.budgetid, period.period.finperiodid)
      setAiInsight(result.insight)
    } catch (err) {
      setAiInsightError(err?.response?.data?.detail || 'Failed to generate AI insight.')
    } finally {
      setAiInsightLoading(false)
    }
  }

  return (
    <Modal title={`Current Budget Cycle Check — ${budget.description || 'Untitled Budget'}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <CurrentPeriodCheckPanel assessment={assessment} evaluatedAt={evaluatedAt} />
        {aiEnabled && (
          <div className="rounded-xl border border-dosh-200 bg-dosh-50 p-4 dark:border-dosh-800 dark:bg-dosh-900/20">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">AI Insight</p>
              {!aiInsight && !aiInsightLoading && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={handleGenerateInsight}
                >
                  Generate Insight
                </button>
              )}
            </div>
            {aiInsightLoading && (
              <div className="flex items-center gap-2 py-3">
                <svg className="animate-spin text-dosh-600 w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs text-gray-500">Generating insight...</span>
              </div>
            )}
            {aiInsightError && (
              <p className="mt-2 text-xs text-red-600">{aiInsightError}</p>
            )}
            {aiInsight && (
              <div className="mt-2 space-y-2">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{aiInsight}</p>
                <button
                  type="button"
                  className="text-xs text-dosh-700 hover:underline dark:text-dosh-300"
                  onClick={handleGenerateInsight}
                >
                  Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function BudgetHealthModal({ budget, health, onClose }) {
  const { formatDateTime, timezone } = useLocalisation()
  return (
    <Modal title={`Budget Health — ${budget.description || 'Untitled Budget'}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-dosh-50 to-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900 dark:bg-none">
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${healthCircleClass(health.overall_status)}`}>
                <span className="text-3xl font-light tracking-tight">{health.overall_score}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{health.overall_summary}</p>
              <p className={`mt-1 flex items-center gap-1 text-sm ${momentumToneClass(health.momentum_status)}`}>
                <MomentumIcon status={health.momentum_status} />
                <span>{health.momentum_summary}</span>
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Evaluated {formatDateTime(health.evaluated_at, 'medium')} {timezone}
              </p>
            </div>
          </div>
        </div>

        {health.pillars.map(pillar => (
          <MetricCard key={pillar.key || pillar.name} metric={pillar} />
        ))}
      </div>
    </Modal>
  )
}

function BudgetForm({ initial = emptyForm, onSubmit, onCreateDemo, onClose, loading, demoLoading, showDemoOption }) {
  const [form, setForm] = useState(initial)
  const [showBudgetHelp, setShowBudgetHelp] = useState(false)
  const [frequencySelection, setFrequencySelection] = useState(() => (
    FREQUENCIES.includes(initial.budget_frequency) ? initial.budget_frequency : CUSTOM_DAY_CYCLE_VALUE
  ))
  const [customCycleDays, setCustomCycleDays] = useState(() => parseCustomDayCycle(initial.budget_frequency) || '')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const resolvedFrequency = frequencySelection === CUSTOM_DAY_CYCLE_VALUE
    ? `Every ${customCycleDays} Days`
    : frequencySelection
  const isCustomCycleInvalid = frequencySelection === CUSTOM_DAY_CYCLE_VALUE && (
    !customCycleDays || Number(customCycleDays) < 2 || Number(customCycleDays) > 365
  )

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            We will create our basic budget information here, then guide you through setup before we create your first budget cycle.
          </p>
        </div>
        <div className="pl-2">
          <button
            type="button"
            onClick={() => setShowBudgetHelp(current => !current)}
            className="inline-flex items-center gap-2 text-xs transition-colors"
            aria-expanded={showBudgetHelp}
            aria-controls="budget-help-panel"
          >
            <span className="text-dosh-600 underline underline-offset-2 hover:text-dosh-700 dark:text-dosh-300 dark:hover:text-dosh-200">
              More about Budgets and Budget Cycles
            </span>
            <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
              {showBudgetHelp ? 'Hide' : 'Show'}
            </span>
          </button>
          {showBudgetHelp ? (
            <div id="budget-help-panel" className="mt-3 rounded-lg border border-dosh-200 bg-dosh-50/70 px-4 py-4 dark:border-dosh-800 dark:bg-dosh-950/30">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                A budget is a financial plan that estimates income and expenses over a specific period. It acts as a roadmap for how you intend to spend, save, and manage your money.
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                A Dosh budget is made of various Account, Expense &amp; Investment information that allows you to manage and track your personal finances through your budget cycles.
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                A budget cycle is a repeating period in days that represents the time frame of your financial planning. The end of one budget cycle directly informs the beginning of the next while also allowing evaluation of how the budget performed during that cycle.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={e => {
        e.preventDefault()
        if (isCustomCycleInvalid) return
        onSubmit({ ...form, budget_frequency: resolvedFrequency })
      }} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="budget-description" className="label">Description</label>
            <input id="budget-description" className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Household Budget 2025" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="budget-owner" className="label">Owner <span className="text-red-500">*</span></label>
            <input id="budget-owner" required className="input" value={form.budgetowner} onChange={e => set('budgetowner', e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="budget-cycle" className="label">Budget Cycle <span className="text-red-500">*</span></label>
            <select
              id="budget-cycle"
              required
              className="input"
              value={frequencySelection}
              onChange={e => {
                setFrequencySelection(e.target.value)
                if (e.target.value !== CUSTOM_DAY_CYCLE_VALUE) {
                  set('budget_frequency', e.target.value)
                }
              }}
            >
              {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              <option value={CUSTOM_DAY_CYCLE_VALUE}>Custom</option>
            </select>
          </div>
          {frequencySelection === CUSTOM_DAY_CYCLE_VALUE ? (
            <div>
              <label htmlFor="budget-cycle-length-days" className="label">Cycle length (days) <span className="text-red-500">*</span></label>
              <input
                id="budget-cycle-length-days"
                required
                min="2"
                max="365"
                type="number"
                className="input"
                value={customCycleDays}
                onChange={e => {
                  const nextValue = e.target.value
                  if (!nextValue) {
                    setCustomCycleDays('')
                    return
                  }
                  const parsedValue = Number(nextValue)
                  if (Number.isNaN(parsedValue)) {
                    return
                  }
                  setCustomCycleDays(nextValue)
                }}
                onBlur={() => {
                  if (!customCycleDays) return
                  const parsedValue = Number(customCycleDays)
                  if (Number.isNaN(parsedValue)) {
                    setCustomCycleDays('')
                    return
                  }
                  if (parsedValue < 2) {
                    setCustomCycleDays('2')
                    return
                  }
                  if (parsedValue > 365) {
                    setCustomCycleDays('365')
                  }
                }}
                aria-label="Cycle length in days"
              />
              {isCustomCycleInvalid ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Enter a whole number between 2 and 365.
                </p>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          <div>
            <label htmlFor="budget-locale" className="label">Locale</label>
            <select id="budget-locale" className="input" value={form.locale} onChange={e => set('locale', e.target.value)}>
              {LOCALE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="budget-currency" className="label">Currency</label>
            <select id="budget-currency" className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="budget-timezone" className="label">Timezone</label>
            <select id="budget-timezone" className="input" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="budget-date-format" className="label">Date Format</label>
            <select id="budget-date-format" className="input" value={form.date_format} onChange={e => set('date_format', e.target.value)}>
              {DATE_FORMAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} — {opt.sample}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
          After creating the basic budget information, we will add accounts, income sources, and expense items before generating our first budget cycle.
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading || demoLoading || isCustomCycleInvalid}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>

      {showDemoOption ? (
        <div className="rounded-lg border border-dashed border-dosh-200 bg-dosh-50/60 px-4 py-4 dark:border-dosh-800 dark:bg-dosh-950/30">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Demonstration and Evaluation</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Create a fully populated demo budget with historical close-outs, a live current cycle, linked savings and investment setup, and several upcoming cycles.
          </p>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn-secondary" onClick={onCreateDemo} disabled={loading || demoLoading}>
              {demoLoading ? 'Creating Demo…' : 'Create Demo Budget'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

BudgetForm.propTypes = {
  initial: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCreateDemo: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  demoLoading: PropTypes.bool,
  showDemoOption: PropTypes.bool,
}

export default function BudgetsPage() {
  const { getToday } = useLocalisation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [healthModal, setHealthModal] = useState(null)
  const [currentCheckModal, setCurrentCheckModal] = useState(null)
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const today = startOfDay(getToday())

  const { data: budgets = [], isLoading } = useQuery({ queryKey: ['budgets'], queryFn: getBudgets })
  const periodQueries = useQueries({
    queries: budgets.map(budget => ({
      queryKey: ['periods', budget.budgetid],
      queryFn: () => getPeriodsForBudget(budget.budgetid),
      staleTime: 60_000,
    })),
  })
  const healthQueries = useQueries({
    queries: budgets.map(budget => ({
      queryKey: ['budget-health', budget.budgetid],
      queryFn: () => getBudgetHealth(budget.budgetid),
      staleTime: 60_000,
    })),
  })
  const calendarPeriodMeta = budgets.flatMap((budget, index) => {
    const periods = periodQueries[index]?.data ?? []
    return getCalendarRelevantPeriods(periods, today).map(period => ({
      budgetid: budget.budgetid,
      finperiodid: period.finperiodid,
      period,
    }))
  })
  const calendarPeriodDetailQueries = useQueries({
    queries: calendarPeriodMeta.map(meta => ({
      queryKey: ['budget-calendar-period-detail', meta.budgetid, meta.finperiodid],
      queryFn: () => getPeriodDetail(meta.budgetid, meta.finperiodid),
      staleTime: 60_000,
    })),
  })
  const calendarPeriodDetailsById = useMemo(
    () => Object.fromEntries(
      calendarPeriodMeta.map((meta, index) => [meta.finperiodid, calendarPeriodDetailQueries[index]?.data ?? null])
    ),
    [calendarPeriodMeta, calendarPeriodDetailQueries]
  )
  const calendarBudgetLoadingByBudgetId = useMemo(
    () => Object.fromEntries(
      budgets.map((budget, budgetIndex) => {
        const periods = periodQueries[budgetIndex]?.data ?? []
        const relevantIds = getCalendarRelevantPeriods(periods, today).map(period => period.finperiodid)
        const isLoadingDetails = relevantIds.some(finperiodid => {
          const metaIndex = calendarPeriodMeta.findIndex(meta => meta.finperiodid === finperiodid)
          return metaIndex >= 0 && calendarPeriodDetailQueries[metaIndex]?.isLoading
        })
        return [budget.budgetid, isLoadingDetails]
      })
    ),
    [budgets, periodQueries, today, calendarPeriodMeta, calendarPeriodDetailQueries]
  )

  const create = useMutation({
    mutationFn: createBudget,
    onSuccess: (newBudget) => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      navigate(`/budgets/${newBudget.budgetid}/setup`)
    },
  })
  const createDemo = useMutation({
    mutationFn: createDemoBudget,
    onSuccess: (newBudget) => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      setModal(null)
      navigate(`/budgets/${newBudget.budgetid}`)
    },
    onError: (error) => {
      const msg = error?.response?.data?.detail || 'Unable to create demo budget right now.'
      globalThis.alert(msg)
    },
  })

  const remove = useMutation({
    mutationFn: deleteBudget,
    onSuccess: (_, budgetId) => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['periods', budgetId] })
      qc.invalidateQueries({ queryKey: ['budget-health', budgetId] })
    },
  })

  const handleSubmit = form => {
    create.mutate(form)
  }

  const handleCreateDemo = () => {
    createDemo.mutate()
  }

  if (isLoading) return <div className="flex justify-center pt-16"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budgets</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setBackupModalOpen(true)}>
            <ArchiveBoxArrowDownIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Backup & Restore</span>
          </button>
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon className="w-4 h-4" /> New Budget
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <p className="mb-3">No budgets yet. Create one to get started.</p>
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon className="w-4 h-4" /> Create Budget
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {budgets.map((b, index) => (
            <div key={b.budgetid} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/budgets/${b.budgetid}`} className="font-medium text-dosh-700 dark:text-dosh-400 hover:underline">
                    {b.description || 'Untitled'}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{b.budgetowner} · {b.budget_frequency}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => navigate(`/budgets/${b.budgetid}/setup`)}>
                    <Cog6ToothIcon className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn-danger" onClick={() => { if (globalThis.confirm(`Delete "${b.description}"?`)) remove.mutate(b.budgetid) }}>
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {periodQueries[index]?.isLoading ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {['current', 'balance', 'calendar', 'health'].map(section => (
                    <div key={`budget-${b.budgetid}-loading-${section}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="mt-2 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="mt-2 h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
              ) : (
                <LocalisationProvider budget={b}>
                  <BudgetStats
                    budgetId={b.budgetid}
                    budgetName={b.description || 'Untitled Budget'}
                    periods={periodQueries[index]?.data ?? []}
                    currentPeriodDetail={(() => {
                      const groupedPeriods = groupPeriods(periodQueries[index]?.data ?? [])
                      const currentPeriod = groupedPeriods.current[0]
                      return currentPeriod ? calendarPeriodDetailsById[currentPeriod.finperiodid] ?? null : null
                    })()}
                    calendarPeriods={getCalendarRelevantPeriods(periodQueries[index]?.data ?? [], today)}
                    calendarPeriodDetails={getCalendarRelevantPeriods(periodQueries[index]?.data ?? [], today)
                      .map(period => calendarPeriodDetailsById[period.finperiodid])
                      .filter(Boolean)}
                    currentPeriodDetailLoading={calendarBudgetLoadingByBudgetId[b.budgetid]}
                    health={healthQueries[index]?.data ?? null}
                    onOpenHealth={() => healthQueries[index]?.data && setHealthModal({ budget: b, health: healthQueries[index].data })}
                    onOpenCurrentPeriodCheck={() => healthQueries[index]?.data && setCurrentCheckModal({
                      budget: b,
                      assessment: healthQueries[index].data.current_period_check,
                      evaluatedAt: healthQueries[index].data.evaluated_at,
                    })}
                  />
                </LocalisationProvider>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="New Budget" onClose={() => setModal(null)} size="lg">
          <BudgetForm
            initial={emptyForm}
            onSubmit={handleSubmit}
            onCreateDemo={handleCreateDemo}
            onClose={() => setModal(null)}
            loading={create.isPending}
            demoLoading={createDemo.isPending}
            showDemoOption
          />
        </Modal>
      )}

      {healthModal && (
        <LocalisationProvider budget={healthModal.budget}>
          <BudgetHealthModal
            budget={healthModal.budget}
            health={healthModal.health}
            onClose={() => setHealthModal(null)}
          />
        </LocalisationProvider>
      )}

      {currentCheckModal && (
        <LocalisationProvider budget={currentCheckModal.budget}>
          <CurrentPeriodCheckModal
            budget={currentCheckModal.budget}
            assessment={currentCheckModal.assessment}
            evaluatedAt={currentCheckModal.evaluatedAt}
            onClose={() => setCurrentCheckModal(null)}
          />
        </LocalisationProvider>
      )}

      {backupModalOpen && (
        <Modal title="Backup & Restore" onClose={() => setBackupModalOpen(false)} size="lg">
          <BackupRestoreModal budgets={budgets} onClose={() => { setBackupModalOpen(false); qc.invalidateQueries({ queryKey: ['budgets'] }) }} />
        </Modal>
      )}
    </div>
  )
}

MomentumIcon.propTypes = {
  status: PropTypes.string,
}

CalendarDayEventsModal.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
}

CalendarMonthGrid.propTypes = {
  periods: PropTypes.arrayOf(PropTypes.object).isRequired,
  visibleMonth: PropTypes.instanceOf(Date).isRequired,
  onChangeMonth: PropTypes.func.isRequired,
  today: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  compact: PropTypes.bool,
  onSelectDay: PropTypes.func,
}

FullCalendarModal.propTypes = {
  budgetName: PropTypes.string.isRequired,
  periods: PropTypes.arrayOf(PropTypes.object).isRequired,
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  today: PropTypes.instanceOf(Date).isRequired,
  onClose: PropTypes.func.isRequired,
}

BalanceSummaryCard.propTypes = {
  currentPeriod: PropTypes.object,
  currentPeriodDetail: PropTypes.object,
  isLoading: PropTypes.bool.isRequired,
}

CalendarSummaryCard.propTypes = {
  currentPeriod: PropTypes.object,
  calendarPeriods: PropTypes.arrayOf(PropTypes.object).isRequired,
  calendarPeriodDetails: PropTypes.arrayOf(PropTypes.object).isRequired,
  isLoading: PropTypes.bool.isRequired,
  budgetName: PropTypes.string.isRequired,
}

PendingClosureList.propTypes = {
  periods: PropTypes.arrayOf(PropTypes.object).isRequired,
  budgetId: PropTypes.number.isRequired,
}

BudgetStats.propTypes = {
  budgetId: PropTypes.number.isRequired,
  budgetName: PropTypes.string.isRequired,
  periods: PropTypes.arrayOf(PropTypes.object),
  currentPeriodDetail: PropTypes.object,
  calendarPeriods: PropTypes.arrayOf(PropTypes.object),
  calendarPeriodDetails: PropTypes.arrayOf(PropTypes.object),
  currentPeriodDetailLoading: PropTypes.bool.isRequired,
  health: PropTypes.object,
  onOpenHealth: PropTypes.func.isRequired,
  onOpenCurrentPeriodCheck: PropTypes.func.isRequired,
}

CurrentPeriodCheckModal.propTypes = {
  budget: PropTypes.object.isRequired,
  assessment: PropTypes.object,
  evaluatedAt: PropTypes.string,
  onClose: PropTypes.func.isRequired,
}

BudgetHealthModal.propTypes = {
  budget: PropTypes.object.isRequired,
  health: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
}

BudgetForm.propTypes = {
  initial: PropTypes.shape({
    description: PropTypes.string,
    budgetowner: PropTypes.string,
    budget_frequency: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  onCreateDemo: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  demoLoading: PropTypes.bool.isRequired,
  showDemoOption: PropTypes.bool.isRequired,
}
