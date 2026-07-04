import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/mulish/index.css'
import '@fontsource-variable/inter/index.css'
import '@fontsource/jetbrains-mono/index.css'
import '@fontsource/spectral/500.css'
import '@fontsource/spectral/600.css'
import './styles/tokens.css'
import './styles/global.css'
import { LocaleProvider } from '@/i18n/index.tsx'
import { FactoryProvider } from '@/app/factory.tsx'
import { RunProvider } from '@/app/run.tsx'
import { createQueryClient } from '@/app/queryClient.ts'
import { createRouter } from '@/app/router.tsx'

async function prepareMocks(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'msw') {
    const { worker } = await import('@/mocks/browser.ts')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }
}

function renderApp(): void {
  const queryClient = createQueryClient()
  const router = createRouter()
  const rootElement = document.getElementById('root')

  if (rootElement !== null) {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <FactoryProvider>
              <RunProvider>
                <RouterProvider router={router} />
              </RunProvider>
            </FactoryProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
  }
}

void prepareMocks().then(renderApp)
