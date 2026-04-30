import PropTypes from 'prop-types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'
import { useLocalisation } from '../LocalisationContext'

function formatCurrencyShort(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value}`
}

function CustomTooltip({ active, payload, label }) {
  const { formatCurrency } = useLocalisation()
  const theme = useChartTheme()

  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        background: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      <p className="mb-1 text-xs font-semibold">{label}</p>
      <div className="space-y-0.5">
        {payload.map(entry => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1">{entry.name}:</span>
            <span className="font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
}

export default function BudgetVsActualChart({ data, showSurplus }) {
  const theme = useChartTheme()

  const lines = [
    { key: 'income_budget', name: 'Income Budget', color: theme.line1, strokeDasharray: '4 4' },
    { key: 'income_actual', name: 'Income Actual', color: theme.line2 },
    { key: 'expense_budget', name: 'Expense Budget', color: theme.line3, strokeDasharray: '4 4' },
    { key: 'expense_actual', name: 'Expense Actual', color: theme.line4 },
    { key: 'investment_budget', name: 'Investment Budget', color: theme.line5, strokeDasharray: '4 4' },
    { key: 'investment_actual', name: 'Investment Actual', color: theme.line6 },
  ]

  if (showSurplus) {
    lines.push(
      { key: 'surplus_budget', name: 'Surplus Budget', color: theme.line7, strokeDasharray: '4 4' },
      { key: 'surplus_actual', name: 'Surplus Actual', color: theme.line8 },
    )
  }

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.text, fontSize: 12 }}
            axisLine={{ stroke: theme.grid }}
            tickLine={{ stroke: theme.grid }}
          />
          <YAxis
            tick={{ fill: theme.text, fontSize: 12 }}
            axisLine={{ stroke: theme.grid }}
            tickLine={{ stroke: theme.grid }}
            tickFormatter={formatCurrencyShort}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: theme.text, fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
          {lines.map(line => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.strokeDasharray}
              dot={{ r: 3, fill: line.color }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

BudgetVsActualChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  showSurplus: PropTypes.bool,
}

BudgetVsActualChart.defaultProps = {
  showSurplus: true,
}
