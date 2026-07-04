import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/api.ts'
import { HypothesisBoard } from '@/features/hypotheses/HypothesisBoard/HypothesisBoard.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

beforeEach(async () => {
  await api.resetRun('kgmk')
})

describe('HypothesisBoard', () => {
  it('renders fixture hypotheses with real titles', async () => {
    renderWithProviders(<HypothesisBoard />)
    expect(
      await screen.findByText('Заменить песковые насадки гидроциклонов 12" → 8"'),
    ).toBeInTheDocument()
    expect(screen.getByText('Изменить геометрию футеровки шаровых мельниц')).toBeInTheDocument()
    expect(
      screen.getByText('Магнитная сепарация надцелевого класса с доизмельчением в отдельном цикле'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Снизить переизмельчение: контроль гранулометрии и стабилизация помола'),
    ).toBeInTheDocument()
  })

  it('shows status terms on cards', async () => {
    renderWithProviders(<HypothesisBoard />)
    expect((await screen.findAllByText('recommended')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('watch').length).toBeGreaterThanOrEqual(1)
  })

  it('recomputes the board when a factor is excluded', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HypothesisBoard />)
    expect(screen.queryByText('rejected')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('combobox', { name: 'Исключить фактор' }))
    await user.click(
      await screen.findByRole('option', { name: 'диаметр песковой насадки гидроциклона' }),
    )
    await user.click(screen.getByRole('button', { name: 'Пересчитать' }))

    await waitFor(() => {
      expect(screen.getByText('rejected')).toBeInTheDocument()
    })
    expect(screen.getByText('Портфель пересобран', { exact: false })).toBeInTheDocument()
  })

  it('resets the board back to the fixture state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HypothesisBoard />)

    await user.click(await screen.findByRole('combobox', { name: 'Исключить фактор' }))
    await user.click(
      await screen.findByRole('option', { name: 'диаметр песковой насадки гидроциклона' }),
    )
    await user.click(screen.getByRole('button', { name: 'Пересчитать' }))
    await waitFor(() => {
      expect(screen.getByText('rejected')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    await waitFor(() => {
      expect(screen.queryByText('rejected')).not.toBeInTheDocument()
    })
  })
})
