import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary.tsx'

function Boom(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders the fallback alert with title, message and action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallbackTitle="Ошибка" fallbackAction="Повторить">
        <Boom />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Ошибка')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('keeps the reset button clickable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(
      <ErrorBoundary fallbackTitle="Ошибка" fallbackAction="Повторить">
        <Boom />
      </ErrorBoundary>,
    )

    const button = screen.getByRole('button', { name: 'Повторить' })
    await user.click(button)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
