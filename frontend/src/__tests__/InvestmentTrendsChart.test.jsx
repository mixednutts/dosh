import React from 'react'
import { screen, render } from '@testing-library/react'

import InvestmentTrendsChart from '../components/reports/InvestmentTrendsChart'
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
    cumulative_contributed: 450,
    cumulative_projected: 500,
  },
  {
    label: 'Feb 2026',
    cumulative_contributed: 950,
    cumulative_projected: 1000,
  },
]

describe('InvestmentTrendsChart', () => {
  function renderChart(props = {}) {
    return render(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'short' }}>
        <InvestmentTrendsChart data={mockData} {...props} />
      </LocalisationProvider>
    )
  }

  it('renders chart container with data', () => {
    renderChart()
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('line-chart').getAttribute('data-data-count')).toBe('2')
  })

  it('renders actual growth and projected growth lines', () => {
    renderChart()
    expect(screen.getByTestId('line-cumulative_contributed').textContent).toBe('Actual Growth')
    expect(screen.getByTestId('line-cumulative_projected').textContent).toBe('Projected Growth')
  })

  it('renders dashed line for projected growth', () => {
    renderChart()
    expect(screen.getByTestId('line-cumulative_projected').getAttribute('data-dash')).toBe('4 4')
    expect(screen.getByTestId('line-cumulative_contributed').getAttribute('data-dash')).toBe('')
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
