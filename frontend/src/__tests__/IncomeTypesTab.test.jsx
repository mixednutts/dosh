import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import IncomeTypesTab from '../pages/tabs/IncomeTypesTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getIncomeTypes: jest.fn(),
  createIncomeType: jest.fn(),
  updateIncomeType: jest.fn(),
  deleteIncomeType: jest.fn(),
  getIncomeTypeHistory: jest.fn(),
  getBalanceTypes: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
}))

jest.mock('../components/Modal', () => ({ title, children }) => (
  <div>
    <h2>{title}</h2>
    <div>{children}</div>
  </div>
))

const client = require('../api/client')

describe('IncomeTypesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [],
      investment_items: [],
    })
    client.getIncomeTypeHistory.mockResolvedValue({ item_desc: 'Salary', category: 'income', current_revisionnum: 0, entries: [] })
  })

  it('auto-sets auto-include when a fixed income type is created', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Type'))
    expect(await screen.findByRole('heading', { name: 'Add Income Type' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Salary' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2500' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Everyday' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])

    expect(toggles[1].checked).toBe(true)
    expect(screen.getByText('(auto-set when fixed)')).toBeTruthy()

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      })
    })
  })

  it('still allows an income type to be created when no linked account exists', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([])
    client.createIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Income Type'))

    fireEvent.change(screen.getByPlaceholderText('e.g. Salary'), {
      target: { value: 'Casual Work' },
    })
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '300' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createIncomeType).toHaveBeenCalledWith(1, {
        incomedesc: 'Casual Work',
        issavings: false,
        isfixed: false,
        autoinclude: false,
        amount: 300,
        linked_account: null,
      })
    })
  })

  it('updates an existing income type and can remove its linked account', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      },
    ])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.updateIncomeType.mockResolvedValue({})

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))
    expect(await screen.findByRole('heading', { name: 'Edit Income Type' })).toBeTruthy()

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2600' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateIncomeType).toHaveBeenCalledWith(1, 'Salary', {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2600,
        linked_account: null,
      })
    })
  })

  it('disables delete for an income type already in use', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
      },
    ])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [
        {
          incomedesc: 'Salary',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_edit_structure: false,
        },
      ],
      expense_items: [],
      investment_items: [],
    })

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    expect(screen.getByText('In Use')).toBeTruthy()
    const deleteButton = screen.getAllByRole('button').find(button => button.className.includes('btn-danger'))
    expect(deleteButton.disabled).toBe(true)
  })

  it('shows the preferred transaction naming in linked account options', async () => {
    client.getIncomeTypes.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Everyday', balance_type: 'Transaction' }])

    renderWithProviders(
      <IncomeTypesTab
        budgetId={1}
        budget={{ account_naming_preference: 'Checking' }}
      />
    )

    fireEvent.click(await screen.findByText('Add Income Type'))
    expect(await screen.findByRole('option', { name: 'Everyday (Checking)' })).toBeTruthy()
  })

  it('shows history details for an income type using budget adjustment entries', async () => {
    client.getIncomeTypes.mockResolvedValue([
      {
        incomedesc: 'Salary',
        issavings: false,
        isfixed: true,
        autoinclude: true,
        amount: 2500,
        linked_account: 'Everyday',
        revisionnum: 2,
      },
    ])
    client.getIncomeTypeHistory.mockResolvedValue({
      item_desc: 'Salary',
      category: 'income',
      current_revisionnum: 2,
      entries: [
        {
          id: 9,
          finperiodid: 3,
          period_startdate: '2026-04-28T00:00:00',
          period_enddate: '2026-05-11T00:00:00',
          source: 'income',
          type: 'BUDGETADJ',
          amount: '100.00',
          note: 'Pay rise landed.',
          entrydate: '2026-04-10T09:00:00',
          entry_kind: 'budget_adjustment',
          budget_scope: 'future',
          budget_before_amount: '2500.00',
          budget_after_amount: '2600.00',
        },
      ],
    })

    renderWithProviders(<IncomeTypesTab budgetId={1} />)

    expect(await screen.findByText('Salary')).toBeTruthy()
    fireEvent.click(screen.getByTitle('View history details'))

    expect(await screen.findByText('History Details — Salary')).toBeTruthy()
    expect(await screen.findByText('Pay rise landed.')).toBeTruthy()
    expect(client.getIncomeTypeHistory).toHaveBeenCalledWith(1, 'Salary')
  })
})
