import React from 'react'
import { render } from '@testing-library/react'
import {
  calcNextDue,
  freqLabel,
  isScheduledExpense,
  hasLineActualActivity,
  getPositiveRemainingValue,
  getIncomeSurplusContribution,
  getOutflowSurplusContribution,
  getProgressToneClasses,
  getPeriodBudgetMutation,
  getExpenseScheduleBadge,
} from '../utils/periodCalculations'

describe('calcNextDue', () => {
  it('returns null for Always', () => {
    expect(calcNextDue('Always', null, null)).toBeNull()
  })

  it('returns null for Fixed Day of Month with invalid day', () => {
    expect(calcNextDue('Fixed Day of Month', 0, null)).toBeNull()
    expect(calcNextDue('Fixed Day of Month', null, null)).toBeNull()
  })

  it('returns null for Every N Days with missing data', () => {
    expect(calcNextDue('Every N Days', 5, null)).toBeNull()
    expect(calcNextDue('Every N Days', null, '2026-01-01')).toBeNull()
  })

  it('computes next due for Every N Days when cursor is before today', () => {
    // Use a naive local midnight string (matches real usage) to avoid timezone drift
    const today = new Date(2026, 3, 16) // April 16, local midnight
    const result = calcNextDue('Every N Days', 7, '2026-01-01', today)
    expect(result instanceof Date).toBe(true)
    // advancing from 2026-01-01 by steps of 7 days should reach a date >= today
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBeGreaterThanOrEqual(16)
  })

  it('keeps cursor as next due for Every N Days when cursor is today or after', () => {
    const today = new Date(2026, 3, 16)
    const result = calcNextDue('Every N Days', 7, '2026-04-16', today)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(3)
    expect(result.getDate()).toBe(16)
  })
})

describe('freqLabel', () => {
  it('returns labels for known frequencies', () => {
    expect(freqLabel('Always')).toBe('Always included')
    expect(freqLabel('Fixed Day of Month', 15)).toBe('Recurring: Day 15')
    expect(freqLabel('Every N Days', 14)).toBe('Recurring: Every 14d')
  })

  it('returns the raw freqtype for unknown values', () => {
    expect(freqLabel('Custom')).toBe('Custom')
  })

  it('returns null for empty input', () => {
    expect(freqLabel(null)).toBeNull()
    expect(freqLabel('')).toBeNull()
  })
})

describe('isScheduledExpense', () => {
  it('returns truthy only for non-Always freqtype with values', () => {
    expect(!!isScheduledExpense({ freqtype: 'Fixed Day of Month', frequency_value: 15, effectivedate: '2026-01-01' })).toBe(true)
    expect(isScheduledExpense({ freqtype: 'Always', frequency_value: null, effectivedate: null })).toBeFalsy()
    expect(isScheduledExpense({ freqtype: null, frequency_value: null, effectivedate: null })).toBeFalsy()
  })
})

describe('hasLineActualActivity', () => {
  it('returns true for positive actual amounts', () => {
    expect(hasLineActualActivity(10)).toBe(true)
    expect(hasLineActualActivity('5')).toBe(true)
  })

  it('returns false for zero, null, or undefined', () => {
    expect(hasLineActualActivity(0)).toBe(false)
    expect(hasLineActualActivity(null)).toBe(false)
    expect(hasLineActualActivity(undefined)).toBe(false)
  })
})

describe('getPositiveRemainingValue', () => {
  it('returns the remaining value clamped to zero', () => {
    expect(getPositiveRemainingValue(100)).toBe(100)
    expect(getPositiveRemainingValue(-50)).toBe(0)
    expect(getPositiveRemainingValue(0)).toBe(0)
  })
})

describe('getIncomeSurplusContribution', () => {
  it('uses actual when activity exists', () => {
    expect(getIncomeSurplusContribution({ budgetAmount: 1000, actualAmount: 800 })).toBe(800)
  })

  it('falls back to budget when no actual activity', () => {
    expect(getIncomeSurplusContribution({ budgetAmount: 1000, actualAmount: 0 })).toBe(1000)
  })
})

describe('getOutflowSurplusContribution', () => {
  it('sums actual and positive remaining', () => {
    expect(getOutflowSurplusContribution({ actualAmount: 200, remainingAmount: 50 })).toBe(250)
    expect(getOutflowSurplusContribution({ actualAmount: 200, remainingAmount: -10 })).toBe(200)
  })
})

describe('getProgressToneClasses', () => {
  it('returns red tones when over limit', () => {
    const classes = getProgressToneClasses({ isOver: true, isNearLimit: false, status: 'Current' })
    expect(classes.trackClass).toContain('bg-red-100')
    expect(classes.fillClass).toContain('bg-red-500')
  })

  it('returns amber tones when near limit', () => {
    const classes = getProgressToneClasses({ isOver: false, isNearLimit: true, status: 'Current' })
    expect(classes.trackClass).toContain('bg-amber-100')
    expect(classes.fillClass).toContain('bg-amber-500')
  })

  it('returns amber label for revised status when not over', () => {
    const classes = getProgressToneClasses({ isOver: false, isNearLimit: false, status: 'Revised' })
    expect(classes.labelClass).toContain('text-amber-700')
  })
})

describe('getPeriodBudgetMutation', () => {
  const mutations = {
    editIncomeBudget: 'income-mutation',
    editExpenseBudget: 'expense-mutation',
    editInvBudget: 'investment-mutation',
  }

  it('selects the correct mutation by category', () => {
    expect(getPeriodBudgetMutation('income', mutations)).toBe('income-mutation')
    expect(getPeriodBudgetMutation('expense', mutations)).toBe('expense-mutation')
    expect(getPeriodBudgetMutation('investment', mutations)).toBe('investment-mutation')
  })
})

describe('getExpenseScheduleBadge', () => {
  it('returns one-off badge', () => {
    const { container } = render(getExpenseScheduleBadge({ is_oneoff: true }))
    expect(container.textContent).toBe('One-off')
  })

  it('returns dash for missing frequency', () => {
    const { container } = render(getExpenseScheduleBadge({ freqtype: null }))
    expect(container.textContent).toBe('—')
  })

  it('returns badge with label for scheduled expense', () => {
    const { container } = render(getExpenseScheduleBadge({ freqtype: 'Fixed Day of Month', frequency_value: 15, effectivedate: '2026-01-01' }))
    expect(container.textContent).toContain('Recurring: Day 15')
  })
})
