import { useLocation } from 'react-router'
import { useLocale } from '@/i18n/index.tsx'
import type { Locale } from '@/i18n/dict.ts'
import { cx } from '@/lib/cx.ts'
import { resolveScreen, screenSubtitle } from '@/app/screens.ts'
import { useFactory } from '@/app/factory.tsx'
import { FACTORY_ORDER, toFactoryId } from '@/lib/domain.ts'
import { Select } from '@/components/Select/Select.tsx'
import styles from './TopBar.module.css'

const LOCALES: Locale[] = ['ru', 'en']

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t, locale, setLocale } = useLocale()
  const { factory, setFactory } = useFactory()
  const { pathname } = useLocation()
  const screen = resolveScreen(pathname)

  const activeLocale = LOCALES.indexOf(locale)

  const factoryOptions = FACTORY_ORDER.map((f) => ({ value: f, label: t.factory.names[f] }))

  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menu} onClick={onMenu} aria-label={t.layout.openNav}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            d="M3 6h14M3 10h14M3 14h14"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <label className={styles.factory}>
        <span className={styles.factoryLabel}>{t.factory.label}</span>
        <Select
          className={styles.factorySelect}
          value={factory}
          options={factoryOptions}
          onChange={(v) => setFactory(toFactoryId(v))}
          ariaLabel={t.factory.switchAria}
        />
      </label>
      <h1 className={styles.title}>{screenSubtitle(t, screen.titleKey)}</h1>
      <div
        className={styles.localeSwitch}
        role="group"
        aria-label={t.layout.langSwitch}
        style={{ '--active-locale': activeLocale } as React.CSSProperties}
      >
        <span className={styles.localeThumb} aria-hidden="true" />
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={cx(styles.localeButton, locale === l && styles.localeButtonActive)}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  )
}
