import type {
  Claim,
  DiagnosticsReport,
  DocumentRef,
  ExtractResponse,
  GraphEdge,
  GraphNode,
  Hypothesis,
  LossCell,
} from '@/contracts.ts'

export type TraceStep =
  | { kind: 'claim'; id: string; claim: Claim; document: DocumentRef | null }
  | { kind: 'diagnosis'; id: string; lossCell: LossCell | null; cellRef: string }

function resolveDiagId(
  diagId: string,
  diagnostics: DiagnosticsReport,
): { lossCell: LossCell | null; cellRef: string } {
  const ref = (diagnostics.diag_refs ?? []).find((r) => r.id === diagId)
  if (ref !== undefined) {
    const cell =
      diagnostics.loss_cells.find(
        (c) =>
          c.size_class === ref.size_class &&
          c.mineral_form === ref.mineral_form &&
          c.diagnosis === ref.diagnosis,
      ) ?? null
    return { lossCell: cell, cellRef: ref.cell_ref }
  }
  return { lossCell: null, cellRef: diagId }
}

export function resolveTrace(
  hypothesis: Hypothesis,
  extract: ExtractResponse,
  diagnostics: DiagnosticsReport,
): TraceStep[] {
  const claimById = new Map(extract.claims.map((c) => [c.id, c]))
  const docById = new Map(extract.documents.map((d) => [d.id, d]))
  const steps: TraceStep[] = []
  for (const id of hypothesis.trace) {
    if (id.startsWith('diag_')) {
      const { lossCell, cellRef } = resolveDiagId(id, diagnostics)
      steps.push({ kind: 'diagnosis', id, lossCell, cellRef })
      continue
    }
    const claim = claimById.get(id)
    if (claim !== undefined) {
      steps.push({ kind: 'claim', id, claim, document: docById.get(claim.source_ref) ?? null })
    }
  }
  return steps
}

export interface EvidenceSubgraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function buildEvidenceSubgraph(
  hypothesis: Hypothesis,
  extract: ExtractResponse,
): EvidenceSubgraph {
  const nodeIds = new Set(hypothesis.source_nodes)
  const nodes = extract.entities.filter((n) => nodeIds.has(n.id))
  const edges = extract.edges.filter((e) => nodeIds.has(e.src) && nodeIds.has(e.dst))
  return { nodes, edges }
}
