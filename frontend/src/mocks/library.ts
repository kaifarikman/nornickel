export type LibraryFileStatus = 'processed' | 'failed'

export type CorpusKind = 'case' | 'open'

export interface LibraryFile {
  name: string
  documentId: string | null
  status: LibraryFileStatus
  factsCount: number
  kind: CorpusKind
}

export interface LibraryMock {
  folder: string
  files: LibraryFile[]
  typeCounts: { label: string; count: number }[]
}

export const libraryMock: LibraryMock = {
  folder: 'norn-hack/Дополнительные материалы',
  files: [
    {
      name: 'geokniga-flotacionnye-metody-obogashcheniya_0.pdf',
      documentId: 'doc_flotation_methods',
      status: 'processed',
      factsCount: 7,
      kind: 'case',
    },
    {
      name: 'geokniga-tehnologiyaobogashcheniyapoleznyhiskopaemyh.pdf',
      documentId: 'doc_enrichment_tech',
      status: 'processed',
      factsCount: 9,
      kind: 'case',
    },
    {
      name: 'Как читать отчет института по хвостам.docx',
      documentId: 'doc_tails_manual',
      status: 'processed',
      factsCount: 2,
      kind: 'case',
    },
    {
      name: 'fine_particle_flotation_review.pdf',
      documentId: 'doc_open_fine_flotation',
      status: 'processed',
      factsCount: 2,
      kind: 'open',
    },
    {
      name: 'shema_flotacii_toф.png',
      documentId: null,
      status: 'failed',
      factsCount: 0,
      kind: 'case',
    },
  ],
  typeCounts: [
    { label: 'PDF', count: 3 },
    { label: 'DOCX', count: 1 },
    { label: 'PNG', count: 1 },
  ],
}
