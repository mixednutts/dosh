import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BudgetsPage from './pages/BudgetsPage'
import BudgetDetailPage from './pages/BudgetDetailPage'
import PeriodDetailPage from './pages/PeriodDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
          <Route path="periods/:periodId" element={<PeriodDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
