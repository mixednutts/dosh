import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import InvestmentItemsTab from '../pages/tabs/InvestmentItemsTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  getInvestmentItems: jest.fn(),
  createInvestmentItem: jest.fn(),
  updateInvestmentItem: jest.fn(),
  deleteInvestmentItem: jest.fn(),
  getInvestmentItemHistory: jest.fn(),
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

describe('InvestmentItemsTab', () => {
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
    client.getInvestmentItemHistory.mockResolvedValue({ item_desc: 'Emergency Fund', category: 'investment', current_revisionnum: 0, entries: [] })
  })

  it('creates a primary investment line with a linked account', async () => {
    client.getInvestmentItems.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Savings', balance_type: 'Savings' }])
    client.createInvestmentItem.mockResolvedValue({})

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Investment'))
    expect(await screen.findByRole('heading', { name: 'Add Investment' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. ETF Portfolio'), {
      target: { value: 'ETF Portfolio' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], {
      target: { value: '500' },
    })
    fireEvent.change(document.querySelector('input[type="date"]'), {
      target: { value: '2026-08-01' },
    })

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], {
      target: { value: 'Savings' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[1])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createInvestmentItem).toHaveBeenCalledWith(1, {
        investmentdesc: 'ETF Portfolio',
        active: true,
        effectivedate: '2026-08-01',
        initial_value: 500,
        planned_amount: 0,
        linked_account_desc: 'Savings',
        is_primary: true,
      })
    })
  })

  it('allows an investment line to be created without a linked account', async () => {
    client.getInvestmentItems.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([])
    client.createInvestmentItem.mockResolvedValue({})

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    fireEvent.click(await screen.findByText('Add Investment'))

    fireEvent.change(screen.getByPlaceholderText('e.g. ETF Portfolio'), {
      target: { value: 'Rainy Day Fund' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.createInvestmentItem).toHaveBeenCalledWith(1, {
        investmentdesc: 'Rainy Day Fund',
        active: true,
        effectivedate: null,
        initial_value: 0,
        planned_amount: 0,
        linked_account_desc: null,
        is_primary: false,
      })
    })
  })

  it('updates an existing investment while preserving its identity', async () => {
    client.getInvestmentItems.mockResolvedValue([
      {
        investmentdesc: 'Brokerage',
        active: true,
        effectivedate: '2026-08-01T00:00:00',
        initial_value: '1200.00',
        linked_account_desc: 'Investments',
        is_primary: false,
      },
    ])
    client.getBalanceTypes.mockResolvedValue([
      { balancedesc: 'Investments', balance_type: 'Savings' },
      { balancedesc: 'Broker Cash', balance_type: 'Transaction' },
    ])
    client.updateInvestmentItem.mockResolvedValue({})

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    expect(await screen.findByText('Brokerage')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))
    expect(await screen.findByRole('heading', { name: 'Edit Investment' })).toBeTruthy()

    const descriptionInput = screen.getByPlaceholderText('e.g. ETF Portfolio')
    expect(descriptionInput.disabled).toBe(true)

    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], {
      target: { value: '1500' },
    })
    fireEvent.change(screen.getByDisplayValue('2026-08-01'), {
      target: { value: '2026-08-15' },
    })

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], {
      target: { value: 'Broker Cash' },
    })

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[1])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateInvestmentItem).toHaveBeenCalledWith(1, 'Brokerage', {
        investmentdesc: 'Brokerage',
        active: true,
        effectivedate: '2026-08-15',
        initial_value: 1500,
        planned_amount: 0,
        linked_account_desc: 'Broker Cash',
        is_primary: true,
      })
    })
  })

  it('allows an existing investment line to be deactivated', async () => {
    client.getInvestmentItems.mockResolvedValue([
      {
        investmentdesc: 'Holiday Fund',
        active: true,
        effectivedate: null,
        initial_value: '0.00',
        linked_account_desc: null,
        is_primary: true,
      },
    ])
    client.getBalanceTypes.mockResolvedValue([])
    client.updateInvestmentItem.mockResolvedValue({})

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    expect(await screen.findByText('Holiday Fund')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-secondary') && !button.title))

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(client.updateInvestmentItem).toHaveBeenCalledWith(1, 'Holiday Fund', {
        investmentdesc: 'Holiday Fund',
        active: false,
        effectivedate: null,
        initial_value: 0,
        planned_amount: 0,
        linked_account_desc: null,
        is_primary: true,
      })
    })
  })

  it('deletes an investment line only after confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    client.getInvestmentItems.mockResolvedValue([
      {
        investmentdesc: 'Legacy Fund',
        active: false,
        effectivedate: null,
        initial_value: '0.00',
        linked_account_desc: null,
        is_primary: false,
      },
    ])
    client.getBalanceTypes.mockResolvedValue([])
    client.deleteInvestmentItem.mockResolvedValue({})

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    expect(await screen.findByText('Legacy Fund')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button').find(button => button.className.includes('btn-danger')))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete "Legacy Fund"?')
      expect(client.deleteInvestmentItem).toHaveBeenCalledWith(1, 'Legacy Fund')
    })

    confirmSpy.mockRestore()
  })

  it('disables delete for an investment line already in use', async () => {
    client.getInvestmentItems.mockResolvedValue([
      {
        investmentdesc: 'Emergency Fund',
        active: true,
        effectivedate: null,
        initial_value: '100.00',
        linked_account_desc: null,
        is_primary: false,
      },
    ])
    client.getBalanceTypes.mockResolvedValue([])
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
      income_types: [],
      expense_items: [],
      investment_items: [
        {
          investmentdesc: 'Emergency Fund',
          in_use: true,
          reasons: ['Included in generated budget cycles'],
          can_delete: false,
          can_deactivate: false,
          can_edit_structure: false,
        },
      ],
    })

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    expect(await screen.findByText('Emergency Fund')).toBeTruthy()
    expect(screen.getByText('In Use')).toBeTruthy()
    const deleteButton = screen.getAllByRole('button').find(button => button.className.includes('btn-danger'))
    expect(deleteButton.disabled).toBe(true)
  })

  it('shows the preferred transaction naming in linked account options', async () => {
    client.getInvestmentItems.mockResolvedValue([])
    client.getBalanceTypes.mockResolvedValue([{ balancedesc: 'Daily Spending', balance_type: 'Transaction' }])

    renderWithProviders(
      <InvestmentItemsTab
        budgetId={1}
        budget={{ account_naming_preference: 'Everyday' }}
      />
    )

    fireEvent.click(await screen.findByText('Add Investment'))
    expect(await screen.findByRole('option', { name: 'Daily Spending (Everyday)' })).toBeTruthy()
  })

  it('shows history details for an investment line', async () => {
    client.getInvestmentItems.mockResolvedValue([
      {
        investmentdesc: 'Emergency Fund',
        active: true,
        effectivedate: null,
        initial_value: '100.00',
        planned_amount: '75.00',
        linked_account_desc: 'Savings',
        is_primary: false,
        revisionnum: 3,
      },
    ])
    client.getBalanceTypes.mockResolvedValue([])
    client.getInvestmentItemHistory.mockResolvedValue({
      item_desc: 'Emergency Fund',
      category: 'investment',
      current_revisionnum: 3,
      entries: [
        {
          id: 14,
          finperiodid: 2,
          period_startdate: '2026-04-14T00:00:00',
          period_enddate: '2026-04-27T00:00:00',
          source: 'investment',
          type: 'BUDGETADJ',
          amount: '25.00',
          note: 'Lifted recurring contribution.',
          entrydate: '2026-04-09T08:30:00',
          entry_kind: 'budget_adjustment',
          budget_scope: 'future',
          budget_before_amount: '75.00',
          budget_after_amount: '100.00',
        },
      ],
    })

    renderWithProviders(<InvestmentItemsTab budgetId={1} />)

    expect(await screen.findByText('Emergency Fund')).toBeTruthy()
    fireEvent.click(screen.getByTitle('View history details'))

    expect(await screen.findByText('History Details — Emergency Fund')).toBeTruthy()
    expect(await screen.findByText('Lifted recurring contribution.')).toBeTruthy()
    expect(client.getInvestmentItemHistory).toHaveBeenCalledWith(1, 'Emergency Fund')
  })
})
