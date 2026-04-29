import { balanceTransactionDelta, balanceTransactionLabel } from '../utils/transactionHelpers'

describe('balanceTransactionDelta', () => {
  it('returns positive amount for income credited to the account', () => {
    const tx = { source: 'income', type: 'CREDIT', amount: '100.00', affected_account_desc: 'Main' }
    expect(balanceTransactionDelta(tx, 'Main')).toBe(100)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })

  it('returns negative amount for expense debited from the account', () => {
    const tx = { source: 'expense', type: 'DEBIT', amount: '50.00', affected_account_desc: 'Main' }
    expect(balanceTransactionDelta(tx, 'Main')).toBe(-50)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })

  it('returns positive for transfer into the account and negative for transfer out', () => {
    const tx = { source: 'transfer', type: 'TRANSFER', amount: '75.00', affected_account_desc: 'Main', related_account_desc: 'Savings' }
    expect(balanceTransactionDelta(tx, 'Main')).toBe(75)
    expect(balanceTransactionDelta(tx, 'Savings')).toBe(-75)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })

  it('returns correct delta for investment with a linked account (affected)', () => {
    const tx = { source: 'investment', type: 'CREDIT', amount: '500.00', affected_account_desc: 'Brokerage', related_account_desc: 'Main' }
    expect(balanceTransactionDelta(tx, 'Brokerage')).toBe(500)
    expect(balanceTransactionDelta(tx, 'Main')).toBe(-500)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })

  it('returns negative delta for cash-only investment where cash is the related account', () => {
    const tx = { source: 'investment', type: 'CREDIT', amount: '500.00', affected_account_desc: '', related_account_desc: 'cas1' }
    expect(balanceTransactionDelta(tx, 'cas1')).toBe(-500)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })

  it('returns zero when investment has no account links at all', () => {
    const tx = { source: 'investment', type: 'CREDIT', amount: '200.00', affected_account_desc: '', related_account_desc: '' }
    expect(balanceTransactionDelta(tx, 'Any')).toBe(0)
  })

  it('returns positive for balance adjustment on the account', () => {
    const tx = { source: 'balance', type: 'SYSTEM', amount: '10.00', affected_account_desc: 'Main' }
    expect(balanceTransactionDelta(tx, 'Main')).toBe(10)
    expect(balanceTransactionDelta(tx, 'Other')).toBe(0)
  })
})

describe('balanceTransactionLabel', () => {
  it('labels investment transactions', () => {
    const tx = { source: 'investment', source_key: 'inv1', source_label: 'inv1' }
    expect(balanceTransactionLabel(tx, 'cas1')).toBe('Investment: inv1')
  })

  it('labels transfer into account', () => {
    const tx = { source: 'transfer', affected_account_desc: 'Main', related_account_desc: 'Savings' }
    expect(balanceTransactionLabel(tx, 'Main')).toBe('Transfer from Savings')
  })

  it('labels transfer out of account', () => {
    const tx = { source: 'transfer', affected_account_desc: 'Savings', related_account_desc: 'Main' }
    expect(balanceTransactionLabel(tx, 'Main')).toBe('Transfer to Savings')
  })
})
