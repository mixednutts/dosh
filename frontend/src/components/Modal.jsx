import { XMarkIcon } from '@heroicons/react/24/outline'
import PropTypes from 'prop-types'

export default function Modal({ title, onClose, children, size = 'md' }) {
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className={`bg-white dark:bg-gray-900 shadow-xl w-full sm:w-auto sm:rounded-lg sm:mx-4 ${widths[size]} flex flex-col max-h-[85vh] sm:max-h-[90vh] border-0 sm:border border-gray-200 dark:border-gray-700 rounded-t-xl`}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-base sm:text-lg">{title}</h2>
          <button onClick={onClose} className="flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1 text-gray-900 dark:text-gray-100">{children}</div>
      </div>
    </div>
  )
}

Modal.propTypes = {
  title: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
}
