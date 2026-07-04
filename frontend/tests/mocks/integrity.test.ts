import { describe, expect, it } from 'vitest'
import type {
  BoardResponse,
  DiagnosticsReport,
  ExpertHypothesis,
  ExtractResponse,
} from '@/contracts.ts'
import boardFixture from '@/mocks/fixtures/board.json'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import expertFixture from '@/mocks/fixtures/expert_hypotheses.json'
import diagNofVkr from '@/mocks/fixtures/diagnostics_nof_vkr.json'
import diagNofMed from '@/mocks/fixtures/diagnostics_nof_med.json'
import diagTof from '@/mocks/fixtures/diagnostics_tof.json'
import { libraryMock } from '@/mocks/library.ts'
import { PACK_WEIGHTS, computeTotal } from '@/lib/score.ts'

const board = boardFixture as unknown as BoardResponse
const extract = extractFixture as unknown as ExtractResponse
const experts = expertFixture as unknown as ExpertHypothesis[]

const diagnostics: DiagnosticsReport[] = [
  board.diagnostics,
  diagNofVkr as unknown as DiagnosticsReport,
  diagNofMed as unknown as DiagnosticsReport,
  diagTof as unknown as DiagnosticsReport,
]

const claimIds = new Set(extract.claims.map((c) => c.id))
const entityIds = new Set(extract.entities.map((e) => e.id))
const documentIds = new Set(extract.documents.map((d) => d.id))
const expertIds = new Set(experts.map((e) => e.id))
const diagRefs = board.diagnostics.diag_refs ?? []
const diagRefIds = new Set(diagRefs.map((r) => r.id))
const cellRefs = new Set(board.diagnostics.loss_cells.map((c) => c.cell_ref))

describe('board fixture integrity', () => {
  it('resolves every hypothesis trace id (claim or diag)', () => {
    for (const hyp of board.hypotheses) {
      for (const id of hyp.trace) {
        const known = id.startsWith('diag_') ? diagRefIds.has(id) : claimIds.has(id)
        expect(known, `${hyp.id} -> ${id}`).toBe(true)
      }
    }
  })

  it('resolves every hypothesis source node', () => {
    for (const hyp of board.hypotheses) {
      for (const nodeId of hyp.source_nodes) {
        expect(entityIds.has(nodeId), `${hyp.id} -> ${nodeId}`).toBe(true)
      }
    }
  })

  it('resolves every expert_match to an existing expert hypothesis', () => {
    for (const hyp of board.hypotheses) {
      if (hyp.expert_match !== null) {
        expect(expertIds.has(hyp.expert_match.expert_hypothesis_id), hyp.id).toBe(true)
      }
    }
  })

  it('every diag_ref points at an existing loss cell', () => {
    for (const ref of diagRefs) {
      expect(cellRefs.has(ref.cell_ref), ref.id).toBe(true)
    }
  })

  it('resolves every edge endpoint and source claim', () => {
    for (const edge of extract.edges) {
      expect(entityIds.has(edge.src), `${edge.id} src`).toBe(true)
      expect(entityIds.has(edge.dst), `${edge.id} dst`).toBe(true)
      for (const claimId of edge.source_claims) {
        expect(claimIds.has(claimId), `${edge.id} -> ${claimId}`).toBe(true)
      }
    }
  })

  it('resolves every claim source document', () => {
    for (const claim of extract.claims) {
      expect(documentIds.has(claim.source_ref), `${claim.id} -> ${claim.source_ref}`).toBe(true)
    }
  })

  it('has unique hypothesis, claim and entity ids', () => {
    const hypIds = board.hypotheses.map((h) => h.id)
    expect(new Set(hypIds).size).toBe(hypIds.length)

    const claimIdList = extract.claims.map((c) => c.id)
    expect(new Set(claimIdList).size).toBe(claimIdList.length)

    const entityIdList = extract.entities.map((e) => e.id)
    expect(new Set(entityIdList).size).toBe(entityIdList.length)
  })

  it('keeps score_total consistent with the weighted breakdown', () => {
    for (const hyp of board.hypotheses) {
      const computed = computeTotal(hyp.score_breakdown, PACK_WEIGHTS)
      expect(Math.abs(computed - hyp.score_total), hyp.id).toBeLessThanOrEqual(0.076)
    }
  })

  it('keeps score_total non-increasing along ascending rank', () => {
    const sorted = board.hypotheses.slice().sort((a, b) => a.rank - b.rank)
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]
      const current = sorted[i]
      if (prev !== undefined && current !== undefined) {
        expect(prev.score_total, `${prev.id} >= ${current.id}`).toBeGreaterThanOrEqual(
          current.score_total,
        )
      }
    }
  })
})

describe('diagnostics fixtures integrity', () => {
  it('every loss cell diagnosis matches recoverability sign', () => {
    for (const d of diagnostics) {
      for (const cell of d.loss_cells) {
        if (cell.diagnosis === 'not_recoverable') {
          expect(cell.recoverable, `${d.factory_id} ${cell.cell_ref}`).toBe(false)
        } else {
          expect(cell.recoverable, `${d.factory_id} ${cell.cell_ref}`).toBe(true)
        }
      }
    }
  })

  it('diagnosis_summary tons match summed loss cells per (diagnosis, element)', () => {
    for (const d of diagnostics) {
      for (const row of d.diagnosis_summary) {
        const summed = d.loss_cells
          .filter((c) => c.diagnosis === row.diagnosis && c.element === row.element)
          .reduce((sum, c) => sum + c.tons, 0)
        expect(summed, `${d.factory_id} ${row.diagnosis}/${row.element}`).toBeCloseTo(row.tons, 0)
      }
    }
  })

  it('tof reports two tailings sections', () => {
    const tof = diagnostics.find((d) => d.factory_id === 'tof')
    expect(tof?.sections).toEqual(['rock', 'pyrrhotite'])
  })
})

describe('library / expert integrity', () => {
  it('library files reference existing documents with consistent fact counts', () => {
    for (const file of libraryMock.files) {
      if (file.documentId !== null) {
        expect(documentIds.has(file.documentId), file.name).toBe(true)
        const factCount = extract.claims.filter((c) => c.source_ref === file.documentId).length
        expect(file.factsCount, `${file.name} facts`).toBe(factCount)
      }
    }
  })

  it('kgmk board has at least three expert matches', () => {
    const matched = board.hypotheses.filter((h) => h.expert_match?.matched === true)
    expect(matched.length).toBeGreaterThanOrEqual(3)
  })
})
