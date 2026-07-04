import { describe, expect, it } from 'vitest'
import type { GraphNode, Hypothesis } from '@/contracts.ts'
import { capexClassOf } from '@/lib/capex.ts'

function makeHypothesis(overrides: Partial<Hypothesis>): Hypothesis {
  return {
    id: 'hyp_x',
    title: '',
    summary: '',
    status: 'watch',
    rank: 1,
    score_total: 0,
    score_breakdown: {
      kpi_impact: 0,
      evidence: 0,
      plausibility: 0,
      cost: 0,
      risk: 0,
      novelty: 0,
    },
    economic_effect: {
      addressable_tons: {},
      recovery_gain_pct_range: [0, 0],
      value_usd_range: [0, 0],
      assumptions: [],
    },
    trace: [],
    source_nodes: [],
    risks: [],
    missing_evidence: [],
    doe_plan: {
      objective: '',
      factors: [],
      measurements: [],
      minimum_runs: 1,
    },
    expert_match: null,
    ...overrides,
  }
}

function makeNode(id: string, properties: Record<string, string | number>): GraphNode {
  return {
    id,
    kind: 'factor',
    label: id,
    tags: [],
    properties,
  }
}

describe('capexClassOf', () => {
  it('takes the max capex_class from graph nodes', () => {
    const h = makeHypothesis({ source_nodes: ['n1', 'n2'] })
    const entities: GraphNode[] = [
      makeNode('n1', { capex_class: 1 }),
      makeNode('n2', { capex_class: 3 }),
    ]
    expect(capexClassOf(h, entities)).toBe(3)
  })

  it('falls back to title heuristic when entities are undefined', () => {
    expect(capexClassOf(makeHypothesis({ title: 'Магнитная сепарация' }))).toBe(3)
    expect(capexClassOf(makeHypothesis({ title: 'Заменить футеровку' }))).toBe(2)
    expect(capexClassOf(makeHypothesis({ title: 'Настроить время агитации' }))).toBe(1)
  })

  it('falls back to title when nodes carry no capex_class', () => {
    const h = makeHypothesis({ source_nodes: ['n1'], title: 'Магнитная сепарация' })
    const entities: GraphNode[] = [makeNode('n1', { some_other: 5 })]
    expect(capexClassOf(h, entities)).toBe(3)
  })

  it('falls back to title when source_nodes is empty even with entities given', () => {
    const h = makeHypothesis({ source_nodes: [], title: 'Заменить футеровку' })
    const entities: GraphNode[] = [makeNode('n1', { capex_class: 3 })]
    expect(capexClassOf(h, entities)).toBe(2)
  })
})
