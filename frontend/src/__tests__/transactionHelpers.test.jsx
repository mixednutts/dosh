import { balanceTransactionDelta } from '../utils/transactionHelpers'

describe('balanceTransactionDelta', () => {
  it('returns positive amount for investment credit account', () => {
    const tx = {
      source: 'investment',
      amount: '100.00',
      affected_account_desc: 'Savings',
      related_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Savings')).toBe(100)
  })

  it('returns negative amount for investment debit account', () => {
    const tx = {
      source: 'investment',
      amount: '100.00',
      affected_account_desc: 'Savings',
      related_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Checking')).toBe(-100)
  })

  it('returns zero for investment unrelated account', () => {
    const tx = {
      source: 'investment',
      amount: '100.00',
      affected_account_desc: 'Savings',
      related_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Unrelated')).toBe(0)
  })

  it('returns zero when investment debit and credit are the same account', () => {
    const tx = {
      source: 'investment',
      amount: '100.00',
      affected_account_desc: 'Savings',
      related_account_desc: 'Savings',
    }
    expect(balanceTransactionDelta(tx, 'Savings')).toBe(0)
  })

  it('returns negative amount for expense affected account', () => {
    const tx = {
      source: 'expense',
      amount: '50.00',
      affected_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Checking')).toBe(-50)
  })

  it('returns positive amount for income affected account', () => {
    const tx = {
      source: 'income',
      amount: '200.00',
      affected_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Checking')).toBe(200)
  })

  it('returns positive for transfer credit and negative for transfer debit', () => {
    const tx = {
      source: 'transfer',
      amount: '75.00',
      affected_account_desc: 'Savings',
      related_account_desc: 'Checking',
    }
    expect(balanceTransactionDelta(tx, 'Savings')).toBe(75)
    expect(balanceTransactionDelta(tx, 'Checking')).toBe(-75)
  })
})
