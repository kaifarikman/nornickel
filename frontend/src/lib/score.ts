import type { ScoreBreakdown, ScoreDimension } from '@/contracts.ts'

export const PACK_WEIGHTS: ScoreBreakdown = {
  kpi_impact: 0.35,
  evidence: 0.2,
  plausibility: 0.15,
  cost: 0.15,
  risk: 0.1,
  novelty: 0.05,
}

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  'kpi_impact',
  'evidence',
  'plausibility',
  'cost',
  'risk',
  'novelty',
]

export function mergeWeights(
  override: Partial<Record<ScoreDimension, number>> | undefined,
): ScoreBreakdown {
  const merged: ScoreBreakdown = { ...PACK_WEIGHTS }
  if (override !== undefined) {
    for (const dim of SCORE_DIMENSIONS) {
      const value = override[dim]
      if (value !== undefined) {
        merged[dim] = value
      }
    }
  }
  return merged
}

export function computeTotal(breakdown: ScoreBreakdown, weights: ScoreBreakdown): number {
  let weightSum = 0
  let total = 0
  for (const dim of SCORE_DIMENSIONS) {
    weightSum += weights[dim]
    total += breakdown[dim] * weights[dim]
  }
  if (weightSum === 0) {
    return 0
  }
  return total / weightSum
}

export function toScore100(value: number): number {
  return Math.round(value * 100)
}

export function formatFraction(value: number): string {
  return value.toFixed(2)
}
