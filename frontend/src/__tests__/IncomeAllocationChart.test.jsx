import React from 'react'
import { screen, render } from '@testing-library/react'

import IncomeAllocationChart from '../components/reports/IncomeAllocationChart'
import { LocalisationProvider } from '../components/LocalisationContext'

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children, data }) => (
    <div data-testid="area-chart" data-data-count={data?.length || 0}>{children}</div>
  ),
  Area: ({ dataKey, name }) => <span data-testid={`area-${dataKey}`}>{name}</span>,
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
    income_actual: 3100,
    expense_actual: 1400,
    investment_actual: 450,
  },
  {
    label: 'Feb 2026',
    income_actual: 3000,
    expense_actual: 1550,
    investment_actual: 500,
  },
]

describe('IncomeAllocationChart', () => {
  function renderChart(props = {}) {
    return render(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'short' }}>
        <IncomeAllocationChart data={mockData} {...props} />
      </LocalisationProvider>
    )
  }

  it('renders chart container with data', () => {
    renderChart()
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('area-chart').getAttribute('data-data-count')).toBe('2')
  })

  it('renders expense and investment areas and income line by default', () => {
    renderChart()
    expect(screen.getByTestId('area-expense_actual').textContent).toBe('Expenses')
    expect(screen.getByTestId('area-investment_actual').textContent).toBe('Investments')
    expect(screen.getByTestId('line-income_actual').textContent).toBe('Income')
  })

  it('renders percentage keys when showPercentages is true', () => {
    renderChart({ showPercentages: true })
    expect(screen.getByTestId('area-expense_pct').textContent).toBe('Expenses')
    expect(screen.getByTestId('area-investment_pct').textContent).toBe('Investments')
    expect(screen.queryByTestId('line-income_actual')).toBeNull()
    expect(screen.queryByTestId('area-expense_actual')).toBeNull()
  })

  it('hides expense area when showExpenses is false', () => {
    renderChart({ showExpenses: false })
    expect(screen.queryByTestId('area-expense_actual')).toBeNull()
    expect(screen.getByTestId('area-investment_actual')).toBeTruthy()
  })

  it('hides investment area when showInvestments is false', () => {
    renderChart({ showInvestments: false })
    expect(screen.queryByTestId('area-investment_actual')).toBeNull()
    expect(screen.getByTestId('area-expense_actual')).toBeTruthy()
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
