export type Element = 'element_28' | 'element_29'

export type KnownFactoryId = 'kgmk' | 'nof_vkr' | 'nof_med' | 'tof'

export type FactoryId = string

export type TailsSection = 'rock' | 'pyrrhotite'

export type MineralForm =
  | 'open_pnt_cp'
  | 'closed_pnt_cp'
  | 'pyrrhotite_impurity'
  | 'silicate_valleriite'
  | 'pyrite_other_sulfides'
  | 'millerite'

export type Diagnosis =
  'liberation_deficit' | 'slimes_overgrinding' | 'flotation_kinetics' | 'not_recoverable'

export type DataQualityIssue =
  'ref_error' | 'merged_cell' | 'empty_slot' | 'checksum_mismatch' | 'parse_warning'

export interface ElementTotal {
  pct: number
  tons: number
}

export interface DiagnosticsTotals {
  tails_smt: number
  element_28: ElementTotal
  element_29: ElementTotal
}

export interface LossCell {
  section: TailsSection
  size_class: string
  mineral_form: MineralForm
  element: Element
  tons: number
  share_of_class_pct: number
  recoverable: boolean
  diagnosis: Diagnosis
  cell_ref: string
}

export interface DiagnosisSummaryRow {
  diagnosis: Diagnosis
  element: Element
  tons: number
}

export interface DataQualityRow {
  issue: DataQualityIssue
  location: string
  handling: string
  delta_pct?: number
}

export interface DiagRef {
  id: string
  cell_ref: string
  size_class: string
  mineral_form: MineralForm
  diagnosis: Diagnosis
}

export interface DiagnosticsReport {
  factory_id: FactoryId
  pack_id: string
  source_file: string
  sections: TailsSection[]
  totals: DiagnosticsTotals
  loss_cells: LossCell[]
  diagnosis_summary: DiagnosisSummaryRow[]
  data_quality: DataQualityRow[]
  diag_refs?: DiagRef[]
}

export type MetricDirection = 'increase' | 'decrease'

export type ConstraintOp = '<=' | '>='

export interface KpiTarget {
  metric: string
  direction: MetricDirection
  minimum_delta_percent: number
}

export interface KpiConstraint {
  metric: string
  op: ConstraintOp
  value: number
  unit: string
}

export interface KpiContract {
  factory_id: FactoryId
  target: KpiTarget
  constraints: KpiConstraint[]
  prices_usd_per_t: Record<Element, number>
  weights_override?: Partial<Record<ScoreDimension, number>>
  excluded_factors?: string[]
}

export type EvidenceType = 'literature' | 'experiment' | 'expert_note' | 'data_gap' | 'inferred'

export interface Claim {
  id: string
  text: string
  source_ref: string
  source_page: number | null
  confidence: number
  evidence_type: EvidenceType
}

export interface DocumentRef {
  id: string
  title: string
  path: string
  source_url: string | null
}

export type NodeKind = 'factor' | 'mechanism' | 'property' | 'kpi'

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  tags: string[]
  properties: Record<string, string | number>
}

export type EdgeType = 'mechanism' | 'tradeoff' | 'substitution' | 'proxy'

export type EdgePolarity = 'positive' | 'negative' | 'nonlinear'

export interface GraphEdge {
  id: string
  src: string
  dst: string
  edge_type: EdgeType
  mechanism: string
  source_claims: string[]
  polarity: EdgePolarity
}

export interface ExtractResponse {
  pack_id: string
  documents: DocumentRef[]
  claims: Claim[]
  entities: GraphNode[]
  edges: GraphEdge[]
}

export interface ScoreBreakdown {
  kpi_impact: number
  evidence: number
  plausibility: number
  cost: number
  risk: number
  novelty: number
}

export type ScoreDimension = keyof ScoreBreakdown

export interface EconomicEffect {
  addressable_tons: Partial<Record<Element, number>>
  recovery_gain_pct_range: [number, number]
  value_usd_range: [number, number]
  assumptions: string[]
}

export interface DoePlan {
  objective: string
  factors: string[]
  measurements: string[]
  minimum_runs: number
}

export type HypothesisStatus =
  'recommended' | 'watch' | 'rejected_by_constraints' | 'needs_expert_review'

export interface ExpertMatch {
  matched: boolean
  expert_hypothesis_id: string
}

export interface Hypothesis {
  id: string
  title: string
  summary: string
  status: HypothesisStatus
  rank: number
  score_total: number
  score_breakdown: ScoreBreakdown
  economic_effect: EconomicEffect
  trace: string[]
  source_nodes: string[]
  risks: string[]
  missing_evidence: string[]
  doe_plan: DoePlan
  expert_match: ExpertMatch | null
}

export interface Snapshot {
  id: string
  hash: string
  pack_id: string
}

export interface BoardResponse {
  snapshot: Snapshot
  kpi_contract: KpiContract
  diagnostics: DiagnosticsReport
  hypotheses: Hypothesis[]
}

export type LeverType =
  'grinding' | 'classification' | 'flotation' | 'reagents' | 'new_equipment' | 'automation'

export interface ExpertHypothesis {
  id: string
  factory_id: FactoryId
  text: string
  lever_type: LeverType
  diagnosis_hint: Diagnosis
}

export type RerunActionKind =
  'exclude_factor' | 'change_weight' | 'add_constraint' | 'relax_constraint' | 'change_price'

export interface RerunPayload {
  factor_id?: string
  metric?: string
  op?: ConstraintOp
  value?: number
  dimension?: ScoreDimension
  element?: Element
  usd_per_t?: number
}

export interface RerunAction {
  kind: RerunActionKind
  payload: RerunPayload
}

export interface ParseConstraintsResponse {
  actions: RerunAction[]
  kpi_contract_patch?: Record<string, unknown>
  unparsed: string[]
}

export interface SkepticResponse {
  objection: string
  missing_evidence: string[]
  risks: string[]
  suggested_checks: string[]
}

export interface NarrateResponse {
  text: string
}

export interface NoveltySimilar {
  doc: string
  page: number | null
  score: number
  text: string
}

export interface NoveltyResponse {
  novelty_score: number
  similar: NoveltySimilar[]
}
