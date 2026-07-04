import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { api } from '@/api.ts'
import { BenchmarkView } from '@/features/benchmark/BenchmarkView/BenchmarkView.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

beforeEach(async () => {
  await api.resetRun('kgmk')
})

describe('BenchmarkView', () => {
  it('shows the reproduced counter', async () => {
    renderWithProviders(<BenchmarkView />)
    expect(await screen.findByText(/Воспроизведено/)).toBeInTheDocument()
  })

  it('renders both expert and system columns', async () => {
    renderWithProviders(<BenchmarkView />)
    expect(await screen.findByText('Эксперты (мозговой штурм)')).toBeInTheDocument()
    expect(screen.getByText('Система')).toBeInTheDocument()
  })

  it('marks matched expert pairs and novel system hypotheses', async () => {
    renderWithProviders(<BenchmarkView />)
    expect((await screen.findAllByText('совпадение')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('нет у экспертов').length).toBeGreaterThanOrEqual(1)
  })
})
