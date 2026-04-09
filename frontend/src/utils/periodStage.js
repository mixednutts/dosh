export function getCycleStage(period) {
  if (!period) return 'PLANNED'
  if (period.cycle_stage) return period.cycle_stage
  if (period.closed_at || period.cycle_status === 'CLOSED') return 'CLOSED'
  if (period.cycle_status === 'ACTIVE') return 'CURRENT'
  return 'PLANNED'
}

export function getCycleStageLabel(stage) {
  if (stage === 'CURRENT') return 'Current'
  if (stage === 'PENDING_CLOSURE') return 'Pending Closure'
  if (stage === 'CLOSED') return 'Closed'
  return 'Planned'
}
