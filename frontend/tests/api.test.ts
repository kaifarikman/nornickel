import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { api, createHttpClient } from '@/api.ts'
import type { BoardResponse, ExtractResponse, RerunAction } from '@/contracts.ts'
import { applyRerun } from '@/lib/rerun.ts'
import { resetMockBackend, server } from '@/mocks/server.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'

const board = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse

describe('fixture api client', () => {
  beforeEach(async () => {
    await api.resetRun('kgmk')
  })

  it('returns the kgmk board with six hypotheses', async () => {
    const board = await api.getBoard('kgmk')
    expect(board).not.toBeNull()
    expect(board?.hypotheses).toHaveLength(6)
  })

  it('has no board for factories other than kgmk', async () => {
    expect(await api.getBoard('tof')).toBeNull()
  })

  it('serves tof diagnostics including the pyrrhotite section', async () => {
    const diagnostics = await api.getDiagnostics('tof')
    expect(diagnostics.sections).toContain('pyrrhotite')
  })

  it('serves kgmk diagnostics from the standalone QA fixture', async () => {
    const diagnostics = await api.getDiagnostics('kgmk')
    expect(diagnostics.factory_id).toBe('kgmk')
    expect(diagnostics.loss_cells.length).toBeGreaterThan(0)
  })

  it('resolves a hypothesis by id for deep links', async () => {
    const hyp = await api.getHypothesis('kgmk', 'hyp_001')
    expect(hyp?.id).toBe('hyp_001')
    expect(await api.getHypothesis('kgmk', 'hyp_nope')).toBeNull()
  })

  it('recomputes value ranges on rerun without changing the snapshot hash', async () => {
    const before = await api.getBoard('kgmk')
    const beforeHyp = before?.hypotheses.find((h) => h.id === 'hyp_001')
    expect(beforeHyp).toBeDefined()

    const next = await api.rerun('kgmk', {
      kind: 'change_price',
      payload: { element: 'element_28', usd_per_t: 33000 },
    })
    expect(next).not.toBeNull()
    const afterHyp = next?.hypotheses.find((h) => h.id === 'hyp_001')
    expect(afterHyp).toBeDefined()
    expect(afterHyp?.economic_effect.value_usd_range).not.toEqual(
      beforeHyp?.economic_effect.value_usd_range,
    )
    expect(next?.snapshot.hash).toBe(before?.snapshot.hash)
  })

  it('serves the expert hypothesis pack', async () => {
    const experts = await api.getExpertHypotheses()
    expect(experts).toHaveLength(27)
    expect(experts.some((e) => e.id === 'kgmk_h3')).toBe(true)
  })
})

describe('http api client (msw mock backend)', () => {
  const requests: string[] = []

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', ({ request }) => {
      requests.push(`${request.method} ${request.url}`)
    })
  })

  afterEach(() => {
    server.resetHandlers()
    resetMockBackend()
    requests.length = 0
    vi.restoreAllMocks()
  })

  afterAll(() => {
    server.close()
  })

  it('runs a fresh board then reuses run_id on the next getBoard', async () => {
    const client = createHttpClient('http://backend.test')
    const first = await client.getBoard('kgmk')
    expect(first?.hypotheses).toHaveLength(6)

    const second = await client.getBoard('kgmk')
    expect(second?.hypotheses).toHaveLength(6)

    expect(requests.filter((r) => r.startsWith('POST http://backend.test/run'))).toHaveLength(1)
    expect(requests.some((r) => r.includes('/board?run_id=run_0001'))).toBe(true)
  })

  it('rejects a /run body that violates the contract', async () => {
    const res = await fetch('http://backend.test/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factory: 'kgmk' }),
    })
    expect(res.status).toBe(400)
    const payload = (await res.json()) as { error: { code: string } }
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('matches local applyRerun numbers for change_price and keeps the snapshot hash', async () => {
    const client = createHttpClient('http://backend.test')
    const before = await client.getBoard('kgmk')
    if (before === null) {
      throw new Error('board missing')
    }
    const price = before.kpi_contract.prices_usd_per_t.element_28
    const action: RerunAction = {
      kind: 'change_price',
      payload: { element: 'element_28', usd_per_t: price * 2 },
    }

    const remote = await client.rerun('kgmk', action)
    const local = applyRerun(before, extract, action)

    expect(remote?.snapshot.hash).toBe(before.snapshot.hash)
    for (const hyp of local.hypotheses) {
      const remoteHyp = remote?.hypotheses.find((h) => h.id === hyp.id)
      expect(remoteHyp?.economic_effect.value_usd_range, hyp.id).toEqual(
        hyp.economic_effect.value_usd_range,
      )
      expect(remoteHyp?.score_total, hyp.id).toBe(hyp.score_total)
    }
  })

  it('serves a hypothesis by id over http for deep links', async () => {
    const client = createHttpClient('http://backend.test')
    const hyp = await client.getHypothesis('kgmk', 'hyp_001')
    expect(hyp?.id).toBe('hyp_001')
    expect(requests.some((r) => r.includes('/hypothesis/hyp_001'))).toBe(true)
  })

  it('falls back to the board lookup when /hypothesis/:id fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(http.get('*/hypothesis/:id', () => HttpResponse.error()))

    const client = createHttpClient('http://backend.test')
    const hyp = await client.getHypothesis('kgmk', 'hyp_002')

    expect(hyp?.id).toBe('hyp_002')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('exports csv with the board content', async () => {
    const res = await fetch('http://backend.test/export/board.csv')
    expect(res.ok).toBe(true)
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    const text = await res.text()
    expect(text.split('\n')).toHaveLength(1 + board.hypotheses.length)
    expect(text).toContain('hyp_001')
  })

  it('falls back to fixture data and warns when the backend is down', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(http.all('*', () => HttpResponse.error()))

    const client = createHttpClient('http://backend.test')
    const result = await client.getBoard('kgmk')

    expect(result).not.toBeNull()
    expect(result?.hypotheses).toHaveLength(6)
    expect(warnSpy).toHaveBeenCalled()
  })
})
