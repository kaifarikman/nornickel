import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { api } from '@/api.ts'
import type { RerunAction } from '@/contracts.ts'
import { Panel } from '@/components/Panel/Panel.tsx'
import { ForceGraph } from '@/components/ForceGraph/ForceGraph.tsx'
import { useLocale } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { useFactory } from '@/app/factory.tsx'
import { parseRunParams, useRun } from '@/app/run.tsx'
import { DEFAULT_PRICE_USD_PER_T, FACTORY_REPORT_FILE, MAX_CAPEX_CLASS } from '@/lib/domain.ts'
import styles from './RunView.module.css'

const STAGE_KEYS = ['read', 'diagnose', 'extract', 'graph', 'score', 'done'] as const
type StageKey = (typeof STAGE_KEYS)[number]
const STAGE_MS = 850
const GRAPH_STAGE = STAGE_KEYS.indexOf('graph' as StageKey)

export function RunView() {
  const { t } = useLocale()
  const { factory } = useFactory()
  const { markRun } = useRun()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const params = parseRunParams(location.state)

  const [stage, setStage] = useState(0)
  const [graphProgress, setGraphProgress] = useState({ revealed: 0, total: 0 })
  const finishedRef = useRef(false)
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })

  const handleGraphProgress = useCallback((revealed: number, total: number) => {
    setGraphProgress({ revealed, total })
  }, [])

  const graphComplete = graphProgress.total > 0 && graphProgress.revealed >= graphProgress.total

  useEffect(() => {
    if (stage >= STAGE_KEYS.length - 1) {
      return
    }
    if (stage === STAGE_KEYS.length - 2 && !extract.isSuccess) {
      return
    }
    // Держим прогон на стадии «граф», пока каждый извлечённый узел не будет отрисован.
    if (stage === GRAPH_STAGE && !graphComplete) {
      return
    }
    const timer = setTimeout(() => setStage((s) => s + 1), STAGE_MS)
    return () => clearTimeout(timer)
  }, [stage, extract.isSuccess, graphComplete])

  useEffect(() => {
    if (stage < STAGE_KEYS.length - 1 || finishedRef.current) {
      return
    }
    finishedRef.current = true
    markRun(factory)
    let cancelled = false

    const applyParamsThenGo = async () => {
      try {
        if (params !== null) {
          const actions: RerunAction[] = []
          if (params.price !== DEFAULT_PRICE_USD_PER_T[params.element]) {
            actions.push({
              kind: 'change_price',
              payload: { element: params.element, usd_per_t: params.price },
            })
          }
          if (params.capexLimit < MAX_CAPEX_CLASS) {
            actions.push({
              kind: 'add_constraint',
              payload: { metric: 'capex_class', op: '<=', value: params.capexLimit },
            })
          }
          let board = null
          for (const action of actions) {
            board = await api.rerun(factory, action)
          }
          if (!cancelled && board !== null) {
            queryClient.setQueryData(['board', factory], board)
          }
        }
      } catch (err) {
        console.warn('[run] applying params failed, continuing to diagnosis:', err)
      } finally {
        if (!cancelled) {
          void navigate('/diagnosis')
        }
      }
    }

    const timer = setTimeout(() => void applyParamsThenGo(), 900)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stage])

  const nodes = extract.data?.entities ?? []
  const edges = extract.data?.edges ?? []
  const buildStarted = stage >= STAGE_KEYS.indexOf('graph' as StageKey)

  const detail = useMemo(
    () =>
      t.run.stageDetail({ file: FACTORY_REPORT_FILE[factory], factory: t.factory.names[factory] }),
    [t, factory],
  )

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <h2 className={styles.heading}>{t.run.heading}</h2>
        <span className={styles.detail}>{detail}</span>
      </div>

      <div className={styles.grid}>
        <Panel className={styles.stagesPanel}>
          <ol className={styles.stages}>
            {STAGE_KEYS.map((key, i) => {
              const state = i < stage ? 'done' : i === stage ? 'active' : 'pending'
              return (
                <li key={key} className={cx(styles.stage, styles[state])}>
                  <span className={styles.stageIcon}>
                    {state === 'done' ? (
                      <Check size={15} aria-hidden="true" />
                    ) : state === 'active' ? (
                      <Loader2 size={15} aria-hidden="true" className={styles.spin} />
                    ) : (
                      <span className={styles.dot} />
                    )}
                  </span>
                  <span className={styles.stageLabel}>{t.run.stages[key]}</span>
                </li>
              )
            })}
          </ol>
          {stage >= STAGE_KEYS.length - 1 && (
            <span className={styles.finishing}>{t.run.finishing}</span>
          )}
        </Panel>

        <Panel className={styles.graphPanel}>
          <figure className={styles.graphFigure}>
            <ForceGraph
              nodes={nodes}
              edges={edges}
              width={560}
              height={400}
              ariaLabel={t.run.graphCaption}
              animateBuild={buildStarted}
              buildStepMs={140}
              onRevealProgress={handleGraphProgress}
            />
            <figcaption className={styles.graphCaption}>
              {buildStarted && !graphComplete && graphProgress.total > 0
                ? t.run.graphProgress({
                    revealed: graphProgress.revealed,
                    total: graphProgress.total,
                  })
                : t.run.graphCaption}
            </figcaption>
          </figure>
        </Panel>
      </div>
    </div>
  )
}
