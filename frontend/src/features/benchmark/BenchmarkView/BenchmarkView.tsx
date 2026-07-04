import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api.ts'
import type { ExpertHypothesis, Hypothesis } from '@/contracts.ts'
import { Panel } from '@/components/Panel/Panel.tsx'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { useLocale } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { formatHypId } from '@/lib/format.ts'
import { useFactory } from '@/app/factory.tsx'
import styles from './BenchmarkView.module.css'

export function BenchmarkView() {
  const { t } = useLocale()
  const { factory } = useFactory()

  const experts = useQuery({
    queryKey: ['experts'],
    queryFn: () => api.getExpertHypotheses(),
  })
  const board = useQuery({
    queryKey: ['board', factory],
    queryFn: () => api.getBoard(factory),
  })

  const model = useMemo(() => {
    if (experts.data === undefined || board.data === undefined) {
      return null
    }
    const factoryExperts = experts.data.filter((e) => e.factory_id === factory)
    const systemHypotheses: Hypothesis[] = board.data?.hypotheses ?? []

    const expertToSystem = new Map<string, Hypothesis>()
    for (const h of systemHypotheses) {
      if (h.expert_match?.matched === true) {
        expertToSystem.set(h.expert_match.expert_hypothesis_id, h)
      }
    }

    const matched = expertToSystem.size
    const total = factoryExperts.length
    const novel = systemHypotheses.filter((h) => h.expert_match === null).length

    return {
      factoryExperts,
      systemHypotheses,
      expertToSystem,
      matched,
      total,
      novel,
      hasBoard: board.data !== null,
    }
  }, [experts.data, board.data, factory])

  if (experts.isPending || board.isPending) {
    return <LoadingState />
  }
  if (experts.isError || board.isError) {
    return <ErrorState onRetry={() => refetchAll([experts, board])} />
  }

  if (model === null) {
    return (
      <ErrorState
        onRetry={() => {
          void experts.refetch()
          void board.refetch()
        }}
      />
    )
  }

  const { factoryExperts, systemHypotheses, expertToSystem, matched, total, novel, hasBoard } =
    model

  return (
    <div className={styles.screen}>
      <div className={styles.headline}>
        <span className={styles.headlineLabel}>{t.benchmark.subtitle}</span>
        <span className={styles.headlineValue}>
          {t.benchmark.reproduced({ matched, total, novel })}
        </span>
      </div>

      <div className={styles.columns}>
        <Panel title={t.benchmark.experts}>
          <ul className={styles.list}>
            {factoryExperts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                match={expertToSystem.get(expert.id) ?? null}
              />
            ))}
          </ul>
        </Panel>

        <Panel title={t.benchmark.system}>
          {hasBoard ? (
            <ul className={styles.list}>
              {systemHypotheses.map((h) => (
                <SystemCard key={h.id} hypothesis={h} />
              ))}
            </ul>
          ) : (
            <p className={styles.pending}>{t.common.runPending}</p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function ExpertCard({ expert, match }: { expert: ExpertHypothesis; match: Hypothesis | null }) {
  const { t } = useLocale()
  const isMatched = match !== null
  return (
    <li className={cx(styles.card, isMatched ? styles.cardMatched : styles.cardMuted)}>
      <div className={styles.cardHead}>
        <span className={styles.meta}>{t.benchmark.leverTypes[expert.lever_type]}</span>
        {isMatched ? (
          <span className={styles.badgeMatched}>{t.benchmark.matched}</span>
        ) : (
          <span className={styles.badgeMuted}>{t.benchmark.uncovered}</span>
        )}
      </div>
      <p className={styles.expertText}>{expert.text}</p>
      <div className={styles.cardFoot}>
        <span className={styles.hint}>{t.diagnoses[expert.diagnosis_hint]}</span>
        {isMatched && <span className={styles.pairId}>↔ {formatHypId(match.id)}</span>}
      </div>
    </li>
  )
}

function SystemCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const { t } = useLocale()
  const match = hypothesis.expert_match
  const isMatched = match?.matched === true
  const isNovel = match === null
  return (
    <li
      className={cx(
        styles.card,
        isMatched ? styles.cardMatched : isNovel ? styles.cardNovel : styles.card,
      )}
    >
      <div className={styles.cardHead}>
        <span className={styles.meta}>{formatHypId(hypothesis.id)}</span>
        <StatusBadge status={hypothesis.status} />
      </div>
      <p className={styles.systemTitle}>{hypothesis.title}</p>
      <div className={styles.cardFoot}>
        {isMatched && <span className={styles.pairId}>↔ {match.expert_hypothesis_id}</span>}
        {isNovel && <span className={styles.badgeNovel}>{t.benchmark.notInExperts}</span>}
      </div>
    </li>
  )
}
