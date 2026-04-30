import { renderHook, waitFor, act } from '@testing-library/react'
import { useChartTheme } from '../hooks/useChartTheme'

describe('useChartTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('returns light palette by default', () => {
    const { result } = renderHook(() => useChartTheme())
    expect(result.current.grid).toBe('#e2e8f0')
    expect(result.current.text).toBe('#64748b')
    expect(result.current.tooltipBg).toBe('#ffffff')
    expect(result.current.line1).toBe('#0ea5e9')
  })

  it('returns dark palette when html has dark class', () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useChartTheme())
    expect(result.current.grid).toBe('#334155')
    expect(result.current.text).toBe('#94a3b8')
    expect(result.current.tooltipBg).toBe('#1e293b')
    expect(result.current.line1).toBe('#38bdf8')
  })

  it('reacts when dark class is added', async () => {
    const { result } = renderHook(() => useChartTheme())
    expect(result.current.grid).toBe('#e2e8f0')

    act(() => {
      document.documentElement.classList.add('dark')
    })

    await waitFor(() => {
      expect(result.current.grid).toBe('#334155')
    })
  })

  it('reacts when dark class is removed', async () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useChartTheme())
    expect(result.current.grid).toBe('#334155')

    act(() => {
      document.documentElement.classList.remove('dark')
    })

    await waitFor(() => {
      expect(result.current.grid).toBe('#e2e8f0')
    })
  })
})
