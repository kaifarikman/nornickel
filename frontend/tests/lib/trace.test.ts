import { describe, expect, it } from 'vitest'
import type { BoardResponse, ExtractResponse, Hypothesis } from '@/contracts.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import { buildEvidenceSubgraph, resolveTrace } from '@/lib/trace.ts'

const board = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse
const diagnostics = board.diagnostics

describe('resolveTrace', () => {
  it('resolves every trace id and preserves order for each hypothesis', () => {
    for (const hyp of board.hypotheses) {
      const steps = resolveTrace(hyp, extract, diagnostics)
      expect(steps).toHaveLength(hyp.trace.length)
      expect(steps.map((s) => s.id)).toEqual(hyp.trace)
    }
  })

  it('resolves claim steps with their document', () => {
    const top = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(top).toBeDefined()
    if (top !== undefined) {
      const steps = resolveTrace(top, extract, diagnostics)
      const claimStep = steps.find((s) => s.kind === 'claim')
      expect(claimStep?.kind).toBe('claim')
      if (claimStep?.kind === 'claim') {
        expect(claimStep.document).not.toBeNull()
        expect(claimStep.claim.text.length).toBeGreaterThan(0)
      }
    }
  })

  it('resolves a diag step to the source cell ref', () => {
    const top = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(top).toBeDefined()
    if (top !== undefined) {
      const steps = resolveTrace(top, extract, diagnostics)
      const diagStep = steps.find((s) => s.kind === 'diagnosis')
      expect(diagStep?.kind).toBe('diagnosis')
      if (diagStep?.kind === 'diagnosis') {
        expect(diagStep.cellRef).toBe('Итог!E44')
        expect(diagStep.lossCell).not.toBeNull()
      }
    }
  })

  it('skips an unknown claim id while still resolving the diag step', () => {
    const base = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(base).toBeDefined()
    if (base === undefined) return
    const hyp: Hypothesis = { ...base, trace: ['claim_999', 'diag_kgmk_closed_71'] }
    const steps = resolveTrace(hyp, extract, diagnostics)
    expect(steps).toHaveLength(1)
    expect(steps.some((s) => s.id === 'claim_999')).toBe(false)
    const diagStep = steps.find((s) => s.kind === 'diagnosis')
    expect(diagStep?.id).toBe('diag_kgmk_closed_71')
  })

  it('resolves an unknown diag id to a null loss cell keyed by its own id', () => {
    const base = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(base).toBeDefined()
    if (base === undefined) return
    const hyp: Hypothesis = { ...base, trace: ['diag_nonexistent'] }
    const steps = resolveTrace(hyp, extract, diagnostics)
    expect(steps).toHaveLength(1)
    const step = steps[0]
    expect(step?.kind).toBe('diagnosis')
    if (step?.kind === 'diagnosis') {
      expect(step.lossCell).toBeNull()
      expect(step.cellRef).toBe('diag_nonexistent')
    }
  })
})

describe('buildEvidenceSubgraph', () => {
  it('returns only nodes and edges referenced by the hypothesis', () => {
    const top = board.hypotheses.find((h) => h.id === 'hyp_001')
    expect(top).toBeDefined()
    if (top !== undefined) {
      const { nodes, edges } = buildEvidenceSubgraph(top, extract)
      expect(nodes.map((n) => n.id).sort()).toEqual([...top.source_nodes].sort())
      for (const edge of edges) {
        expect(top.source_nodes).toContain(edge.src)
        expect(top.source_nodes).toContain(edge.dst)
      }
      expect(edges.length).toBeGreaterThan(0)
    }
  })
})
