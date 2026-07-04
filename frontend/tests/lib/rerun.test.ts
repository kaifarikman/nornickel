import { describe, expect, it } from 'vitest'
import type { BoardResponse, ExtractResponse } from '@/contracts.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import { applyRerun } from '@/lib/rerun.ts'

const board = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse

function byId(next: BoardResponse, id: string) {
  return next.hypotheses.find((h) => h.id === id)
}

describe('applyRerun', () => {
  it('keeps the snapshot hash stable across rerun', () => {
    const next = applyRerun(board, extract, {
      kind: 'change_weight',
      payload: { dimension: 'cost', value: 0.15 },
    })
    expect(next.snapshot.hash).toBe(board.snapshot.hash)
  })

  it('reassigns contiguous ranks sorted by score', () => {
    const next = applyRerun(board, extract, {
      kind: 'change_weight',
      payload: { dimension: 'novelty', value: 0.4 },
    })
    const ranks = next.hypotheses.map((h) => h.rank).sort((a, b) => a - b)
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6])
    const sorted = next.hypotheses.slice().sort((a, b) => a.rank - b.rank)
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]
      const current = sorted[i]
      if (prev !== undefined && current !== undefined) {
        expect(prev.score_total).toBeGreaterThanOrEqual(current.score_total)
      }
    }
  })

  it('change_price rescales value_usd_range by the new price', () => {
    const before = byId(board, 'hyp_001')
    const next = applyRerun(board, extract, {
      kind: 'change_price',
      payload: { element: 'element_28', usd_per_t: 33000 },
    })
    const after = byId(next, 'hyp_001')
    expect(before).toBeDefined()
    expect(after).toBeDefined()
    if (before !== undefined && after !== undefined) {
      const tons = after.economic_effect.addressable_tons.element_28 ?? 0
      const [gainLo, gainHi] = after.economic_effect.recovery_gain_pct_range
      expect(after.economic_effect.value_usd_range[0]).toBeCloseTo((tons * gainLo * 33000) / 100, 0)
      expect(after.economic_effect.value_usd_range[1]).toBeCloseTo((tons * gainHi * 33000) / 100, 0)
      expect(next.kpi_contract.prices_usd_per_t.element_28).toBe(33000)
    }
  })

  it('excluding a source node rejects the hypothesis that uses it', () => {
    const next = applyRerun(board, extract, {
      kind: 'exclude_factor',
      payload: { factor_id: 'node_hydrocyclone_nozzle' },
    })
    expect(byId(next, 'hyp_001')?.status).toBe('rejected_by_constraints')
    expect(next.kpi_contract.excluded_factors).toContain('node_hydrocyclone_nozzle')
  })

  it('preserves the needs_expert_review status of the uncovered hypothesis', () => {
    const uncovered: BoardResponse = structuredClone(board)
    const hyp = uncovered.hypotheses.find((h) => h.id === 'hyp_006')
    expect(hyp).toBeDefined()
    if (hyp !== undefined) {
      hyp.status = 'needs_expert_review'
    }
    const next = applyRerun(uncovered, extract, {
      kind: 'change_weight',
      payload: { dimension: 'cost', value: 0.2 },
    })
    expect(byId(next, 'hyp_006')?.status).toBe('needs_expert_review')
  })

  it('rejects the high-capex hypothesis when capex_class <= 2 is required', () => {
    const next = applyRerun(board, extract, {
      kind: 'add_constraint',
      payload: { metric: 'capex_class', op: '<=', value: 2 },
    })
    expect(byId(next, 'hyp_005')?.status).toBe('rejected_by_constraints')
  })

  it('unrejects the hypothesis when the capex constraint is relaxed back to <= 3', () => {
    const constrained = applyRerun(board, extract, {
      kind: 'add_constraint',
      payload: { metric: 'capex_class', op: '<=', value: 2 },
    })
    expect(byId(constrained, 'hyp_005')?.status).toBe('rejected_by_constraints')

    const relaxed = applyRerun(constrained, extract, {
      kind: 'relax_constraint',
      payload: { metric: 'capex_class', op: '<=', value: 3 },
    })
    expect(relaxed.kpi_contract.constraints.find((c) => c.metric === 'capex_class')?.value).toBe(3)
    expect(byId(relaxed, 'hyp_005')?.status).not.toBe('rejected_by_constraints')
  })

  it('crosses the 0.75 recommended threshold as the score weight moves', () => {
    const below = applyRerun(board, extract, {
      kind: 'change_weight',
      payload: { dimension: 'cost', value: 0.15 },
    })
    const belowHyp = byId(below, 'hyp_003')
    expect(belowHyp).toBeDefined()
    expect(belowHyp?.score_total).toBeLessThan(0.75)
    expect(belowHyp?.status).toBe('watch')

    const above = applyRerun(board, extract, {
      kind: 'change_weight',
      payload: { dimension: 'cost', value: 0.8 },
    })
    const aboveHyp = byId(above, 'hyp_003')
    expect(aboveHyp).toBeDefined()
    expect(aboveHyp?.score_total).toBeGreaterThanOrEqual(0.75)
    expect(aboveHyp?.status).toBe('recommended')
  })
})
