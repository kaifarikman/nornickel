import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dict, Locale } from './dict.ts'
import { ru } from './ru.ts'
import { en } from './en.ts'

const STORAGE_KEY = 'hf-locale'

const dicts: Record<Locale, Dict> = { ru, en }

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dict
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'ru'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: dicts[locale] }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (ctx === null) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

export function useT(): Dict {
  return useLocale().t
}
