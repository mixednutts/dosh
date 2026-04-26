import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import BudgetHealthTab from '../pages/tabs/BudgetHealthTab'
import { renderWithProviders } from '../testUtils'

jest.mock('../api/client', () => ({
  updateBudget: jest.fn(),
  getBudgetHealthMatrix: jest.fn(),
  updateMatrixItem: jest.fn(),
  getAIVendorManifest: jest.fn(),
  getAIConfigStatus: jest.fn(),
  verifyAIKey: jest.fn(),
}))

const client = require('../api/client')

describe('BudgetHealthTab AI Insights', () => {
  const baseBudget = {
    budgetid: 1,
    description: 'Test Budget',
    health_tone: 'supportive',
    ai_insights_enabled: false,
    ai_provider: null,
    ai_model: null,
    ai_api_key_configured: false,
    ai_base_url: null,
    ai_custom_model: null,
    ai_system_prompt: null,
    ai_insights_on_closeout: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    client.getBudgetHealthMatrix.mockResolvedValue({ items: [] })
    client.getAIConfigStatus.mockResolvedValue({ encryption_ready: true })
  })

  it('shows AI Insights section with enable checkbox', async () => {
    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={baseBudget} />,
      { budget: baseBudget }
    )

    expect(await screen.findByText('AI Insights')).toBeTruthy()
    expect(screen.getByLabelText(/Enable AI Insights/i)).toBeTruthy()
  })

  it('shows encryption-not-ready banner when secret missing', async () => {
    client.getAIConfigStatus.mockResolvedValue({ encryption_ready: false })

    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={baseBudget} />,
      { budget: baseBudget }
    )

    expect(await screen.findByText(/AI Insights unavailable/i)).toBeTruthy()
    expect(screen.getByLabelText(/Enable AI Insights/i).disabled).toBe(true)
  })

  it('shows provider selector when AI enabled', async () => {
    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={{ ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter' }} />,
      { budget: { ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter' } }
    )

    expect(await screen.findByText('Provider')).toBeTruthy()
    expect(screen.getByLabelText(/Enable AI Insights/i).checked).toBe(true)
  })

  it('calls updateBudget when saving AI settings', async () => {
    client.updateBudget.mockResolvedValue({ ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter' })

    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={baseBudget} />,
      { budget: baseBudget }
    )

    fireEvent.click(await screen.findByLabelText(/Enable AI Insights/i))
    fireEvent.click(screen.getByText(/Save AI Settings/i))

    await waitFor(() => {
      expect(client.updateBudget).toHaveBeenCalledWith(1, expect.objectContaining({
        ai_insights_enabled: true,
      }))
    })
  })

  it('shows verify key button and handles success', async () => {
    client.verifyAIKey.mockResolvedValue({ status: 'valid' })

    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={{ ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter', ai_api_key_configured: true }} />,
      { budget: { ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter', ai_api_key_configured: true } }
    )

    const verifyButton = await screen.findByText('Verify Key')
    fireEvent.click(verifyButton)

    await waitFor(() => {
      expect(screen.getByText(/Key is valid/i)).toBeTruthy()
    })
  })

  it('shows verify key error detail on failure', async () => {
    client.verifyAIKey.mockRejectedValue({
      response: { data: { detail: 'Invalid API key or authentication failed.' } }
    })

    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={{ ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter', ai_api_key_configured: true }} />,
      { budget: { ...baseBudget, ai_insights_enabled: true, ai_provider: 'openrouter', ai_api_key_configured: true } }
    )

    const verifyButton = await screen.findByText('Verify Key')
    fireEvent.click(verifyButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/i)).toBeTruthy()
    })
  })

  it('shows close-out toggle when AI enabled and key configured', async () => {
    renderWithProviders(
      <BudgetHealthTab budgetId={1} budget={{ ...baseBudget, ai_insights_enabled: true, ai_api_key_configured: true }} />,
      { budget: { ...baseBudget, ai_insights_enabled: true, ai_api_key_configured: true } }
    )

    expect(await screen.findByLabelText(/Generate AI Insight on Close Out/i)).toBeTruthy()
  })
})
