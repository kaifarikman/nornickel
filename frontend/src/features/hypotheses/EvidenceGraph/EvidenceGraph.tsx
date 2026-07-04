import type { ExtractResponse, Hypothesis } from '@/contracts.ts'
import { ForceGraph } from '@/components/ForceGraph/ForceGraph.tsx'
import { useT } from '@/i18n/index.tsx'
import { NODE_KIND_ORDER } from '@/lib/domain.ts'
import { buildEvidenceSubgraph } from '@/lib/trace.ts'
import styles from './EvidenceGraph.module.css'

export function EvidenceGraph({
  hypothesis,
  extract,
}: {
  hypothesis: Hypothesis
  extract: ExtractResponse
}) {
  const t = useT()
  const { nodes, edges } = buildEvidenceSubgraph(hypothesis, extract)
  const presentKinds = NODE_KIND_ORDER.filter((kind) => nodes.some((n) => n.kind === kind))

  return (
    <figure className={styles.figure}>
      <ForceGraph
        nodes={nodes}
        edges={edges}
        width={520}
        height={340}
        ariaLabel={`${t.detail.evidenceGraphTitle}: ${hypothesis.title}`}
      />
      <figcaption className={styles.legend}>
        {presentKinds.map((kind) => (
          <span key={kind} className={styles.legendItem} data-kind={kind}>
            <span className={styles.legendDot} />
            {t.graph.kinds[kind]}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
