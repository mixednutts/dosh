import PropTypes from 'prop-types'
import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

const TONE_STYLES = {
  info: {
    container:
      'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50',
    icon: 'text-slate-400 dark:text-slate-400',
    title: 'text-slate-900 dark:text-slate-100',
    description: 'text-slate-700 dark:text-slate-300',
    Icon: InformationCircleIcon,
  },
  success: {
    container:
      'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
    icon: 'text-green-500 dark:text-green-400',
    title: 'text-green-900 dark:text-green-100',
    description: 'text-green-800 dark:text-green-300',
    Icon: CheckCircleIcon,
  },
  warning: {
    container:
      'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
    icon: 'text-amber-500 dark:text-amber-400',
    title: 'text-amber-900 dark:text-amber-100',
    description: 'text-amber-800 dark:text-amber-300',
    Icon: ExclamationTriangleIcon,
  },
  error: {
    container:
      'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    description: 'text-red-700 dark:text-red-300',
    Icon: XCircleIcon,
  },
}

export default function AlertBanner({
  tone = 'info',
  title,
  description,
  children,
  className = '',
  icon: CustomIcon,
  'data-testid': dataTestId,
}) {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.info
  const Icon = CustomIcon || styles.Icon

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${styles.container} ${className}`}
      data-testid={dataTestId}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={`text-xs font-semibold uppercase tracking-wide ${styles.title}`}>
              {title}
            </p>
          ) : null}
          {description ? (
            <p
              className={`text-sm font-medium ${title ? 'mt-1' : ''} ${styles.description}`}
            >
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}

AlertBanner.propTypes = {
  tone: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  title: PropTypes.node,
  description: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  icon: PropTypes.elementType,
  'data-testid': PropTypes.string,
}
