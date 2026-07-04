import type { Dict } from '@/i18n/dict.ts'

export type ScreenKey = keyof Dict['screenTitles']

export interface ScreenDef {
  number: string
  navKey: keyof Dict['nav']
  titleKey: ScreenKey
  path: string
}

export const SCREENS: ScreenDef[] = [
  { number: '00', navKey: 'setup', titleKey: 'setup', path: '/setup' },
  { number: '01', navKey: 'diagnosis', titleKey: 'diagnosis', path: '/diagnosis' },
  { number: '02', navKey: 'hypotheses', titleKey: 'hypotheses', path: '/hypotheses' },
  { number: '03', navKey: 'graph', titleKey: 'graph', path: '/graph' },
  { number: '04', navKey: 'benchmark', titleKey: 'benchmark', path: '/benchmark' },
  { number: '05', navKey: 'library', titleKey: 'library', path: '/library' },
  { number: '06', navKey: 'report', titleKey: 'report', path: '/report' },
]

export interface ResolvedScreen {
  number: string
  titleKey: ScreenKey
}

export function resolveScreen(pathname: string): ResolvedScreen {
  if (/^\/hypotheses\/.+/.test(pathname)) {
    return { number: '02', titleKey: 'detail' }
  }
  if (pathname === '/run') {
    return { number: '00', titleKey: 'run' }
  }
  const match = SCREENS.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))
  return match !== undefined
    ? { number: match.number, titleKey: match.titleKey }
    : { number: '00', titleKey: 'setup' }
}

export function screenSubtitle(t: Dict, key: ScreenKey): string {
  const map: Record<ScreenKey, string> = {
    setup: t.setup.subtitle,
    run: t.run.subtitle,
    diagnosis: t.diagnosis.subtitle,
    hypotheses: t.board.subtitle,
    detail: t.detail.subtitle,
    graph: t.graph.subtitle,
    benchmark: t.benchmark.subtitle,
    library: t.library.subtitle,
    report: t.report.subtitle,
  }
  return map[key]
}
