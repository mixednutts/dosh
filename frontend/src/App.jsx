import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Spinner from './components/Spinner'

const BudgetsPage = lazy(() => import('./pages/BudgetsPage'))
const BudgetDetailPage = lazy(() => import('./pages/BudgetDetailPage'))
const BudgetPeriodsPage = lazy(() => import('./pages/BudgetPeriodsPage'))
const PeriodDetailPage = lazy(() => import('./pages/PeriodDetailPage'))
const CurrentPeriodRedirect = lazy(() => import('./pages/CurrentPeriodRedirect'))
const ReportsLandingPage = lazy(() => import('./pages/ReportsLandingPage'))
const BudgetVsActualPage = lazy(() => import('./pages/BudgetVsActualPage'))
const IncomeAllocationPage = lazy(() => import('./pages/IncomeAllocationPage'))
const InvestmentTrendsPage = lazy(() => import('./pages/InvestmentTrendsPage'))
const HealthHistoryPage = lazy(() => import('./pages/HealthHistoryPage'))

function PageLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/budgets" replace />} />
            <Route path="dashboard" element={<Navigate to="/budgets" replace />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="budgets/:budgetId" element={<BudgetPeriodsPage />} />
            <Route path="budgets/:budgetId/setup" element={<BudgetDetailPage />} />
            <Route path="budgets/:budgetId/periods/current" element={<CurrentPeriodRedirect />} />
            <Route path="budgets/:budgetId/periods/:periodId" element={<PeriodDetailPage />} />
            <Route path="reports" element={<ReportsLandingPage />} />
            <Route path="reports/:budgetId" element={<ReportsLandingPage />} />
            <Route path="reports/budget-vs-actual" element={<BudgetVsActualPage />} />
            <Route path="reports/income-allocation" element={<IncomeAllocationPage />} />
            <Route path="reports/investment-trends" element={<InvestmentTrendsPage />} />
            <Route path="reports/health-history" element={<HealthHistoryPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
