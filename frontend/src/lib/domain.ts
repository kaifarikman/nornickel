import type {
  DiagnosticsReport,
  Diagnosis,
  Element,
  KnownFactoryId,
  Hypothesis,
  LossCell,
  MineralForm,
  NodeKind,
} from '@/contracts.ts'

export function byRank(hypotheses: Hypothesis[]): Hypothesis[] {
  return hypotheses.slice().sort((a, b) => a.rank - b.rank)
}

export const ELEMENTS: Element[] = ['element_28', 'element_29']

export const NODE_KIND_ORDER: NodeKind[] = ['factor', 'mechanism', 'property', 'kpi']

export function toElement(value: string): Element {
  return value === 'element_29' ? 'element_29' : 'element_28'
}

export function toFactoryId(value: string): KnownFactoryId {
  return (FACTORY_ORDER as string[]).includes(value) ? (value as KnownFactoryId) : 'kgmk'
}

export const SIZE_CLASS_ORDER: string[] = [
  '+125',
  '-125 +71',
  '+71',
  '-71 +45',
  '-45 +20',
  '-20 +10',
  '-10',
]

/**
 * Size-class labels come from literal xlsx header text (anchored parser,
 * AGENT_RULES §1 — no fixed cell coordinates), so spacing around the `+`
 * varies between plants and even between sections of the same file (e.g.
 * ТОФ mixes "-71 +45" and "-71 + 45"). Compare on this normalized form
 * instead of the raw string everywhere size classes are matched.
 */
export function normalizeSizeClass(value: string): string {
  return value.replace(/\s+/g, '')
}

export const MINERAL_FORM_ORDER: MineralForm[] = [
  'open_pnt_cp',
  'closed_pnt_cp',
  'millerite',
  'pyrrhotite_impurity',
  'silicate_valleriite',
  'pyrite_other_sulfides',
]

export const DIAGNOSIS_ORDER: Diagnosis[] = [
  'liberation_deficit',
  'flotation_kinetics',
  'slimes_overgrinding',
  'not_recoverable',
]

export const FACTORY_ORDER: KnownFactoryId[] = ['kgmk', 'nof_vkr', 'nof_med', 'tof']

export const FACTORY_REPORT_FILE: Record<KnownFactoryId, string> = {
  kgmk: 'Хвосты КГМК.xlsx',
  nof_vkr: 'Хвосты НОФ вкрапленная.xlsx',
  nof_med: 'Хвосты НОФ медистая.xlsx',
  tof: 'Хвосты ТОФ.xlsx',
}

export const DEFAULT_PRICE_USD_PER_T: Record<Element, number> = {
  element_28: 16500,
  element_29: 9500,
}

export const MAX_CAPEX_CLASS = 3

export function cellsForElement(
  diagnostics: DiagnosticsReport,
  element: Element,
  section?: string,
): LossCell[] {
  return diagnostics.loss_cells.filter(
    (c) => c.element === element && (section === undefined || c.section === section),
  )
}

export function recoverableTons(
  diagnostics: DiagnosticsReport,
  element: Element,
  section?: string,
): number {
  return cellsForElement(diagnostics, element, section)
    .filter((c) => c.recoverable)
    .reduce((sum, c) => sum + c.tons, 0)
}

export function maxCellTons(cells: LossCell[]): number {
  return cells.reduce((max, c) => Math.max(max, c.tons), 0)
}
