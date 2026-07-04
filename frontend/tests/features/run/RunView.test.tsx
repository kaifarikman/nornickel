import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { RunView } from '@/features/run/RunView/RunView.tsx'
import { ru } from '@/i18n/ru.ts'
import { renderWithProviders } from '../../utils/render.tsx'

const navigateSpy = vi.fn()

vi.mock('react-router', async (orig) => {
  const mod = await orig<typeof import('react-router')>()
  return { ...mod, useNavigate: () => navigateSpy }
})

afterEach(() => {
  navigateSpy.mockClear()
})

describe('RunView', () => {
  it('runs through the stages and navigates to the diagnosis exactly once', async () => {
    renderWithProviders(<RunView />, { route: '/run', path: '/run' })

    expect(await screen.findByText(ru.run.finishing, {}, { timeout: 10000 })).toBeInTheDocument()

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/diagnosis'), { timeout: 10000 })
    expect(navigateSpy).toHaveBeenCalledTimes(1)
  }, 20000)
})
