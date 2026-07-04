import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/api.ts'
import { ReportExport } from '@/features/report/ReportExport/ReportExport.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

beforeEach(async () => {
  await api.resetRun('kgmk')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReportExport', () => {
  it('renders the portfolio preview with real hypothesis titles', async () => {
    renderWithProviders(<ReportExport />)
    expect(await screen.findByText('Отчёт: портфель гипотез')).toBeInTheDocument()
    expect(await screen.findByText(/Заменить песковые насадки/)).toBeInTheDocument()
    expect(await screen.findByText(/Магнитная сепарация/)).toBeInTheDocument()
  })

  it('offers JSON and CSV export actions', async () => {
    renderWithProviders(<ReportExport />)
    expect(await screen.findByRole('button', { name: 'Экспорт JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт CSV' })).toBeInTheDocument()
  })

  it('creates an object URL when exporting JSON and CSV', async () => {
    URL.createObjectURL = URL.createObjectURL ?? (() => 'blob:x')
    URL.revokeObjectURL = URL.revokeObjectURL ?? (() => {})
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()

    renderWithProviders(<ReportExport />)

    const jsonButton = await screen.findByRole('button', { name: 'Экспорт JSON' })
    await user.click(jsonButton)
    expect(createSpy).toHaveBeenCalledTimes(1)

    const csvButton = screen.getByRole('button', { name: 'Экспорт CSV' })
    await user.click(csvButton)
    expect(createSpy).toHaveBeenCalledTimes(2)
  })
})
