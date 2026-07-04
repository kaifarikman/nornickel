import type { ReactNode } from 'react'
import { cx } from '@/lib/cx.ts'
import styles from './Panel.module.css'

interface PanelProps {
  title?: string
  children: ReactNode
  tone?: 'default' | 'info' | 'accent'
  bar?: boolean
  className?: string
}

export function Panel({ title, children, tone = 'default', bar = false, className }: PanelProps) {
  return (
    <section
      className={cx(
        styles.panel,
        tone === 'info' && styles.info,
        tone === 'accent' && styles.accent,
        bar && styles.bar,
        className,
      )}
    >
      {title !== undefined && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  )
}
