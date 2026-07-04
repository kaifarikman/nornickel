import { describe, expect, it } from 'vitest'
import type { BoardResponse } from '@/contracts.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import { computeTotal, mergeWeights, PACK_WEIGHTS, toScore100 } from '@/lib/score.ts'

const board = boardFixture as unknown as BoardResponse

describe('score', () => {
  it('pack weights sum to one', () => {
    const sum = Object.values(PACK_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('reproduces the fixture top score from pack weights', () => {
    const top = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(top).toBeDefined()
    if (top !== undefined) {
      expect(computeTotal(top.score_breakdown, PACK_WEIGHTS)).toBeCloseTo(top.score_total, 1)
    }
  })

  it('normalizes overridden weights', () => {
    const weights = mergeWeights({ cost: 0.5 })
    const uniform = {
      kpi_impact: 0.5,
      evidence: 0.5,
      plausibility: 0.5,
      cost: 0.5,
      risk: 0.5,
      novelty: 0.5,
    }
    expect(computeTotal(uniform, weights)).toBeCloseTo(0.5, 10)
  })

  it('converts fractions to a 0-100 score', () => {
    expect(toScore100(0.83)).toBe(83)
    expect(toScore100(0)).toBe(0)
    expect(toScore100(1)).toBe(100)
  })
})
