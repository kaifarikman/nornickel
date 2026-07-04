import { Link } from 'react-router'
import { X } from 'lucide-react'
import type { GraphNode, Hypothesis, KpiContract } from '@/contracts.ts'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge.tsx'
import { useT } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { capexClassOf } from '@/lib/capex.ts'
import { formatHypId, formatTons, formatUsdRange } from '@/lib/format.ts'
import { targetElement } from '@/lib/domain.ts'
import { toScore100 } from '@/lib/score.ts'
import styles from './HypothesisCard.module.css'

interface HypothesisCardProps {
  hypothesis: Hypothesis
  contract: KpiContract
  entities?: GraphNode[]
  rankShift?: number
  highlight?: boolean
  excludableFactorId?: string
  onExclude?: (factorId: string) => void
}

export function HypothesisCard({
  hypothesis,
  contract,
  entities,
  rankShift,
  highlight,
  excludableFactorId,
  onExclude,
}: HypothesisCardProps) {
  const t = useT()
  const score = toScore100(hypothesis.score_total)
  const capexClass = capexClassOf(hypothesis, entities)
  const element = targetElement(contract)
  const addressable = hypothesis.economic_effect.addressable_tons[element] ?? 0
  const isTop = hypothesis.rank === 1
  const expertMatched = hypothesis.expert_match?.matched === true
  const canExclude =
    excludableFactorId !== undefined &&
    onExclude !== undefined &&
    hypothesis.status !== 'rejected_by_constraints'

  const handleExclude = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (excludableFactorId !== undefined) {
      onExclude?.(excludableFactorId)
    }
  }

  return (
    <Link
      to={`/hypotheses/${hypothesis.id}`}
      className={cx(styles.card, highlight === true && styles.cardChanged, isTop && styles.cardTop)}
    >
      <div className={styles.header}>
        <span className={styles.id}>{formatHypId(hypothesis.id)}</span>
        <div className={styles.badges}>
          {expertMatched && <span className={styles.expertBadge}>{t.board.expertMatchBadge}</span>}
          <StatusBadge status={hypothesis.status} />
          {canExclude && (
            <button
              type="button"
              className={styles.excludeButton}
              onClick={handleExclude}
              aria-label={t.board.excludeThis}
              title={t.board.excludeThis}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className={styles.title}>{hypothesis.title}</div>

      <div className={styles.value}>
        {formatUsdRange(hypothesis.economic_effect.value_usd_range, t.units)}
      </div>

      <div className={styles.metrics}>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{t.board.addressableTons}</span>
          <span className={styles.metricValue}>
            {formatTons(addressable, t.units)} {t.elements[element]}
          </span>
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{t.board.capex}</span>
          <span className={styles.metricValue}>
            {t.capexClasses[capexClass] ?? String(capexClass)}
          </span>
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{t.common.score}</span>
          <span className={styles.metricValue}>{score}</span>
        </span>
        {rankShift !== undefined && rankShift !== 0 && (
          <span className={cx(styles.rankShift, rankShift > 0 ? styles.rankUp : styles.rankDown)}>
            {rankShift > 0 ? t.board.rankUp(rankShift) : t.board.rankDown(Math.abs(rankShift))}
          </span>
        )}
      </div>
    </Link>
  )
}
