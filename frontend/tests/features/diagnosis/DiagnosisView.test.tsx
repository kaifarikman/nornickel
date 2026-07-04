import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/api.ts'
import { DiagnosisView } from '@/features/diagnosis/DiagnosisView/DiagnosisView.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

beforeEach(async () => {
  localStorage.clear()
  await api.resetRun('kgmk')
})

describe('DiagnosisView', () => {
  it('renders loss summary stats after loading', async () => {
    renderWithProviders(<DiagnosisView />)
    expect(await screen.findByText('Потеряно всего')).toBeInTheDocument()
    expect(screen.getByText('Извлекаемо')).toBeInTheDocument()
    expect(screen.getByText('Потенциал')).toBeInTheDocument()
  })

  it('renders the loss heatmap with tooltip cells', async () => {
    renderWithProviders(<DiagnosisView />)
    const heatmap = await screen.findByRole('group', {
      name: 'Карта потерь: класс крупности × минералогия',
    })
    const cells = within(heatmap).getAllByRole('button')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells[0]).toHaveAttribute('aria-label')
  })

  it('switches the target element and keeps rendering', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DiagnosisView />)
    const group = await screen.findByRole('group', { name: 'Элемент' })
    const button29 = within(group).getByRole('button', { name: 'Элемент 29' })
    await user.click(button29)
    expect(button29).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Потеряно всего')).toBeInTheDocument()
  })

  it('renders the diagnosis breakdown band', async () => {
    renderWithProviders(<DiagnosisView />)
    expect(await screen.findByText('Потери по диагнозам')).toBeInTheDocument()
  })
})
