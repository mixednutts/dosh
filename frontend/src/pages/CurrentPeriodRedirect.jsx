import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCurrentPeriodDetail } from '../api/client'
import Spinner from '../components/Spinner'

export default function CurrentPeriodRedirect() {
  const { budgetId } = useParams()
  const budgetid = Number.parseInt(budgetId, 10)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['current-period', budgetid],
    queryFn: () => getCurrentPeriodDetail(budgetid),
    enabled: !Number.isNaN(budgetid),
    retry: false,
  })

  useEffect(() => {
    if (data?.period?.finperiodid) {
      // Navigation happens via the rendered <Navigate> below
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (isError || !data?.period?.finperiodid) {
    return <Navigate to={`/budgets/${budgetId}`} replace />
  }

  return (
    <Navigate
      to={`/budgets/${budgetId}/periods/${data.period.finperiodid}`}
      replace
    />
  )
}
