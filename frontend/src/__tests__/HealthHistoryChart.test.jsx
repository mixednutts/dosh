import React from 'react'
import { screen, render } from '@testing-library/react'

import HealthHistoryChart from '../components/reports/HealthHistoryChart'
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
  YAxis: ({ domain }) => <div data-testid="y-axis" data-domain={JSON.stringify(domain)} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }) => <div data-testid="tooltip">{content}</div>,
  Legend: () => <div data-testid="legend" />,
}))

const mockMetrics = [
  { key: 'setup_health', name: 'Setup Health' },
  { key: 'budget_vs_actual_amount', name: 'Budget vs Actual (Amount)' },
]

const mockData = [
  {
    label: 'Jan 2026',
    setup_health: 85,
    budget_vs_actual_amount: 70,
  },
  {
    label: 'Feb 2026',
    setup_health: 90,
    budget_vs_actual_amount: 75,
  },
]

describe('HealthHistoryChart', () => {
  function renderChart(props = {}) {
    return render(
      <LocalisationProvider budget={{ locale: 'en-AU', currency: 'AUD', timezone: 'Australia/Sydney', date_format: 'short' }}>
        <HealthHistoryChart
          data={mockData}
          metrics={mockMetrics}
          visibleMetrics={new Set(['setup_health', 'budget_vs_actual_amount'])}
          {...props}
        />
      </LocalisationProvider>
    )
  }

  it('renders chart container with data', () => {
    renderChart()
    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(screen.getByTestId('line-chart').getAttribute('data-data-count')).toBe('2')
  })

  it('renders visible metric lines', () => {
    renderChart()
    expect(screen.getByTestId('line-setup_health').textContent).toBe('Setup Health')
    expect(screen.getByTestId('line-budget_vs_actual_amount').textContent).toBe('Budget vs Actual (Amount)')
  })

  it('hides lines for metrics not in visibleMetrics', () => {
    renderChart({ visibleMetrics: new Set(['setup_health']) })
    expect(screen.getByTestId('line-setup_health')).toBeTruthy()
    expect(screen.queryByTestId('line-budget_vs_actual_amount')).toBeNull()
  })

  it('sets YAxis domain to 0-100', () => {
    renderChart()
    const domainAttr = screen.getByTestId('y-axis').getAttribute('data-domain')
    expect(JSON.parse(domainAttr)).toEqual([0, 100])
  })

  it('renders tooltip component inside chart', () => {
    renderChart()
    expect(screen.getByTestId('tooltip')).toBeTruthy()
  })
})
