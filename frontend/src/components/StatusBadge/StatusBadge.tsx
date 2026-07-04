import type { HypothesisStatus } from '@/contracts.ts'
import { useT } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import styles from './StatusBadge.module.css'

const STATUS_CLASS: Record<HypothesisStatus, string> = {
  recommended: 'recommended',
  watch: 'watch',
  rejected_by_constraints: 'rejected',
  needs_expert_review: 'review',
}

export function StatusBadge({ status }: { status: HypothesisStatus }) {
  const t = useT()
  return (
    <span className={cx(styles.badge, styles[STATUS_CLASS[status]])} title={t.statusReason[status]}>
      {t.board.statusTerms[status]}
    </span>
  )
}
