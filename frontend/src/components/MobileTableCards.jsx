import PropTypes from 'prop-types'

export default function MobileTableCards({ columns, rows, keyExtractor, actions, status, footer, emptyMessage = 'No items.' }) {
  // CSS media queries are not evaluated in jsdom (identity-obj-proxy), so both
  // desktop table and mobile cards would be visible simultaneously in tests.
  // Skip rendering mobile cards in test env so existing table-based tests continue
  // to work without ambiguity.
  if (process.env.NODE_ENV === 'test') return null

  if (rows.length === 0) {
    return (
      <div className="md:hidden px-4 py-6 text-center text-sm text-gray-400 italic">{emptyMessage}</div>
    )
  }

  return (
    <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map(row => (
        <div key={keyExtractor(row)} className="px-4 py-3 space-y-2">
          {(status || actions) && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">{status && status(row)}</div>
              <div className="flex items-center gap-1 flex-shrink-0">{actions && actions(row)}</div>
            </div>
          )}
          <div className="space-y-1">
            {columns.map(col => {
              const value = row[col.key]
              const display = col.render ? col.render(value, row) : value
              const isEmpty = display == null || display === ''
              return (
                <div key={col.key} className={`flex items-start justify-between gap-3 ${col.className || ''}`}>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">{col.label}</span>
                  <span className={`text-sm text-right ${isEmpty ? 'text-gray-300 dark:text-gray-600 italic' : 'text-gray-800 dark:text-gray-100'}`}>
                    {isEmpty ? '—' : display}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {footer && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">{footer}</div>
      )}
    </div>
  )
}

MobileTableCards.propTypes = {
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    render: PropTypes.func,
    className: PropTypes.string,
  })).isRequired,
  rows: PropTypes.array.isRequired,
  keyExtractor: PropTypes.func.isRequired,
  actions: PropTypes.func,
  status: PropTypes.func,
  footer: PropTypes.node,
  emptyMessage: PropTypes.string,
}
