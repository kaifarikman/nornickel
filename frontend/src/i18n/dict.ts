import type {
  Diagnosis,
  Element,
  HypothesisStatus,
  KnownFactoryId,
  LeverType,
  MineralForm,
  ScoreDimension,
  DataQualityIssue,
} from '@/contracts.ts'

export type Locale = 'ru' | 'en'

export type LocalizedText = Record<Locale, string>

export interface Dict {
  common: {
    loading: string
    error: string
    retry: string
    score: string
    confidence: string
    source: string
    internalDocument: string
    page: (n: number) => string
    runPending: string
    runRequired: string
    goToSetup: string
    crashTitle: string
    crashAction: string
  }
  layout: {
    appName: string
    openNav: string
    closeNav: string
    langSwitch: string
  }
  units: {
    tons: string
    mln: string
    thousand: string
    perYear: string
    noData: string
  }
  nav: {
    setup: string
    diagnosis: string
    hypotheses: string
    graph: string
    benchmark: string
    library: string
    report: string
  }
  screenTitles: {
    setup: string
    run: string
    diagnosis: string
    hypotheses: string
    detail: string
    graph: string
    benchmark: string
    library: string
    report: string
  }
  setup: {
    subtitle: string
    heading: string
    factoryField: string
    reportFile: string
    reportFileHint: string
    targetKpi: string
    targetElement: string
    directionDecrease: string
    price: string
    capexLimit: string
    run: string
    runHint: string
  }
  run: {
    subtitle: string
    heading: string
    stages: {
      read: string
      diagnose: string
      extract: string
      graph: string
      score: string
      done: string
    }
    stageDetail: (args: { file: string; factory: string }) => string
    graphCaption: string
    finishing: string
  }
  graph: {
    subtitle: string
    heading: string
    hint: string
    nodesLabel: string
    edgesLabel: string
    claimsLabel: string
    sourcesLabel: string
    kinds: {
      factor: string
      mechanism: string
      property: string
      kpi: string
    }
  }
  factory: {
    label: string
    names: Record<KnownFactoryId, string>
    switchAria: string
  }
  diagnosis: {
    subtitle: string
    totalLost: string
    recoverable: string
    valuePerYear: string
    heatmapTitle: string
    heatmapHint: string
    sectionRock: string
    sectionPyrrhotite: string
    diagnosisBand: string
    dataReadiness: string
    notRecoverable: string
    cellTooltip: (args: {
      sizeClass: string
      form: string
      diagnosis: string
      tons: string
      share: number
      cellRef: string
    }) => string
    elementSwitch: string
  }
  board: {
    subtitle: string
    rerunTitle: string
    excludeFactor: string
    excludeThis: string
    noExclusion: string
    costWeight: string
    price: string
    priceElement: string
    textConstraint: string
    textConstraintPlaceholder: string
    applyTextConstraint: string
    parsedActions: string
    unparsedConstraint: string
    apply: string
    reset: string
    recomputed: string
    empty: string
    addressableTons: string
    capex: string
    expertMatchBadge: string
    hashBadge: string
    rankUp: (n: number) => string
    rankDown: (n: number) => string
    statusTerms: Record<HypothesisStatus, string>
  }
  detail: {
    subtitle: string
    backToBoard: string
    metrics: Record<ScoreDimension, string>
    traceTitle: string
    traceTargetKpi: string
    traceHypothesis: string
    traceCellRef: (ref: string) => string
    economicTitle: string
    assumptionsTitle: string
    addressableTons: string
    recoveryGain: string
    evidenceGraphTitle: string
    risksTitle: string
    missingEvidenceTitle: string
    doeTitle: string
    doeObjective: string
    doeFactors: string
    doeMeasurements: string
    doeRuns: (n: number) => string
    notFound: string
  }
  benchmark: {
    subtitle: string
    experts: string
    system: string
    reproduced: (args: { matched: number; total: number; novel: number }) => string
    notInExperts: string
    uncovered: string
    matched: string
    leverTypes: Record<LeverType, string>
  }
  library: {
    subtitle: string
    corpus: string
    caseSources: string
    openSources: string
    statusProcessed: string
    statusFailed: string
    facts: (n: number) => string
    openBadge: string
    empty: string
  }
  report: {
    subtitle: string
    reportName: string
    exportJson: string
    exportCsv: string
    generatedLocally: string
    columns: string[]
  }
  mineralForms: Record<MineralForm, string>
  diagnoses: Record<Diagnosis, string>
  elements: Record<Element, string>
  capexClasses: Record<number, string>
  dataQualityIssues: Record<DataQualityIssue, string>
  dataQualityHandling: Record<string, string>
  statusReason: Record<HypothesisStatus, string>
}
