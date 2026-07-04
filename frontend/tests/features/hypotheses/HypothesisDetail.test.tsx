import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { api } from '@/api.ts'
import { HypothesisDetail } from '@/features/hypotheses/HypothesisDetail/HypothesisDetail.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

beforeEach(async () => {
  await api.resetRun('kgmk')
})

function renderDetail(id: string) {
  return renderWithProviders(<HypothesisDetail />, {
    route: `/hypotheses/${id}`,
    path: '/hypotheses/:id',
  })
}

describe('HypothesisDetail', () => {
  it('renders trace, evidence, economics and DOE for the top hypothesis', async () => {
    renderDetail('hyp_001')
    expect(
      await screen.findByRole('heading', {
        name: /Заменить песковые насадки гидроциклонов/,
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('Trace: цепочка происхождения')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Уменьшение диаметра песковой насадки гидроциклона смещает границу разделения в тонкую сторону: больше крупного материала уходит в пески и возвращается на доизмельчение.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Флотационные методы обогащения/).length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Экономический эффект')).toBeInTheDocument()
    expect(screen.getByText('План эксперимента (DOE)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Подтвердить рост раскрытия закрытого Pnt/Cp в крупных классах после смены насадок.',
      ),
    ).toBeInTheDocument()
  })

  it('shows all six score dimensions', async () => {
    renderDetail('hyp_001')
    expect(await screen.findByText('KPI impact')).toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
    expect(screen.getByText('Plausibility')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
    expect(screen.getByText('Risk')).toBeInTheDocument()
    expect(screen.getByText('Novelty')).toBeInTheDocument()
  })

  it('renders the evidence graph with hypothesis source nodes', async () => {
    renderDetail('hyp_001')
    const graph = await screen.findByRole('img', {
      name: /^Граф доказательств: /,
    })
    expect(graph).toBeInTheDocument()
  })

  it('shows not-found state for unknown id', async () => {
    renderDetail('hyp_999')
    expect(await screen.findByText('Гипотеза не найдена')).toBeInTheDocument()
  })
})
