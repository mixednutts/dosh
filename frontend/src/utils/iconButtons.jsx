import { TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

export const SECONDARY_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
export const DELETE_BUTTON_CLASSES = 'flex items-center justify-center w-7 h-7 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
export const DISABLED_ICON_BUTTON_CLASSES = 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400'

export const ICON_BUTTON_TONES = {
  success: 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/40 dark:text-success-400 dark:hover:bg-success-900/60',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60',
  dosh: 'bg-dosh-100 text-dosh-700 hover:bg-dosh-200 dark:bg-dosh-900/40 dark:text-dosh-400 dark:hover:bg-dosh-900/60',
}

export function iconButtonClassName(disabled, tone) {
  const toneClasses = ICON_BUTTON_TONES[tone] ?? SECONDARY_BUTTON_CLASSES
  return `flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm transition-colors ${
    disabled ? DISABLED_ICON_BUTTON_CLASSES : toneClasses
  }`
}

export function ActionIconButton({ disabled = false, title, onClick, tone = 'neutral', icon: Icon }) {
  const className = tone === 'neutral'
    ? SECONDARY_BUTTON_CLASSES
    : iconButtonClassName(disabled, tone)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={className}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

export function EmptyActionSlot() {
  return <span className="block w-7 h-7" />
}

export function DeleteActionButton({ onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={DELETE_BUTTON_CLASSES}
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  )
}

export function BudgetAmountCell({ amount, canEdit, onEdit, label, formatters }) {
  return (
    <div className="flex w-full items-center justify-end gap-1.5">
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          title={`Edit ${label} budget`}
          aria-label={`Edit budget for ${label}`}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-dosh-700 transition-colors hover:bg-dosh-50 dark:text-dosh-400 dark:hover:bg-dosh-900/20"
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
      )}
      <span>{formatters.fmt(amount)}</span>
    </div>
  )
}
