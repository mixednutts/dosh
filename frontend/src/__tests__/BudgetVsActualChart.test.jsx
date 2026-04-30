import React from 'react'
import { screen, render } from '@testing-library/react'

import BudgetVsActualChart from '../components/reports/BudgetVsActualChart'
import { LocalisationProvider } from '../components/LocalisationContext'

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }) => (
    <div data-testid="line-chart" data-data-count={data?.length || 0}>{children}</div>
  ),
  Line: ({ dataKey, name, strokeDasharray }) => (
    <span data-testid={`line-${dataKey}`} data-dash={strokeDasharray || ''}>{name}</span>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ tickFormatter }) => <div data-testid="y-axis" data-has-formatter={!!tickFormatter} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }) => <div data-testid="tooltip">{content}</div>,
  Legend: () => <div data-testid="legend" />,
}))

const mockData = [
  {
    label: 'Jan 2026',
    income_budget: 3000,
    income_actual: 3100,
    expense_budget: 1500,
    expense_actual: 1400,
    investment_budget: 500,
    investment_actual: 450,
    surplus_budget: 1000,
    surplus_actual: 1250,
  },
  {
    label: 'Feb 2026',
    income_budget: 3000,
    income_actual: 3000,
    expense_budget: 1500,
    expense_actual: 1550,
    investment_budget: 500,
    investment_actual: 500,
    surplus_budget: 1000,
    surplus_actual: 950,
  },
]

describe('BudgetVsActualChart', () => {
  function renderChart(props = {}) {
    return render(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'short' }}>
        <BudgetVsActualChart data={mockData} {...props} />
      </LocalisationProvider>
    )
  }

  it('renders chart container with data', () => {
    renderChart()
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('line-chart').getAttribute('data-data-count')).toBe('2')
  })

  it('renders all six base lines by default', () => {
    renderChart()
    expect(screen.getByTestId('line-income_budget').textContent).toBe('Income Budget')
    expect(screen.getByTestId('line-income_actual').textContent).toBe('Income Actual')
    expect(screen.getByTestId('line-expense_budget').textContent).toBe('Expense Budget')
    expect(screen.getByTestId('line-expense_actual').textContent).toBe('Expense Actual')
    expect(screen.getByTestId('line-investment_budget').textContent).toBe('Investment Budget')
    expect(screen.getByTestId('line-investment_actual').textContent).toBe('Investment Actual')
  })

  it('renders dashed lines for budget values and solid for actual values', () => {
    renderChart()
    expect(screen.getByTestId('line-income_budget').getAttribute('data-dash')).toBe('4 4')
    expect(screen.getByTestId('line-income_actual').getAttribute('data-dash')).toBe('')
    expect(screen.getByTestId('line-expense_budget').getAttribute('data-dash')).toBe('4 4')
    expect(screen.getByTestId('line-expense_actual').getAttribute('data-dash')).toBe('')
  })

  it('includes surplus lines when showSurplus is true', () => {
    renderChart({ showSurplus: true })
    expect(screen.getByTestId('line-surplus_budget').textContent).toBe('Surplus Budget')
    expect(screen.getByTestId('line-surplus_actual').textContent).toBe('Surplus Actual')
  })

  it('excludes surplus lines when showSurplus is false', () => {
    renderChart({ showSurplus: false })
    expect(screen.queryByTestId('line-surplus_budget')).toBeNull()
    expect(screen.queryByTestId('line-surplus_actual')).toBeNull()
  })

  it('renders YAxis with currency formatter', () => {
    renderChart()
    expect(screen.getByTestId('y-axis').getAttribute('data-has-formatter')).toBe('true')
  })

  describe('CustomTooltip', () => {
    it('renders tooltip component inside chart', () => {
      renderChart()
      const tooltipWrapper = screen.getByTestId('tooltip')
      expect(tooltipWrapper).toBeTruthy()
    })
  })
})
