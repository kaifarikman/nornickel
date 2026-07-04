import { Link } from 'react-router'
import { Play } from 'lucide-react'
import { useT } from '@/i18n/index.tsx'
import styles from './RunPendingState.module.css'

export function RunPendingState() {
  const t = useT()
  return (
    <div className={styles.wrap}>
      <p className={styles.text}>{t.common.runPending}</p>
      <Link to="/setup" className={styles.action}>
        <Play size={15} aria-hidden="true" />
        {t.common.goToSetup}
      </Link>
    </div>
  )
}
