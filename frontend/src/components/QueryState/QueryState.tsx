import { useT } from '@/i18n/index.tsx'
import styles from './QueryState.module.css'

export function LoadingState() {
  const t = useT()
  return (
    <div className={styles.skeleton} role="status" aria-label={t.common.loading}>
      <span className={styles.line} style={{ width: '38%' }} />
      <span className={styles.block} />
      <span className={styles.line} style={{ width: '62%' }} />
      <span className={styles.line} style={{ width: '48%' }} />
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useT()
  return (
    <div className={styles.error} role="alert">
      {t.common.error}
      {onRetry !== undefined && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {t.common.retry}
        </button>
      )}
    </div>
  )
}
