import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import BudgetPeriodsPage from '../pages/BudgetPeriodsPage'
import { renderWithProviders } from '../testUtils'

const mockNavigate = jest.fn()

jest.mock('../api/client', () => ({
  deleteBudget: jest.fn(),
  getBudget: jest.fn(),
  getBudgetSetupAssessment: jest.fn(),
  getPeriodDeleteOptions: jest.fn(),
  getPeriodSummariesForBudget: jest.fn(),
  generatePeriod: jest.fn(),
  deletePeriod: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

const client = require('../api/client')

describe('BudgetPeriodsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: true,
      blocking_issues: [],
      warnings: [],
      accounts: [],
    })
  })

  it('allows deleting the current budget directly from the empty budget cycles state', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([])
    client.deleteBudget.mockResolvedValue({})
    window.confirm = jest.fn(() => true)

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText('No budget cycles yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Budget' }))

    await waitFor(() => {
      expect(client.deleteBudget).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/budgets')
    })
  })

  it('shows future-chain delete messaging when continuity requires it', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([
      {
        period: {
          finperiodid: 11,
          budgetid: 1,
          startdate: '2026-04-01T00:00:00',
          enddate: '2026-04-30T00:00:00',
          islocked: false,
          cycle_status: 'PLANNED',
        },
        income_budget: '1000.00',
        income_actual: '0.00',
        expense_budget: '800.00',
        expense_actual: '0.00',
        investment_budget: '0.00',
        investment_actual: '0.00',
        surplus_budget: '200.00',
        surplus_actual: '0.00',
        projected_savings: '0.00',
        can_delete: true,
        delete_mode: 'future_chain',
        delete_reason: 'Deleting this cycle requires deleting it and all upcoming cycles to preserve continuity.',
      },
    ])
    client.getPeriodDeleteOptions.mockResolvedValue({
      can_delete_single: false,
      can_delete_future_chain: true,
      future_chain_count: 3,
      delete_reason: 'Delete this cycle and all upcoming cycles to preserve continuity.',
      cycle_status: 'PLANNED',
    })
    client.deletePeriod.mockResolvedValue({})

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText('Budget Cycles')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Expand upcoming budget cycles'))
    fireEvent.click(screen.getByTitle('Delete budget cycle'))

    expect(await screen.findByText(/Delete this cycle and all upcoming cycles \(3\)/)).toBeTruthy()
    expect(screen.getByText(/preserve continuity/i)).toBeTruthy()
  })

  it('keeps delete confirmation disabled when the cycle is not deletable', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([
      {
        period: {
          finperiodid: 12,
          budgetid: 1,
          startdate: '2026-05-01T00:00:00',
          enddate: '2026-05-31T00:00:00',
          islocked: false,
          cycle_status: 'ACTIVE',
        },
        income_budget: '1000.00',
        income_actual: '1000.00',
        expense_budget: '800.00',
        expense_actual: '800.00',
        investment_budget: '0.00',
        investment_actual: '0.00',
        surplus_budget: '200.00',
        surplus_actual: '200.00',
        projected_savings: '0.00',
        can_delete: true,
        delete_mode: 'single',
        delete_reason: 'This cycle has activity recorded against it.',
      },
    ])
    client.getPeriodDeleteOptions.mockResolvedValue({
      can_delete_single: false,
      can_delete_future_chain: false,
      future_chain_count: 0,
      delete_reason: 'Only cycles without actuals or transactions can be removed.',
      cycle_status: 'ACTIVE',
    })

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText('Budget Cycles')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Delete budget cycle'))

    expect(await screen.findByRole('button', { name: 'Delete Budget Cycle' })).toBeTruthy()
    expect(screen.getByText(/Only cycles without actuals or transactions can be removed\./)).toBeTruthy()

    const deleteButton = screen.getByRole('button', { name: 'Delete Budget Cycle' })
    expect(deleteButton.disabled).toBe(true)
    expect(client.deletePeriod).not.toHaveBeenCalled()
  })

  it('blocks budget cycle generation when setup is incomplete', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: false,
      blocking_issues: [
        'Add at least one income type so your budget cycle has income to plan with.',
        'Add at least one active expense item so your budget cycle has spending to plan for.',
      ],
      warnings: [],
      accounts: [],
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([])

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText(/Add at least one income type so your budget cycle has income to plan with\./)).toBeTruthy()
    expect(screen.getByText(/Add at least one active expense item so your budget cycle has spending to plan for\./)).toBeTruthy()
    expect(screen.getByText(/Complete the setup steps first, then come back here to generate the first budget cycle\./)).toBeTruthy()
    expect(screen.queryByText(/This budget is ready to start using once you generate the first budget cycle\./)).toBeNull()

    const newCycleButton = screen.getByTitle('Add at least one income type so your budget cycle has income to plan with.')
    expect(newCycleButton.disabled).toBe(true)

    const firstCycleButton = screen.getByText('Generate First Budget Cycle')
    expect(firstCycleButton.disabled).toBe(true)
  })

  it('blocks budget cycle generation when no primary account is configured', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getBudgetSetupAssessment.mockResolvedValue({
      budgetid: 1,
      can_generate: false,
      blocking_issues: ['Choose one active account as the primary transaction account so expense entries have a default home.'],
      warnings: [],
      accounts: [],
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([])

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText(/Choose one active account as the primary transaction account so expense entries have a default home\./)).toBeTruthy()
    expect(screen.getByText(/Complete the setup steps first, then come back here to generate the first budget cycle\./)).toBeTruthy()

    const newCycleButton = screen.getByTitle('Choose one active account as the primary transaction account so expense entries have a default home.')
    expect(newCycleButton.disabled).toBe(true)

    const firstCycleButton = screen.getByText('Generate First Budget Cycle')
    expect(firstCycleButton.disabled).toBe(true)
  })

  it('remembers the historical budget cycles section state for the browser session', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([
      {
        period: {
          finperiodid: 31,
          budgetid: 1,
          startdate: '2026-03-01T00:00:00',
          enddate: '2026-03-31T00:00:00',
          islocked: false,
          cycle_status: 'CLOSED',
        },
        income_budget: '1000.00',
        income_actual: '1000.00',
        expense_budget: '800.00',
        expense_actual: '790.00',
        investment_budget: '0.00',
        investment_actual: '0.00',
        surplus_budget: '200.00',
        surplus_actual: '210.00',
        projected_savings: '0.00',
        can_delete: false,
      },
    ])

    const firstRender = renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByText('Budget Cycles')).toBeTruthy()
    expect(screen.getByTitle('Expand historical budget cycles')).toBeTruthy()
    expect(screen.queryByText('31 Mar 26')).toBeNull()

    fireEvent.click(screen.getByTitle('Expand historical budget cycles'))

    expect(await screen.findByTitle('Collapse historical budget cycles')).toBeTruthy()
    expect(screen.getByText('31 Mar 26')).toBeTruthy()

    firstRender.unmount()

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    expect(await screen.findByTitle('Collapse historical budget cycles')).toBeTruthy()
    expect(screen.getByText('31 Mar 26')).toBeTruthy()
  })

  it('shows generation errors when setup is complete but generation fails', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([])
    client.generatePeriod.mockRejectedValue({
      response: {
        data: {
          detail: 'A future cycle already overlaps that start date.',
        },
      },
    })

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    fireEvent.click(await screen.findByText('Generate First Budget Cycle'))
    expect(await screen.findByText('Generate Budget Cycle for Home Budget')).toBeTruthy()

    const startDateInput = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/)

    fireEvent.change(startDateInput, {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(screen.getByDisplayValue('1'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByText('Generate Budget Cycle'))

    await waitFor(() => {
      expect(client.generatePeriod).toHaveBeenCalledWith({
        budgetid: 1,
        startdate: '2026-09-01T00:00:00',
        count: 2,
      })
    })

    expect(await screen.findByText('A future cycle already overlaps that start date.')).toBeTruthy()
  })

  it('opens generation with the next suggested start date when setup is ready', async () => {
    client.getBudget.mockResolvedValue({
      budgetid: 1,
      budgetowner: 'Alex',
      description: 'Home Budget',
      budget_frequency: 'Monthly',
    })
    client.getPeriodSummariesForBudget.mockResolvedValue([
      {
        period: {
          finperiodid: 21,
          budgetid: 1,
          startdate: '2026-08-01T00:00:00',
          enddate: '2026-08-31T00:00:00',
          islocked: false,
          cycle_status: 'ACTIVE',
        },
        income_budget: '1000.00',
        income_actual: '500.00',
        expense_budget: '800.00',
        expense_actual: '400.00',
        investment_budget: '0.00',
        investment_actual: '0.00',
        surplus_budget: '200.00',
        surplus_actual: '100.00',
        projected_savings: '100.00',
        can_delete: true,
        delete_mode: 'single',
      },
    ])
    client.generatePeriod.mockResolvedValue({ finperiodid: 22 })

    renderWithProviders(<BudgetPeriodsPage />, {
      route: '/budgets/1',
      path: '/budgets/:budgetId',
    })

    const newCycleButton = await screen.findByTitle('Generate a new budget cycle')
    expect(newCycleButton.disabled).toBe(false)

    fireEvent.click(newCycleButton)
    expect(await screen.findByText('Generate Budget Cycle for Home Budget')).toBeTruthy()
    expect(screen.getByDisplayValue('2026-09-01')).toBeTruthy()

    fireEvent.click(screen.getByText('Generate Budget Cycle'))

    await waitFor(() => {
      expect(client.generatePeriod).toHaveBeenCalledWith({
        budgetid: 1,
        startdate: '2026-09-01T00:00:00',
        count: 1,
      })
    })
  })
})
