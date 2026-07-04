import type {
  BoardResponse,
  DiagnosticsReport,
  ExpertHypothesis,
  ExtractResponse,
  Hypothesis,
} from '@/contracts.ts'
import type { LibraryMock } from '@/mocks/library.ts'

export class ContractError extends Error {
  constructor(what: string) {
    super(`contract validation failed: ${what}`)
    this.name = 'ContractError'
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function hasArray(o: Record<string, unknown>, key: string): boolean {
  return Array.isArray(o[key])
}

export function assertBoard(v: unknown): BoardResponse {
  if (
    !isObject(v) ||
    !isObject(v['snapshot']) ||
    !isObject(v['kpi_contract']) ||
    !isObject(v['diagnostics']) ||
    !hasArray(v, 'hypotheses')
  ) {
    throw new ContractError('BoardResponse')
  }
  return v as unknown as BoardResponse
}

export function assertDiagnostics(v: unknown): DiagnosticsReport {
  if (
    !isObject(v) ||
    typeof v['factory_id'] !== 'string' ||
    !isObject(v['totals']) ||
    !hasArray(v, 'loss_cells') ||
    !hasArray(v, 'diagnosis_summary')
  ) {
    throw new ContractError('DiagnosticsReport')
  }
  return v as unknown as DiagnosticsReport
}

export function assertHypothesis(v: unknown): Hypothesis {
  if (
    !isObject(v) ||
    typeof v['id'] !== 'string' ||
    typeof v['title'] !== 'string' ||
    !isObject(v['score_breakdown']) ||
    !isObject(v['economic_effect']) ||
    !hasArray(v, 'trace')
  ) {
    throw new ContractError('Hypothesis')
  }
  return v as unknown as Hypothesis
}

export function assertExtract(v: unknown): ExtractResponse {
  if (
    !isObject(v) ||
    !hasArray(v, 'documents') ||
    !hasArray(v, 'claims') ||
    !hasArray(v, 'entities') ||
    !hasArray(v, 'edges')
  ) {
    throw new ContractError('ExtractResponse')
  }
  return v as unknown as ExtractResponse
}

export function assertExpertHypotheses(v: unknown): ExpertHypothesis[] {
  if (!Array.isArray(v) || !v.every((e) => isObject(e) && typeof e['id'] === 'string')) {
    throw new ContractError('ExpertHypothesis[]')
  }
  return v as unknown as ExpertHypothesis[]
}

export function assertLibrary(v: unknown): LibraryMock {
  if (!isObject(v)) {
    throw new ContractError('LibraryMock')
  }
  return v as unknown as LibraryMock
}
