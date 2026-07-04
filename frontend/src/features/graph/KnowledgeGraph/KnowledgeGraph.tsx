import { useQuery } from '@tanstack/react-query'
import { Panel } from '@/components/Panel/Panel.tsx'
import { ForceGraph } from '@/components/ForceGraph/ForceGraph.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { useLocale } from '@/i18n/index.tsx'
import { NODE_KIND_ORDER } from '@/lib/domain.ts'
import { api } from '@/api.ts'
import styles from './KnowledgeGraph.module.css'

export function KnowledgeGraph() {
  const { t } = useLocale()
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })

  if (extract.isPending) {
    return <LoadingState />
  }
  if (extract.isError) {
    return <ErrorState onRetry={() => refetchAll([extract])} />
  }

  const { entities, edges, claims, documents } = extract.data
  const presentKinds = NODE_KIND_ORDER.filter((kind) => entities.some((n) => n.kind === kind))
  const labelById = new Map(entities.map((n) => [n.id, n.label]))

  const stats = [
    { value: entities.length, label: t.graph.nodesLabel },
    { value: edges.length, label: t.graph.edgesLabel },
    { value: claims.length, label: t.graph.claimsLabel },
    { value: documents.length, label: t.graph.sourcesLabel },
  ]

  return (
    <div className={styles.screen}>
      <div className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      <Panel className={styles.graphPanel}>
        <div className={styles.graphHead}>
          <span className={styles.hint}>{t.graph.hint}</span>
          <div className={styles.legend}>
            {presentKinds.map((kind) => (
              <span key={kind} className={styles.legendItem} data-kind={kind}>
                <span className={styles.legendDot} />
                {t.graph.kinds[kind]}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.graphWrap}>
          <ForceGraph
            nodes={entities}
            edges={edges}
            width={900}
            height={560}
            ariaLabel={t.graph.heading}
            animateBuild
            buildStepMs={120}
          />
        </div>
        <ul className="sr-only">
          {edges.map((e) => (
            <li key={e.id}>
              {`${labelById.get(e.src) ?? e.src} → ${labelById.get(e.dst) ?? e.dst} (${e.edge_type}, ${e.polarity})`}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
