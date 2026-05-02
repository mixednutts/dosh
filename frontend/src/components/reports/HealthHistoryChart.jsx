import PropTypes from 'prop-types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useChartTheme } from '../../hooks/useChartTheme'

const METRIC_COLOR_ORDER = [
  'line1', 'line2', 'line3', 'line4', 'line5', 'line6', 'line7', 'line8',
]

function CustomTooltip({ active, payload, label, metricNames }) {
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
            <span className="flex-1">{metricNames[entry.dataKey] || entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
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
  metricNames: PropTypes.objectOf(PropTypes.string),
}

export default function HealthHistoryChart({ data, metrics, visibleMetrics }) {
  const theme = useChartTheme()

  const metricNames = {}
  const lines = []
  metrics.forEach((metric, index) => {
    const colorKey = METRIC_COLOR_ORDER[index % METRIC_COLOR_ORDER.length]
    metricNames[metric.key] = metric.name
    if (visibleMetrics.has(metric.key)) {
      lines.push({
        key: metric.key,
        name: metric.name,
        color: theme[colorKey],
      })
    }
  })

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
            domain={[0, 100]}
            padding={{ top: 10, bottom: 10 }}
          />
          <Tooltip content={<CustomTooltip metricNames={metricNames} />} />
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
              dot={{ r: 3, fill: line.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

HealthHistoryChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  visibleMetrics: PropTypes.instanceOf(Set).isRequired,
}
