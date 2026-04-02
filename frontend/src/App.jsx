import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import BudgetsPage from './pages/BudgetsPage'
import BudgetDetailPage from './pages/BudgetDetailPage'
import BudgetPeriodsPage from './pages/BudgetPeriodsPage'
import PeriodDetailPage from './pages/PeriodDetailPage'

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
