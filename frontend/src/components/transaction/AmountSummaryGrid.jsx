import PropTypes from 'prop-types'

export function AmountSummaryGrid({ items, columns = 3, formatters }) {
  return (
    <div className={`grid gap-2 text-center text-xs ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {items.map(({ label, value, cls }) => (
        <div key={label} className="card p-2">
          <p className="text-gray-400">{label}</p>
          <p className={`font-semibold ${cls}`}>{formatters.fmt(value)}</p>
        </div>
      ))}
    </div>
  )
}

AmountSummaryGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    cls: PropTypes.string.isRequired,
  })).isRequired,
  columns: PropTypes.number,
  formatters: PropTypes.object.isRequired,
}
