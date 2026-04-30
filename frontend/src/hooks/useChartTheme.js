import { useState, useEffect } from 'react'

const LIGHT_PALETTE = {
  grid: '#e2e8f0',
  text: '#64748b',
  line1: '#0ea5e9',
  line2: '#0284c7',
  line3: '#f97316',
  line4: '#ea580c',
  line5: '#8b5cf6',
  line6: '#7c3aed',
  line7: '#10b981',
  line8: '#059669',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#1e293b',
}

const DARK_PALETTE = {
  grid: '#334155',
  text: '#94a3b8',
  line1: '#38bdf8',
  line2: '#0ea5e9',
  line3: '#fb923c',
  line4: '#f97316',
  line5: '#a78bfa',
  line6: '#8b5cf6',
  line7: '#34d399',
  line8: '#10b981',
  tooltipBg: '#1e293b',
  tooltipBorder: '#475569',
  tooltipText: '#f1f5f9',
}

export function useChartTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains('dark'))
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark ? DARK_PALETTE : LIGHT_PALETTE
}
