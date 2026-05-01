import { useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'
import { useLocalisation } from '../LocalisationContext'

function formatCurrencyShort(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value}`
}

function formatPercentShort(value) {
  return `${value.toFixed(0)}%`
}

function CurrencyTooltip({ active, payload, label }) {
  const { formatCurrency } = useLocalisation()
  const theme = useChartTheme()

  if (!active || !payload?.length) return null

  const dataPoint = payload[0]?.payload || {}
  const income = dataPoint.income_actual

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
        {income !== undefined && (
          <div className="flex items-center gap-2 border-t border-gray-200 pt-1 text-xs dark:border-slate-700">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.line2 }}
            />
            <span className="flex-1 font-medium">Income:</span>
            <span className="font-medium">{formatCurrency(income)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

CurrencyTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
}

function PercentageTooltip({ active, payload, label }) {
  const { formatCurrency } = useLocalisation()
  const theme = useChartTheme()

  if (!active || !payload?.length) return null

  const dataPoint = payload[0]?.payload || {}
  const income = dataPoint.income_actual

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
        {payload.map(entry => {
          const rawKey = entry.dataKey.replace('_pct', '_actual')
          const rawValue = dataPoint[rawKey]
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1">{entry.name}:</span>
              <span className="font-medium">{entry.value.toFixed(1)}%</span>
              {rawValue !== undefined && (
                <span className="text-[10px] text-gray-400 dark:text-slate-400">({formatCurrency(rawValue)})</span>
              )}
            </div>
          )
        })}
        {income !== undefined && (
          <div className="flex items-center gap-2 border-t border-gray-200 pt-1 text-xs dark:border-slate-700">
            <span className="flex-1 font-medium">Total Income:</span>
            <span className="font-medium">{formatCurrency(income)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

PercentageTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
}

export default function IncomeAllocationChart({ data, showExpenses, showInvestments, showPercentages }) {
  const theme = useChartTheme()

  const chartData = useMemo(() => {
    if (!showPercentages) return data
    return data.map(p => {
      const income = Number(p.income_actual) || 0
      if (income === 0) {
        return { ...p, expense_pct: 0, investment_pct: 0 }
      }
      return {
        ...p,
        expense_pct: (Number(p.expense_actual) || 0) / income * 100,
        investment_pct: (Number(p.investment_actual) || 0) / income * 100,
      }
    })
  }, [data, showPercentages])

  const areas = []

  if (showExpenses) {
    areas.push(
      { key: showPercentages ? 'expense_pct' : 'expense_actual', name: 'Expenses', color: theme.line3 },
    )
  }

  if (showInvestments) {
    areas.push(
      { key: showPercentages ? 'investment_pct' : 'investment_actual', name: 'Investments', color: theme.line5 },
    )
  }

  const lines = []
  if (!showPercentages) {
    lines.push(
      { key: 'income_actual', name: 'Income', color: theme.line2, strokeDasharray: '5 5' },
    )
  }

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            tickFormatter={showPercentages ? formatPercentShort : formatCurrencyShort}
            domain={showPercentages ? [0, 100] : undefined}
            padding={showPercentages ? undefined : { top: 30, bottom: 10 }}
          />
          <Tooltip content={showPercentages ? <PercentageTooltip /> : <CurrencyTooltip />} />
          <Legend
            wrapperStyle={{ color: theme.text, fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
          {areas.map(area => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              name={area.name}
              stackId="1"
              stroke={area.color}
              fill={area.color}
              fillOpacity={0.6}
              strokeWidth={2}
            />
          ))}
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

IncomeAllocationChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  showExpenses: PropTypes.bool,
  showInvestments: PropTypes.bool,
  showPercentages: PropTypes.bool,
}

IncomeAllocationChart.defaultProps = {
  showExpenses: true,
  showInvestments: true,
  showPercentages: false,
}
