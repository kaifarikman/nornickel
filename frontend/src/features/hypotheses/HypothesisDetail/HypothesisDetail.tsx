import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api.ts'
import { Panel } from '@/components/Panel/Panel.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge.tsx'
import { useFactory } from '@/app/factory.tsx'
import { useT } from '@/i18n/index.tsx'
import { targetElement } from '@/lib/domain.ts'
import { formatHypId, formatPctRange, formatTons, formatUsdRange } from '@/lib/format.ts'
import { formatFraction, SCORE_DIMENSIONS, toScore100 } from '@/lib/score.ts'
import { resolveTrace } from '@/lib/trace.ts'
import { safeHref } from '@/lib/url.ts'
import { EvidenceGraph } from '@/features/hypotheses/EvidenceGraph/EvidenceGraph.tsx'
import styles from './HypothesisDetail.module.css'

export function HypothesisDetail() {
  const t = useT()
  const { factory } = useFactory()
  const { id } = useParams()
  const board = useQuery({ queryKey: ['board', factory], queryFn: () => api.getBoard(factory) })
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })
  const hypothesisQuery = useQuery({
    queryKey: ['hypothesis', factory, id],
    queryFn: () => api.getHypothesis(factory, id ?? ''),
  })

  if (board.isPending || extract.isPending || hypothesisQuery.isPending) {
    return <LoadingState />
  }
  if (board.isError || extract.isError || hypothesisQuery.isError) {
    return <ErrorState onRetry={() => refetchAll([board, extract, hypothesisQuery])} />
  }

  const hypothesis = hypothesisQuery.data

  if (board.data === null || hypothesis === null) {
    return (
      <div className={styles.notFound}>
        {t.detail.notFound}
        <Link to="/hypotheses">{t.detail.backToBoard}</Link>
      </div>
    )
  }

  const traceSteps = resolveTrace(hypothesis, extract.data, board.data.diagnostics)
  const economic = hypothesis.economic_effect
  const doe = hypothesis.doe_plan
  const element = targetElement(board.data.kpi_contract)
  const addressableTons = economic.addressable_tons[element] ?? 0
  // source_nodes идёт source-first .. kpi-last (см. Candidate в engine) — целевой
  // узел несёт человекочитаемый label; raw target.metric — техническое id для
  // сопоставления в движке, не для показа пользователю.
  const kpiNodeId = hypothesis.source_nodes.at(-1)
  const targetKpiLabel =
    extract.data.entities.find((n) => n.id === kpiNodeId)?.label ??
    board.data.kpi_contract.target.metric

  return (
    <div className={styles.screen}>
      <Link to="/hypotheses" className={styles.back}>
        {t.detail.backToBoard}
      </Link>

      <div className={styles.titleRow}>
        <h2 className={styles.heading}>
          <span className={styles.hypId}>{formatHypId(hypothesis.id)}</span>
          <span className={styles.title}>{hypothesis.title}</span>
        </h2>
        <div className={styles.titleMeta}>
          <StatusBadge status={hypothesis.status} />
          <span className={styles.total}>
            {t.common.score} {toScore100(hypothesis.score_total)}
          </span>
        </div>
      </div>

      <Panel tone="accent" className={styles.summary}>
        <p>{hypothesis.summary}</p>
      </Panel>

      <div className={styles.metrics}>
        {SCORE_DIMENSIONS.map((dim, index) => {
          const value = hypothesis.score_breakdown[dim]
          return (
            <div key={dim} className={styles.metric} style={{ '--i': index } as CSSProperties}>
              <span className={styles.metricLabel}>{t.detail.metrics[dim]}</span>
              <span className={styles.metricValue}>{formatFraction(value)}</span>
              <span className={styles.metricBar}>
                <span className={styles.metricFill} style={{ transform: `scaleX(${value})` }} />
              </span>
            </div>
          )
        })}
      </div>

      <Panel title={t.detail.traceTitle} className={styles.trace}>
        <ol className={styles.traceList}>
          <li className={styles.traceStep}>
            <span className={styles.traceRole}>{t.detail.traceTargetKpi}</span>
            <span className={styles.traceText}>{targetKpiLabel}</span>
          </li>
          {traceSteps.map((step) => {
            if (step.kind === 'claim') {
              const doc = step.document
              const docHref = safeHref(doc?.source_url ?? null)
              const page = step.claim.source_page
              return (
                <li key={step.id} className={styles.traceStep}>
                  <blockquote className={styles.traceQuote}>{step.claim.text}</blockquote>
                  <span className={styles.traceMeta}>
                    <span className={styles.evidenceType}>{step.claim.evidence_type}</span>
                    <span className={styles.mono}>
                      {t.common.confidence} {formatFraction(step.claim.confidence)}
                    </span>
                    {doc !== null && (
                      <span className={styles.traceSource}>
                        {docHref !== null ? (
                          <>
                            <a href={docHref} target="_blank" rel="noreferrer">
                              {doc.title}
                            </a>
                            {page !== null ? ` ${t.common.page(page)}` : ''}
                          </>
                        ) : (
                          `${doc.title} (${t.common.internalDocument})${
                            page !== null ? ` ${t.common.page(page)}` : ''
                          }`
                        )}
                      </span>
                    )}
                  </span>
                </li>
              )
            }
            return (
              <li key={step.id} className={styles.traceStep}>
                <Link
                  to={`/diagnosis?cell=${encodeURIComponent(step.cellRef)}`}
                  className={styles.cellRef}
                >
                  {t.detail.traceCellRef(step.cellRef)}
                </Link>
                {step.lossCell !== null && (
                  <span className={styles.cellDetail}>
                    {`${t.mineralForms[step.lossCell.mineral_form]} · ${step.lossCell.size_class} · ${formatTons(step.lossCell.tons, t.units)}`}
                  </span>
                )}
              </li>
            )
          })}
          <li className={styles.traceStep}>
            <span className={styles.traceRole}>{t.detail.traceHypothesis}</span>
            <span className={styles.traceText}>{hypothesis.title}</span>
          </li>
        </ol>
      </Panel>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Panel title={t.detail.economicTitle} className={styles.economic}>
            <div className={styles.economicValue}>
              {formatUsdRange(economic.value_usd_range, t.units)}
            </div>
            <dl className={styles.economicStats}>
              <div className={styles.economicStat}>
                <dt>{t.detail.addressableTons}</dt>
                <dd className={styles.mono}>{formatTons(addressableTons, t.units)}</dd>
              </div>
              <div className={styles.economicStat}>
                <dt>{t.detail.recoveryGain}</dt>
                <dd className={styles.mono}>{formatPctRange(economic.recovery_gain_pct_range)}</dd>
              </div>
            </dl>
            <div className={styles.assumptions}>
              <h3 className={styles.assumptionsTitle}>{t.detail.assumptionsTitle}</h3>
              <ul className={styles.list}>
                {economic.assumptions.map((item) => (
                  <li key={item} className={styles.assumption}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title={t.detail.doeTitle} className={styles.doe}>
            <p className={styles.doeObjective}>
              <span className={styles.doeLabel}>{t.detail.doeObjective}</span>
              {doe.objective}
            </p>
            <div className={styles.doeGrid}>
              <div>
                <h3 className={styles.doeSubtitle}>{t.detail.doeFactors}</h3>
                <ul className={styles.list}>
                  {doe.factors.map((factor) => (
                    <li key={factor} className={styles.doeItem}>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.doeSubtitle}>{t.detail.doeMeasurements}</h3>
                <ul className={styles.list}>
                  {doe.measurements.map((measurement) => (
                    <li key={measurement} className={styles.doeItem}>
                      {measurement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <span className={styles.doeRuns}>{t.detail.doeRuns(doe.minimum_runs)}</span>
          </Panel>
        </div>

        <div className={styles.side}>
          <Panel title={t.detail.evidenceGraphTitle}>
            <EvidenceGraph hypothesis={hypothesis} extract={extract.data} />
          </Panel>
          <Panel title={t.detail.risksTitle}>
            <ul className={styles.list}>
              {hypothesis.risks.map((risk) => (
                <li key={risk} className={styles.risk}>
                  {risk}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t.detail.missingEvidenceTitle}>
            <ul className={styles.list}>
              {hypothesis.missing_evidence.map((item) => (
                <li key={item} className={styles.missing}>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
