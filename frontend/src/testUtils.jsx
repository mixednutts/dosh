import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { LocalisationProvider } from './components/LocalisationContext'

export function renderWithProviders(ui, { route = '/', path = '/', budget = undefined } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LocalisationProvider budget={budget}>
        <MemoryRouter
          initialEntries={[route]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </LocalisationProvider>
    </QueryClientProvider>
  )
}
