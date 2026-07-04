import type {
  BoardResponse,
  Element,
  ExtractResponse,
  Hypothesis,
  HypothesisStatus,
  KpiConstraint,
  RerunAction,
} from '@/contracts.ts'
import { computeTotal, mergeWeights } from './score.ts'
import { capexClassOf } from './capex.ts'

function valueMid(hyp: Hypothesis): number {
  const [lo, hi] = hyp.economic_effect.value_usd_range
  return (lo + hi) / 2
}

function repriceEconomics(hyp: Hypothesis, element: Element, usdPerT: number): Hypothesis {
  const tons = hyp.economic_effect.addressable_tons[element]
  if (tons === undefined) {
    return hyp
  }
  const [gainLo, gainHi] = hyp.economic_effect.recovery_gain_pct_range
  const value_usd_range: [number, number] = [
    Math.round((tons * gainLo * usdPerT) / 100),
    Math.round((tons * gainHi * usdPerT) / 100),
  ]
  const assumptions = hyp.economic_effect.assumptions.map((a) =>
    a.startsWith(`price ${element}`)
      ? `price ${element} = ${usdPerT} $/t (параметр KpiContract)`
      : a,
  )
  return {
    ...hyp,
    economic_effect: { ...hyp.economic_effect, value_usd_range, assumptions },
  }
}

function violatesConstraints(
  hyp: Hypothesis,
  constraints: KpiConstraint[],
  extract: ExtractResponse,
): boolean {
  for (const c of constraints) {
    if (c.metric === 'capex_class' && c.op === '<=') {
      if (capexClassOf(hyp, extract.entities) > c.value) {
        return true
      }
    }
  }
  return false
}

function hasDataGapInTrace(hyp: Hypothesis, extract: ExtractResponse): boolean {
  const claimById = new Map(extract.claims.map((c) => [c.id, c]))
  return hyp.trace.some((id) => claimById.get(id)?.evidence_type === 'data_gap')
}

function computeStatus(
  hyp: Hypothesis,
  extract: ExtractResponse,
  constraints: KpiConstraint[],
  excludedFactors: string[],
  scoreTotal: number,
): HypothesisStatus {
  if (excludedFactors.some((f) => hyp.source_nodes.includes(f))) {
    return 'rejected_by_constraints'
  }
  if (violatesConstraints(hyp, constraints, extract)) {
    return 'rejected_by_constraints'
  }
  if (hyp.status === 'needs_expert_review' || hasDataGapInTrace(hyp, extract)) {
    return 'needs_expert_review'
  }
  if (scoreTotal >= 0.75) {
    return 'recommended'
  }
  return 'watch'
}

export function applyRerun(
  board: BoardResponse,
  extract: ExtractResponse,
  action: RerunAction,
): BoardResponse {
  const contract = structuredClone(board.kpi_contract)
  const weightsOverride = { ...(contract.weights_override ?? {}) }
  const excluded = [...(contract.excluded_factors ?? [])]
  let constraints = contract.constraints.map((c) => ({ ...c }))
  const prices = { ...contract.prices_usd_per_t }

  if (action.kind === 'exclude_factor' && action.payload.factor_id !== undefined) {
    if (!excluded.includes(action.payload.factor_id)) {
      excluded.push(action.payload.factor_id)
    }
  }
  if (action.kind === 'change_weight' && action.payload.dimension !== undefined) {
    weightsOverride[action.payload.dimension] = action.payload.value ?? 0
  }
  if (
    (action.kind === 'add_constraint' || action.kind === 'relax_constraint') &&
    action.payload.metric !== undefined
  ) {
    const metric = action.payload.metric
    const existing = constraints.find((c) => c.metric === metric)
    if (existing !== undefined) {
      existing.value = action.payload.value ?? existing.value
      existing.op = action.payload.op ?? existing.op
    } else {
      constraints = [
        ...constraints,
        {
          metric,
          op: action.payload.op ?? '<=',
          value: action.payload.value ?? 0,
          unit: 'class',
        },
      ]
    }
  }
  if (
    action.kind === 'change_price' &&
    action.payload.element !== undefined &&
    action.payload.usd_per_t !== undefined
  ) {
    prices[action.payload.element] = action.payload.usd_per_t
  }

  const priceAction =
    action.kind === 'change_price' &&
    action.payload.element !== undefined &&
    action.payload.usd_per_t !== undefined
      ? { element: action.payload.element, usdPerT: action.payload.usd_per_t }
      : null

  const repriced = board.hypotheses.map((h) =>
    priceAction !== null ? repriceEconomics(h, priceAction.element, priceAction.usdPerT) : h,
  )

  const maxValueMid = repriced.reduce((max, h) => Math.max(max, valueMid(h)), 0)
  const weights = mergeWeights(weightsOverride)

  const rescored = repriced.map((h) => {
    const kpiImpact =
      priceAction !== null && maxValueMid > 0
        ? Number((valueMid(h) / maxValueMid).toFixed(2))
        : h.score_breakdown.kpi_impact
    const breakdown = { ...h.score_breakdown, kpi_impact: kpiImpact }
    const scoreTotal = Number(computeTotal(breakdown, weights).toFixed(2))
    return {
      ...structuredClone(h),
      score_breakdown: breakdown,
      score_total: scoreTotal,
      status: computeStatus(h, extract, constraints, excluded, scoreTotal),
    }
  })

  rescored.sort((a, b) => b.score_total - a.score_total)
  const ranked = rescored.map((h, index) => ({ ...h, rank: index + 1 }))

  return {
    snapshot: board.snapshot,
    kpi_contract: {
      ...contract,
      constraints,
      weights_override: weightsOverride,
      excluded_factors: excluded,
      prices_usd_per_t: prices,
    },
    diagnostics: board.diagnostics,
    hypotheses: ranked,
  }
}
