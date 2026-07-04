import type { GraphNode, Hypothesis } from '@/contracts.ts'

function capexFromTitle(title: string): number {
  const t = title.toLowerCase()
  if (t.includes('магнит') || t.includes('новое оборуд')) {
    return 3
  }
  if (t.includes('футеровк') || t.includes('замен')) {
    return 2
  }
  return 1
}

export function capexClassOf(h: Hypothesis, entities?: GraphNode[]): number {
  if (entities !== undefined) {
    const byId = new Map(entities.map((n) => [n.id, n]))
    let maxClass = 0
    for (const nodeId of h.source_nodes) {
      const node = byId.get(nodeId)
      const raw = node?.properties['capex_class']
      if (typeof raw === 'number') {
        maxClass = Math.max(maxClass, raw)
      }
    }
    if (maxClass > 0) {
      return maxClass
    }
  }
  return capexFromTitle(h.title)
}
