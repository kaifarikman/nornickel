import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider, useLocale } from '@/i18n/index.tsx'

function Probe() {
  const { t, locale, setLocale } = useLocale()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="subtitle">{t.diagnosis.subtitle}</span>
      <button type="button" onClick={() => setLocale('en')}>
        switch
      </button>
    </div>
  )
}

describe('i18n', () => {
  it('defaults to russian and switches to english', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('hf-locale')
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale')).toHaveTextContent('ru')
    expect(screen.getByTestId('subtitle')).toHaveTextContent('Диагноз потерь металла с хвостами')
    await user.click(screen.getByRole('button', { name: 'switch' }))
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    expect(screen.getByTestId('subtitle')).toHaveTextContent('Metal loss diagnosis from tailings')
    expect(localStorage.getItem('hf-locale')).toBe('en')
  })
})
