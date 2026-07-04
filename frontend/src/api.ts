import type {
  BoardResponse,
  DiagnosticsReport,
  ExpertHypothesis,
  ExtractResponse,
  FactoryId,
  Hypothesis,
  KnownFactoryId,
  NarrateResponse,
  NoveltyResponse,
  ParseConstraintsResponse,
  RerunAction,
  SkepticResponse,
} from './contracts.ts'
import type { LibraryMock } from '@/mocks/library.ts'
import { libraryMock } from '@/mocks/library.ts'
import { applyRerun } from '@/lib/rerun.ts'
import { FACTORY_SOURCE_FILE } from '@/lib/domain.ts'
import {
  assertBoard,
  assertExpertHypotheses,
  assertExtract,
  assertHypothesis,
  assertLibrary,
  assertNarrate,
  assertNovelty,
  assertSkeptic,
} from '@/lib/validate.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import expertFixture from '@/mocks/fixtures/expert_hypotheses.json'
import diagnosticsKgmk from '@/mocks/fixtures/diagnostics_kgmk.json'
import diagnosticsNofVkr from '@/mocks/fixtures/diagnostics_nof_vkr.json'
import diagnosticsNofMed from '@/mocks/fixtures/diagnostics_nof_med.json'
import diagnosticsTof from '@/mocks/fixtures/diagnostics_tof.json'

export interface FactoryBoard {
  diagnostics: DiagnosticsReport
  board: BoardResponse | null
}

export interface ApiClient {
  getBoard: (factory: FactoryId) => Promise<BoardResponse | null>
  getHypothesis: (factory: FactoryId, id: string) => Promise<Hypothesis | null>
  getDiagnostics: (factory: FactoryId) => Promise<DiagnosticsReport>
  getExtract: () => Promise<ExtractResponse>
  getExpertHypotheses: () => Promise<ExpertHypothesis[]>
  getLibrary: () => Promise<LibraryMock>
  getSkeptic: (hypothesis: Hypothesis) => Promise<SkepticResponse>
  getNarrative: (
    hypothesis: Hypothesis,
    skeptic?: SkepticResponse,
    novelty?: NoveltyResponse,
  ) => Promise<NarrateResponse>
  getNovelty: (hypothesis: Hypothesis) => Promise<NoveltyResponse>
  parseConstraints: (factory: FactoryId, text: string) => Promise<ParseConstraintsResponse>
  rerun: (factory: FactoryId, action: RerunAction) => Promise<BoardResponse | null>
  resetRun: (factory: FactoryId) => Promise<BoardResponse | null>
}

export const PACK_ID = 'flotation-v1'

const initialBoard = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse
const expert = expertFixture as unknown as ExpertHypothesis[]

const DIAGNOSTICS: Record<KnownFactoryId, DiagnosticsReport> = {
  kgmk: diagnosticsKgmk as unknown as DiagnosticsReport,
  nof_vkr: diagnosticsNofVkr as unknown as DiagnosticsReport,
  nof_med: diagnosticsNofMed as unknown as DiagnosticsReport,
  tof: diagnosticsTof as unknown as DiagnosticsReport,
}

function diagnosticsFor(factory: FactoryId): DiagnosticsReport {
  return DIAGNOSTICS[factory as KnownFactoryId] ?? DIAGNOSTICS.kgmk
}

const LATENCY_SCALE = import.meta.env.MODE === 'test' ? 0 : 1

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms * LATENCY_SCALE))
}

function createFixtureClient(): ApiClient {
  const boards: Partial<Record<FactoryId, BoardResponse>> = {
    kgmk: structuredClone(initialBoard),
  }

  return {
    async getBoard(factory) {
      await delay(100)
      const board = boards[factory]
      return board !== undefined ? structuredClone(board) : null
    },
    async getHypothesis(factory, id) {
      await delay(80)
      const hyp = boards[factory]?.hypotheses.find((h) => h.id === id)
      return hyp !== undefined ? structuredClone(hyp) : null
    },
    async getDiagnostics(factory) {
      await delay(80)
      return structuredClone(diagnosticsFor(factory))
    },
    async getExtract() {
      await delay(60)
      return structuredClone(extract)
    },
    async getExpertHypotheses() {
      await delay(60)
      return structuredClone(expert)
    },
    async getLibrary() {
      await delay(80)
      return structuredClone(libraryMock)
    },
    async getSkeptic(hypothesis) {
      await delay(120)
      return {
        objection:
          'Механизм требует проверки на конкретном сырье и режиме фабрики до масштабирования.',
        missing_evidence: hypothesis.missing_evidence,
        risks: hypothesis.risks,
        suggested_checks: hypothesis.doe_plan.measurements,
      }
    },
    async getNarrative(hypothesis) {
      await delay(120)
      return {
        text: `${hypothesis.summary} Гипотеза должна быть подтверждена DOE перед внедрением.`,
      }
    },
    async getNovelty(hypothesis) {
      await delay(120)
      return {
        novelty_score: hypothesis.score_breakdown.novelty,
        similar: [],
      }
    },
    async parseConstraints(factory, text) {
      await delay(120)
      const board = boards[factory] ?? boards.kgmk
      return parseConstraintsFixture(text, board ?? initialBoard, extract)
    },
    async rerun(factory, action) {
      await delay(200)
      const board = boards[factory]
      if (board === undefined) {
        return null
      }
      boards[factory] = applyRerun(board, extract, action)
      return structuredClone(boards[factory] as BoardResponse)
    },
    async resetRun(factory) {
      await delay(120)
      if (factory === 'kgmk') {
        boards.kgmk = structuredClone(initialBoard)
        return structuredClone(boards.kgmk)
      }
      const board = boards[factory]
      return board !== undefined ? structuredClone(board) : null
    },
  }
}

