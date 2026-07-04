import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { BrandMark } from '@/components/BrandMark/BrandMark.tsx'
import { useT } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { SCREENS } from '@/app/screens.ts'
import styles from './Sidebar.module.css'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function activeIndex(pathname: string) {
  const idx = SCREENS.findIndex((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))
  return idx === -1 ? 0 : idx
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const t = useT()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const [focusIndex, setFocusIndex] = useState(() => activeIndex(pathname))

  useEffect(() => {
    setFocusIndex(activeIndex(pathname))
  }, [pathname])

  const move = (delta: number) => {
    const links = navRef.current?.querySelectorAll<HTMLElement>(`.${styles.navItem}`)
    if (links === undefined || links.length === 0) {
      return
    }
    const current = Array.from(links).findIndex((el) => el === document.activeElement)
    const base = current === -1 ? focusIndex : current
    const next = (base + delta + links.length) % links.length
    links[next]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const links = navRef.current?.querySelectorAll<HTMLElement>(`.${styles.navItem}`)
      const current = links
        ? Array.from(links).findIndex((el) => el === document.activeElement)
        : -1
      const target = SCREENS[current === -1 ? focusIndex : current]
      if (target !== undefined) {
        void navigate(target.path)
        onClose()
      }
    }
  }

  return (
    <>
      <div
        className={cx(styles.scrim, open && styles.scrimOpen)}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={cx(styles.sidebar, open && styles.sidebarOpen)}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <BrandMark size={28} title={t.layout.appName} />
          </span>
          <div className={styles.brandName}>{t.layout.appName}</div>
        </div>
        <nav
          ref={navRef}
          className={styles.nav}
          onKeyDown={handleKeyDown}
          style={{ '--focus-index': focusIndex } as React.CSSProperties}
        >
          <span className={styles.navHighlight} aria-hidden="true" />
          {SCREENS.map((screen, index) => (
            <NavLink
              key={screen.path}
              to={screen.path}
              tabIndex={index === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onClick={onClose}
              className={({ isActive }) => cx(styles.navItem, isActive && styles.navItemActive)}
            >
              <span className={styles.navNumber}>{screen.number}</span>
              <span>{t.nav[screen.navKey]}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
