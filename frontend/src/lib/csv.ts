import type { GraphNode, Hypothesis } from '@/contracts.ts'
import { byRank } from './domain.ts'
import { capexClassOf } from './capex.ts'

export const CSV_COLUMNS = [
  'rank',
  'id',
  'title',
  'status',
  'value_usd_lo',
  'value_usd_hi',
  'addressable_tons',
  'capex_class',
  'score_total',
  'expert_match',
]

function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

export function buildCsv(
  columns: string[],
  hypotheses: Hypothesis[],
  entities: GraphNode[],
): string {
  const header = columns.join(',')
  const rows = byRank(hypotheses).map((h) => {
    const [lo, hi] = h.economic_effect.value_usd_range
    const cells = [
      String(h.rank),
      csvCell(h.id),
      csvCell(h.title),
      csvCell(h.status),
      String(lo),
      String(hi),
      String(h.economic_effect.addressable_tons.element_28 ?? 0),
      String(capexClassOf(h, entities)),
      String(h.score_total),
      csvCell(h.expert_match?.expert_hypothesis_id ?? ''),
    ]
    return cells.join(',')
  })
  return [header, ...rows].join('\n')
}