const API_URL = import.meta.env.VITE_API_URL
const API_MODE = import.meta.env.VITE_API_MODE

export const API_BASE = API_URL !== undefined && API_URL.length > 0 ? API_URL : '/api'

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`)
  }
  return await res.json()
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`POST ${url} → ${res.status}`)
  }
  return await res.json()
}

interface RunResponse {
  run_id: string
  board: BoardResponse
}

function assertRun(v: unknown): RunResponse {
  if (
    typeof v !== 'object' ||
    v === null ||
    typeof (v as Record<string, unknown>)['run_id'] !== 'string'
  ) {
    throw new Error('contract validation failed: RunResponse')
  }
  const run = v as Record<string, unknown>
  return { run_id: run['run_id'] as string, board: assertBoard(run['board']) }
}

function assertParseConstraints(v: unknown): ParseConstraintsResponse {
  if (typeof v !== 'object' || v === null || !Array.isArray((v as { actions?: unknown }).actions)) {
    throw new Error('contract validation failed: ParseConstraintsResponse')
  }
  const parsed = v as { actions: unknown[]; unparsed?: unknown[]; kpi_contract_patch?: unknown }
  return {
    actions: parsed.actions as RerunAction[],
    kpi_contract_patch:
      typeof parsed.kpi_contract_patch === 'object' && parsed.kpi_contract_patch !== null
        ? (parsed.kpi_contract_patch as Record<string, unknown>)
        : {},
    unparsed: Array.isArray(parsed.unparsed) ? parsed.unparsed.map(String) : [],
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim()
}

function parseElement(text: string): 'element_28' | 'element_29' | null {
  if (/\b28\b|элемент\s*28|никел|nickel|\bni\b/.test(text)) return 'element_28'
  if (/\b29\b|элемент\s*29|мед|copper|\bcu\b/.test(text)) return 'element_29'
  return null
}

function parseNumber(text: string): number | null {
  const matches = [...text.matchAll(/\d[\d _]*/g)]
  if (matches.length === 0) return null
  const raw = (matches.at(-1)?.[0] ?? '').replace(/[^\d]/g, '')
  return raw.length > 0 ? Number(raw) : null
}

function parseConstraintsFixture(
  text: string,
  board: BoardResponse,
  extractResponse: ExtractResponse,
): ParseConstraintsResponse {
  const normalized = normalizeText(text)
  const actions: RerunAction[] = []
  const unparsed: string[] = []
  const element = parseElement(normalized)
  if ((normalized.includes('цен') || normalized.includes('вдвое')) && element !== null) {
    const usd_per_t = normalized.includes('вдвое')
      ? board.kpi_contract.prices_usd_per_t[element] * 2
      : parseNumber(normalized)
    if (usd_per_t !== null) {
      actions.push({ kind: 'change_price', payload: { element, usd_per_t } })
    }
  }
  if (
    normalized.includes('без капзатрат') ||
    normalized.includes('капзатраты запрещ') ||
    normalized.includes('капекс запрещ') ||
    normalized.includes('без capex') ||
    normalized.includes('только настройки')
  ) {
    actions.push({
      kind: 'add_constraint',
      payload: { metric: 'capex_class', op: '<=', value: 1 },
    })
  }
  for (const match of normalized.matchAll(
    /(?:исключи|исключить|не использовать|без)\s+([^,.]+)/g,
  )) {
    const term = (match[1] ?? '').trim()
    if (term.includes('кап') || term.includes('capex')) continue
    const factor = extractResponse.entities
      .filter((n) => n.tags.includes('controllable'))
      .find((n) => normalizeText(`${n.id} ${n.label}`).includes(term))
    if (factor === undefined) {
      unparsed.push(term)
    } else {
      actions.push({ kind: 'exclude_factor', payload: { factor_id: factor.id } })
    }
  }
  if (actions.length === 0 && unparsed.length === 0 && text.trim().length > 0) {
    unparsed.push(text.trim())
  }
  return { actions, kpi_contract_patch: {}, unparsed }
}

export function createHttpClient(baseUrl: string): ApiClient {
  const base = baseUrl.replace(/\/$/, '')
  const runIds = new Map<FactoryId, string>()
  const pendingRuns = new Map<FactoryId, Promise<RunResponse>>()
  // Deterministic demo insurance: if the backend is unreachable, degrade to the
  // committed fixtures instead of surfacing a hard error (mirrors the Rust
  // sidecar fallback). Also used to resolve hypotheses when /hypothesis fails.
  const fixtureFallback = createFixtureClient()

  async function ensureRun(factory: FactoryId): Promise<RunResponse> {
    const cached = runIds.get(factory)
    if (cached !== undefined) {
      try {
        const board = assertBoard(
          await getJson(`${base}/board?run_id=${encodeURIComponent(cached)}`),
        )
        return { run_id: cached, board }
      } catch {
        // The run_id is stale (e.g. backend restarted): drop it and start a
        // fresh run rather than failing every request until a page reload.
        runIds.delete(factory)
      }
    }
    const inFlight = pendingRuns.get(factory)
    if (inFlight !== undefined) {
      return inFlight
    }
    const body = {
      factory_id: factory,
      pack_id: PACK_ID,
      source_file: FACTORY_SOURCE_FILE[factory as keyof typeof FACTORY_SOURCE_FILE],
    }
    const promise = postJson(`${base}/run`, body)
      .then((raw) => {
        const run = assertRun(raw)
        runIds.set(factory, run.run_id)
        return run
      })
      .finally(() => {
        // Drop the in-flight entry once settled: on success the run is now
        // cached by run_id; on failure this allows a later retry.
        pendingRuns.delete(factory)
      })
    pendingRuns.set(factory, promise)
    return promise
  }

  const client: ApiClient = {
    async getBoard(factory) {
      try {
        return (await ensureRun(factory)).board
      } catch (err) {
        console.warn(`getBoard(${factory}) failed, using fixture fallback`, err)
        return fixtureFallback.getBoard(factory)
      }
    },
    async getHypothesis(factory, id) {
      try {
        const hypothesis = await getJson(`${base}/hypothesis/${encodeURIComponent(id)}`)
        return assertHypothesis(hypothesis)
      } catch (err) {
        console.warn(`getHypothesis(${id}) failed, falling back to board lookup`, err)
        const board = await client.getBoard(factory)
        return board?.hypotheses.find((h) => h.id === id) ?? null
      }
    },
    async getDiagnostics(factory) {
      return (await ensureRun(factory)).board.diagnostics
    },
    async getExtract() {
      return assertExtract(await getJson(`${base}/extract`))
    },
    async getExpertHypotheses() {
      return assertExpertHypotheses(await getJson(`${base}/expert_hypotheses`))
    },
    async getLibrary() {
      try {
        return assertLibrary(await getJson(`${base}/library`))
      } catch (err) {
        console.warn('getLibrary failed, using fixture fallback', err)
        return fixtureFallback.getLibrary()
      }
    },
    async getSkeptic(hypothesis) {
      return assertSkeptic(await postJson(`${base}/skeptic`, { hypothesis }))
    },
    async getNarrative(hypothesis, skeptic, novelty) {
      return assertNarrate(await postJson(`${base}/narrate`, { hypothesis, skeptic, novelty }))
    },
    async getNovelty(hypothesis) {
      return assertNovelty(
        await postJson(`${base}/novelty`, {
          hypothesis_text: `${hypothesis.title}\n\n${hypothesis.summary}`,
          top_k: 5,
        }),
      )
    },
    async parseConstraints(factory, text) {
      const runId = runIds.get(factory) ?? (await ensureRun(factory)).run_id
      return assertParseConstraints(
        await postJson(`${base}/constraints/parse`, { run_id: runId, text }),
      )
    },
    async rerun(factory, action) {
      const runId = runIds.get(factory) ?? (await ensureRun(factory)).run_id
      return assertBoard(await postJson(`${base}/rerun`, { run_id: runId, action }))
    },
    async resetRun(factory) {
      runIds.delete(factory)
      return (await ensureRun(factory)).board
    },
  }

  return client
}

const hasApiUrl = typeof API_URL === 'string' && API_URL.length > 0

// 'msw' only implies a backend during dev, where the service worker actually
// intercepts requests (see main.tsx). In a prod build the worker never starts,
// so 'msw' without a real API_URL falls back to the fixture client instead of
// pointing the http client at a dead /api endpoint (white screen).
export const usingBackend =
  API_MODE === 'http' || hasApiUrl || (API_MODE === 'msw' && import.meta.env.DEV)

export const api: ApiClient = usingBackend ? createHttpClient(API_BASE) : createFixtureClient()
