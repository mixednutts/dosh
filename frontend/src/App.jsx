import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Spinner from './components/Spinner'

const BudgetsPage = lazy(() => import('./pages/BudgetsPage'))
const BudgetDetailPage = lazy(() => import('./pages/BudgetDetailPage'))
const BudgetPeriodsPage = lazy(() => import('./pages/BudgetPeriodsPage'))
const PeriodDetailPage = lazy(() => import('./pages/PeriodDetailPage'))

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
            <Route path="periods/:periodId" element={<PeriodDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
