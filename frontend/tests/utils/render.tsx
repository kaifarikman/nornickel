import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/app/queryClient.ts'
import { LocaleProvider } from '@/i18n/index.tsx'
import { FactoryProvider } from '@/app/factory.tsx'
import { RunProvider } from '@/app/run.tsx'

interface RenderOptions {
  route?: string
  path?: string
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}): RenderResult {
  const { route = '/', path = '*' } = options
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <LocaleProvider>
        <FactoryProvider>
          <RunProvider>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route path={path} element={ui} />
              </Routes>
            </MemoryRouter>
          </RunProvider>
        </FactoryProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  )
}
