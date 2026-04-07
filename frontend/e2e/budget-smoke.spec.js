const { test, expect } = require('@playwright/test')

async function createBudget(page, name) {
  await page.goto('/budgets')

  const emptyState = page.getByText('No budgets yet. Create one to get started.')
  const hasEmptyState = await emptyState.count()
  if (hasEmptyState) {
    await expect(emptyState).toBeVisible()
  }

  await page.getByRole('button', { name: hasEmptyState ? 'Create Budget' : 'New Budget' }).click()
  await expect(page.getByRole('heading', { name: 'New Budget' })).toBeVisible()

  await page.getByPlaceholder('e.g. Household Budget 2025').fill(name)
  await page.getByPlaceholder('Your name').fill('Playwright User')
  await page.locator('select').selectOption('Monthly')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/budgets\/\d+\/setup$/)
  await expect(page.getByRole('heading', { name: 'Budget Info' })).toBeVisible()
}

async function completeMinimumSetup(page) {
  await page.getByRole('button', { name: 'Accounts' }).click()
  await page.getByRole('button', { name: /Add Account/i }).click()
  await expect(page.getByRole('heading', { name: 'Add Account' })).toBeVisible()
  await page.getByPlaceholder('e.g. Everyday Account').fill('Main Account')
  await page.getByPlaceholder('0.00').fill('1000')
  await page.getByLabel(/Primary transaction account \(expenses deducted from this account\)/i).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Main Account')).toBeVisible()

  await page.getByRole('button', { name: 'Income Sources' }).click()
  await page.getByRole('button', { name: /Add Income Source/i }).click()
  await expect(page.getByRole('heading', { name: 'Add Income Source' })).toBeVisible()
  await page.getByPlaceholder('e.g. Salary').fill('Salary')
  await page.locator('input[type="number"]').nth(0).fill('5000')
  await page.locator('select').nth(0).selectOption('Main Account')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Salary')).toBeVisible()

  await page.getByRole('button', { name: 'Expense Items' }).click()
  await page.getByRole('button', { name: /Add Expense Item/i }).click()
  await expect(page.getByRole('heading', { name: 'Add Expense Item' })).toBeVisible()
  await page.getByPlaceholder('e.g. Netflix').fill('Rent')
  await page.locator('input[type="number"]').nth(1).fill('1200')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/^Rent$/)).toBeVisible()
}

async function generateFirstCycle(page, startDate = '2026-04-01') {
  await page.goto(page.url().replace(/\/setup$/, ''))

  await expect(page.getByRole('button', { name: /Generate First Budget Cycle/i })).toBeEnabled()
  await page.getByRole('button', { name: /Generate First Budget Cycle/i }).click()
  await expect(page.getByRole('heading', { name: /Generate Budget Cycle for/i })).toBeVisible()
  await page.locator('input[type="date"]').fill(startDate)
  await page.locator('input[type="number"]').fill('1')
  await page.getByRole('button', { name: 'Generate Budget Cycle' }).click()

  await expect(page.getByText('No budget cycles yet')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Budget Cycles' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Current' })).toBeVisible()
  await expect(page.getByText('ACTIVE')).toBeVisible()
}

test('creates a budget and reaches setup and budget-cycle handoff', async ({ page }) => {
  await createBudget(page, 'E2E Household')
  await expect(page.getByText('Current Setup')).toBeVisible()
  await expect(page.getByText('0 accounts, 0 income sources, 0 active expense items, 0 investments')).toBeVisible()
  await expect(page.getByText('Choose one account as the primary transaction account so expense entries know where to land by default.')).toBeVisible()

  await page.goto(page.url().replace(/\/setup$/, ''))

  await expect(page.getByText('No budget cycles yet')).toBeVisible()
  await expect(page.getByText('Complete the setup steps first, then come back here to generate the first budget cycle.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Generate First Budget Cycle/i })).toBeDisabled()
})

test('creates minimum setup and generates the first budget cycle', async ({ page }) => {
  await createBudget(page, 'E2E First Cycle')
  await completeMinimumSetup(page)
  await generateFirstCycle(page)
  await expect(page.getByRole('link', { name: 'Details' })).toBeVisible()
})

test('records an expense transaction and updates cycle actuals and account movement', async ({ page }) => {
  await createBudget(page, 'E2E Expense Activity')
  await completeMinimumSetup(page)
  await generateFirstCycle(page)

  await page.getByRole('link', { name: 'Details' }).click()
  await expect(page).toHaveURL(/\/periods\/\d+$/)
  await expect(page.getByText(/^Expenses$/)).toBeVisible()

  const rentRow = page.locator('tr', { hasText: 'Rent' })
  await rentRow.getByTitle('Add expense transaction').click()

  await expect(page.getByRole('heading', { name: 'Transactions — Rent' })).toBeVisible()
  await page.getByPlaceholder('Amount').fill('500')
  await page.getByPlaceholder('Note (optional)').fill('Initial rent payment')
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Transactions — Rent' })).not.toBeVisible()
  await expect(rentRow.getByText('$500.00')).toBeVisible()

  const accountRow = page.locator('tr', { hasText: 'Main Account' })
  await expect(accountRow.getByText('-$500.00')).toBeVisible()
})

test('closes out a cycle, stores the snapshot, and creates the next active cycle', async ({ page }) => {
  await createBudget(page, 'E2E Closeout')
  await completeMinimumSetup(page)
  await generateFirstCycle(page)

  await page.getByRole('link', { name: 'Details' }).click()
  await expect(page).toHaveURL(/\/periods\/\d+$/)

  const rentRow = page.locator('tr', { hasText: 'Rent' })
  await rentRow.getByTitle('Add expense transaction').click()
  await expect(page.getByRole('heading', { name: 'Transactions — Rent' })).toBeVisible()
  await page.getByPlaceholder('Amount').fill('1200')
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Transactions — Rent' })).not.toBeVisible()

  await page.getByRole('button', { name: 'Close Out' }).click()
  await expect(page.getByRole('heading', { name: 'Close Out Budget Cycle' })).toBeVisible()
  await expect(page.getByText(/Carry Forward/i)).toBeVisible()

  await page.getByRole('checkbox', { name: /Create the next budget cycle automatically during close-out/i }).check()
  await page.locator('textarea').nth(0).fill('Closed out after the main rent payment cleared.')
  await page.locator('textarea').nth(1).fill('Keep daily spending within the remaining income next cycle.')
  await page.getByRole('button', { name: 'Close Out Cycle' }).click()

  await expect(page.getByText(/This budget cycle is closed\./)).toBeVisible()
  await expect(page.getByText(/Close-out Snapshot/i)).toBeVisible()
  await expect(page.getByText(/Closed out after the main rent payment cleared\./)).toBeVisible()
  await expect(page.getByText(/Next cycle goals: Keep daily spending within the remaining income next cycle\./)).toBeVisible()

  await page.getByRole('link', { name: 'E2E Closeout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Budget Cycles' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Current' })).toBeVisible()
  await expect(page.getByText('ACTIVE')).toBeVisible()
})
