import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { SetupView } from '@/features/setup/SetupView/SetupView.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

describe('SetupView', () => {
  it('shows the report file bound to the default factory and a run button', async () => {
    renderWithProviders(<SetupView />, { route: '/setup', path: '/setup' })
    expect(await screen.findByText('Хвосты КГМК.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Запустить анализ/ })).toBeInTheDocument()
  })

  it('renders target, price and capex fields', async () => {
    renderWithProviders(<SetupView />, { route: '/setup', path: '/setup' })
    expect(await screen.findByText('Целевой металл')).toBeInTheDocument()
    expect(screen.getByText('Цена металла, $/т')).toBeInTheDocument()
    expect(screen.getByText('Лимит CAPEX')).toBeInTheDocument()
  })
})
