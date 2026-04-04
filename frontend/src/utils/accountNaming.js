export const ACCOUNT_NAMING_OPTIONS = ['Transaction', 'Everyday', 'Checking']

export function getPreferredTransactionLabel(preference) {
  return ACCOUNT_NAMING_OPTIONS.includes(preference) ? preference : 'Transaction'
}

export function getBalanceTypeLabel(balanceType, preference) {
  if (balanceType === 'Transaction' || balanceType === 'Bank') {
    return getPreferredTransactionLabel(preference)
  }

  return balanceType
}

export function getPrimaryAccountLabel(preference) {
  return `primary ${getPreferredTransactionLabel(preference).toLowerCase()} account`
}
