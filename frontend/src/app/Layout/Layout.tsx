import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppBackground } from '@/app/AppBackground/AppBackground.tsx'
import { Sidebar } from '@/app/Sidebar/Sidebar.tsx'
import { TopBar } from '@/app/TopBar/TopBar.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary.tsx'
import { useT } from '@/i18n/index.tsx'
import styles from './Layout.module.css'

export function Layout() {
  const t = useT()
  const [navOpen, setNavOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!navOpen) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className={styles.shell}>
      <AppBackground />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className={styles.main}>
        <TopBar onMenu={() => setNavOpen(true)} />
        <main className={styles.content}>
          <ErrorBoundary fallbackTitle={t.common.crashTitle} fallbackAction={t.common.crashAction}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
