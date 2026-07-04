import { http, HttpResponse } from 'msw'
import type {
  BoardResponse,
  ExpertHypothesis,
  ExtractResponse,
  FactoryId,
  KnownFactoryId,
  RerunAction,
} from '@/contracts.ts'
import { applyRerun } from '@/lib/rerun.ts'
import { targetElement } from '@/lib/domain.ts'
import { buildCsv, CSV_COLUMNS } from '@/lib/csv.ts'
import { libraryMock } from '@/mocks/library.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import expertFixture from '@/mocks/fixtures/expert_hypotheses.json'

const initialBoard = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse
const expert = expertFixture as unknown as ExpertHypothesis[]

const FACTORIES: readonly KnownFactoryId[] = ['kgmk', 'nof_vkr', 'nof_med', 'tof']
const PACK_ID = 'flotation-v1'

interface RunState {
  factory_id: FactoryId
  board: BoardResponse
}

const runs = new Map<string, RunState>()
let runSeq = 0
let lastRunId: string | null = null

export function resetMockBackend(): void {
  runs.clear()
  runSeq = 0
  lastRunId = null
}

function apiError(status: number, code: string, message: string): Response {
  return HttpResponse.json({ error: { code, message, details: {} } }, { status })
}

function currentBoard(): BoardResponse {
  const state = lastRunId !== null ? runs.get(lastRunId) : undefined
  return state?.board ?? initialBoard
}

interface RunBody {
  factory_id?: string
  pack_id?: string
}

interface RerunBody {
  run_id?: string
  action?: RerunAction
}

interface ParseConstraintsBody {
  run_id?: string
  text?: string
}

function normalizeText(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim()
}

function parseTextConstraints(text: string, board: BoardResponse) {
  const normalized = normalizeText(text)
  const actions: RerunAction[] = []
  const unparsed: string[] = []
  const element = /\b29\b|элемент\s*29|мед|copper|\bcu\b/.test(normalized)
    ? 'element_29'
    : /\b28\b|элемент\s*28|никел|nickel|\bni\b/.test(normalized)
      ? 'element_28'
      : null
  if ((normalized.includes('цен') || normalized.includes('вдвое')) && element !== null) {
    const numbers = [...normalized.matchAll(/\d[\d _]*/g)]
    const usd_per_t = normalized.includes('вдвое')
      ? board.kpi_contract.prices_usd_per_t[element] * 2
      : numbers.length > 0
        ? Number((numbers.at(-1)?.[0] ?? '').replace(/[^\d]/g, ''))
        : null
    if (usd_per_t !== null) {
      actions.push({ kind: 'change_price', payload: { element, usd_per_t } })
    }
  }
  if (
    normalized.includes('без капзатрат') ||
    normalized.includes('капзатраты запрещ') ||
    normalized.includes('без capex') ||
    normalized.includes('только настройки')
  ) {
    actions.push({ kind: 'add_constraint', payload: { metric: 'capex_class', op: '<=', value: 1 } })
  }
  if (actions.length === 0 && text.trim().length > 0) {
    unparsed.push(text.trim())
  }
  return { actions, kpi_contract_patch: {}, unparsed }
}

export const handlers = [
  http.post('*/run', async ({ request }) => {
    const body = (await request.json()) as RunBody | null
    if (body === null || typeof body.factory_id !== 'string' || typeof body.pack_id !== 'string') {
      return apiError(400, 'VALIDATION_ERROR', 'factory_id and pack_id are required')
    }
    if (!FACTORIES.includes(body.factory_id as KnownFactoryId) || body.pack_id !== PACK_ID) {
      return apiError(422, 'VALIDATION_ERROR', `unknown factory_id or pack_id`)
    }
    if (body.factory_id !== 'kgmk') {
      return apiError(422, 'VALIDATION_ERROR', `no run available for factory ${body.factory_id}`)
    }
    runSeq += 1
    const runId = `run_${String(runSeq).padStart(4, '0')}`
    const board = structuredClone(initialBoard)
    runs.set(runId, { factory_id: body.factory_id, board })
    lastRunId = runId
    return HttpResponse.json({ run_id: runId, board })
  }),

  http.get('*/board', ({ request }) => {
    const runId = new URL(request.url).searchParams.get('run_id')
    if (runId !== null) {
      const state = runs.get(runId)
      if (state === undefined) {
        return apiError(404, 'NOT_FOUND', `unknown run_id ${runId}`)
      }
      return HttpResponse.json(state.board)
    }
    return HttpResponse.json(currentBoard())
  }),

  http.post('*/rerun', async ({ request }) => {
    const body = (await request.json()) as RerunBody | null
    if (body === null || typeof body.run_id !== 'string' || body.action === undefined) {
      return apiError(400, 'VALIDATION_ERROR', 'run_id and action are required')
    }
    const state = runs.get(body.run_id)
    if (state === undefined) {
      return apiError(404, 'NOT_FOUND', `unknown run_id ${body.run_id}`)
    }
    state.board = applyRerun(state.board, extract, body.action)
    return HttpResponse.json(state.board)
  }),

  http.post('*/constraints/parse', async ({ request }) => {
    const body = (await request.json()) as ParseConstraintsBody | null
    if (body === null || typeof body.run_id !== 'string' || typeof body.text !== 'string') {
      return apiError(400, 'VALIDATION_ERROR', 'run_id and text are required')
    }
    const state = runs.get(body.run_id)
    if (state === undefined) {
      return apiError(404, 'NOT_FOUND', `unknown run_id ${body.run_id}`)
    }
    return HttpResponse.json(parseTextConstraints(body.text, state.board))
  }),

  http.get('*/hypothesis/:id', ({ params }) => {
    const id = String(params['id'])
    const hyp = currentBoard().hypotheses.find((h) => h.id === id)
    if (hyp === undefined) {
      return apiError(404, 'NOT_FOUND', `unknown hypothesis ${id}`)
    }
    return HttpResponse.json(hyp)
  }),

  http.get('*/extract', () => HttpResponse.json(extract)),

  http.get('*/expert_hypotheses', () => HttpResponse.json(expert)),

  http.get('*/library', () => HttpResponse.json(libraryMock)),

  http.get('*/export/board.json', () =>
    HttpResponse.json(currentBoard(), {
      headers: { 'Content-Disposition': 'attachment; filename="board.json"' },
    }),
  ),

  http.get(
    '*/export/board.csv',
    () =>
      new HttpResponse(
        buildCsv(
          CSV_COLUMNS,
          currentBoard().hypotheses,
          extract.entities,
          targetElement(currentBoard().kpi_contract),
        ),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="board.csv"',
          },
        },
      ),
  ),
]
