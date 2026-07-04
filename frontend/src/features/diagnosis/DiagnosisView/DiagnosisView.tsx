import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Play } from 'lucide-react'
import { api } from '@/api.ts'
import type { Element, TailsSection } from '@/contracts.ts'
import { Panel } from '@/components/Panel/Panel.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { useLocale } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { formatTons, formatUsdPerYear } from '@/lib/format.ts'
import {
  DEFAULT_PRICE_USD_PER_T,
  DIAGNOSIS_ORDER,
  ELEMENTS,
  recoverableTons,
} from '@/lib/domain.ts'
import { useFactory } from '@/app/factory.tsx'
import { useRun } from '@/app/run.tsx'
import { Heatmap } from '@/features/diagnosis/Heatmap/Heatmap.tsx'
import styles from './DiagnosisView.module.css'

export function DiagnosisView() {
  const { t } = useLocale()
  const { factory } = useFactory()
  const { hasRun } = useRun()
  const [searchParams] = useSearchParams()
  const [element, setElement] = useState<Element>('element_28')
  const [section, setSection] = useState<TailsSection>('rock')

  const diagnostics = useQuery({
    queryKey: ['diagnostics', factory],
    queryFn: () => api.getDiagnostics(factory),
  })
  const board = useQuery({ queryKey: ['board', factory], queryFn: () => api.getBoard(factory) })

  const highlightCellRef = searchParams.get('cell')

  const price =
    board.data?.kpi_contract.prices_usd_per_t[element] ?? DEFAULT_PRICE_USD_PER_T[element]

  const summary = useMemo(() => {
    if (diagnostics.data === undefined) {
      return null
    }
    const d = diagnostics.data
    const total = d.totals[element].tons
    const recoverable = recoverableTons(d, element)
    return { total, recoverable, value: recoverable * price }
  }, [diagnostics.data, element, price])

  if (diagnostics.isPending || board.isPending) {
    return <LoadingState />
  }
  if (diagnostics.isError || board.isError) {
    return <ErrorState onRetry={() => refetchAll([diagnostics, board])} />
  }

  if (summary === null) {
    return <ErrorState onRetry={() => void diagnostics.refetch()} />
  }

  const d = diagnostics.data
  const sections = d.sections
  const activeSection = sections.includes(section) ? section : (sections[0] ?? 'rock')
  const diagRows = d.diagnosis_summary.filter((r) => r.element === element)
  const diagMax = diagRows.reduce((m, r) => Math.max(m, r.tons), 0)

  return (
    <div className={styles.screen}>
      {!hasRun(factory) && (
        <Link to="/setup" className={styles.runBanner}>
          <Play size={15} aria-hidden="true" />
          {t.common.runRequired}
        </Link>
      )}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.diagnosis.totalLost}</span>
          <span className={styles.statValue}>{formatTons(summary.total, t.units)}</span>
        </div>
        <div className={cx(styles.stat, styles.statAccent)}>
          <span className={styles.statLabel}>{t.diagnosis.recoverable}</span>
          <span className={styles.statValue}>{formatTons(summary.recoverable, t.units)}</span>
        </div>
        <div className={cx(styles.stat, styles.statValue2)}>
          <span className={styles.statLabel}>{t.diagnosis.valuePerYear}</span>
          <span className={styles.statValue}>≈ {formatUsdPerYear(summary.value, t.units)}</span>
        </div>
        <div className={styles.elementSwitch} role="group" aria-label={t.diagnosis.elementSwitch}>
          {ELEMENTS.map((el) => (
            <button
              key={el}
              type="button"
              aria-pressed={element === el}
              className={cx(styles.elementButton, element === el && styles.elementButtonActive)}
              onClick={() => setElement(el)}
            >
              {t.elements[el]}
            </button>
          ))}
        </div>
      </div>

      <Panel title={t.diagnosis.heatmapTitle} className={styles.heatmapPanel}>
        <div className={styles.heatmapHead}>
          <span className={styles.hint}>{t.diagnosis.heatmapHint}</span>
          {sections.length > 1 && (
            <div className={styles.sectionSwitch} role="group">
              {sections.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={activeSection === s}
                  className={cx(
                    styles.sectionButton,
                    activeSection === s && styles.sectionButtonActive,
                  )}
                  onClick={() => setSection(s)}
                >
                  {s === 'rock' ? t.diagnosis.sectionRock : t.diagnosis.sectionPyrrhotite}
                </button>
              ))}
            </div>
          )}
        </div>
        <Heatmap
          diagnostics={d}
          element={element}
          section={activeSection}
          highlightCellRef={highlightCellRef}
        />
      </Panel>

      <div className={styles.lower}>
        <Panel title={t.diagnosis.diagnosisBand} className={styles.diagPanel}>
          <ul className={styles.diagList}>
            {DIAGNOSIS_ORDER.map((diag) => {
              const row = diagRows.find((r) => r.diagnosis === diag)
              const tons = row?.tons ?? 0
              const scale = diagMax > 0 ? tons / diagMax : 0
              return (
                <li key={diag} className={styles.diagRow}>
                  <span className={styles.diagName}>{t.diagnoses[diag]}</span>
                  <span className={styles.diagBarTrack}>
                    <span
                      className={cx(
                        styles.diagBarFill,
                        diag === 'not_recoverable' && styles.diagBarInert,
                      )}
                      style={{ transform: `scaleX(${scale})` }}
                    />
                  </span>
                  <span className={styles.diagTons}>{formatTons(tons, t.units)}</span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title={t.diagnosis.dataReadiness} className={styles.dqPanel}>
          <ul className={styles.dqList}>
            {d.data_quality.map((row) => (
              <li key={`${row.issue}-${row.location}`} className={styles.dqRow}>
                <AlertTriangle size={15} aria-hidden="true" className={styles.dqIcon} />
                <div className={styles.dqBody}>
                  <span className={styles.dqIssue}>{t.dataQualityIssues[row.issue]}</span>
                  <span className={styles.dqLocation}>{row.location}</span>
                </div>
                <span className={styles.dqHandling}>
                  {t.dataQualityHandling[row.handling] ?? row.handling}
                  {row.delta_pct !== undefined ? ` · Δ${row.delta_pct}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
