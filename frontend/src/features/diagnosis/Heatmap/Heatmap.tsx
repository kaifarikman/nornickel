import type { CSSProperties } from 'react'
import type { DiagnosticsReport, Element, LossCell, TailsSection } from '@/contracts.ts'
import { useT } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { formatTons } from '@/lib/format.ts'
import {
  MINERAL_FORM_ORDER,
  SIZE_CLASS_ORDER,
  cellsForElement,
  maxCellTons,
  normalizeSizeClass,
} from '@/lib/domain.ts'
import styles from './Heatmap.module.css'

interface HeatmapProps {
  diagnostics: DiagnosticsReport
  element: Element
  section: TailsSection
  highlightCellRef: string | null
}

function heatBucket(tons: number, max: number): number {
  if (tons <= 0 || max <= 0) {
    return -1
  }
  const ratio = tons / max
  if (ratio >= 0.75) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.28) return 2
  if (ratio >= 0.12) return 1
  return 0
}

export function Heatmap({ diagnostics, element, section, highlightCellRef }: HeatmapProps) {
  const t = useT()
  const cells = cellsForElement(diagnostics, element, section)
  const forms = MINERAL_FORM_ORDER.filter((f) => cells.some((c) => c.mineral_form === f))
  const rows = SIZE_CLASS_ORDER.filter((sc) =>
    cells.some((c) => normalizeSizeClass(c.size_class) === normalizeSizeClass(sc)),
  )
  const recoverableMax = maxCellTons(cells.filter((c) => c.recoverable))

  const byKey = new Map<string, LossCell>()
  for (const c of cells) {
    byKey.set(`${normalizeSizeClass(c.size_class)}|${c.mineral_form}`, c)
  }

  return (
    <div className={styles.wrap} role="group" aria-label={t.diagnosis.heatmapTitle}>
      <div className={styles.grid} style={{ '--cols': forms.length } as CSSProperties}>
        <div className={cx(styles.corner, styles.headCell)} aria-hidden="true" />
        {forms.map((form) => (
          <div key={form} className={cx(styles.colHead, styles.headCell)}>
            {t.mineralForms[form]}
          </div>
        ))}
        {rows.map((sizeClass) => (
          <div key={sizeClass} className={styles.row}>
            <div className={cx(styles.rowHead, styles.headCell)}>{sizeClass}</div>
            {forms.map((form) => {
              const cell = byKey.get(`${normalizeSizeClass(sizeClass)}|${form}`)
              if (cell === undefined) {
                return (
                  <div
                    key={form}
                    className={cx(styles.cell, styles.cellEmpty)}
                    aria-hidden="true"
                  />
                )
              }
              const inert = !cell.recoverable
              const bucket = inert ? -1 : heatBucket(cell.tons, recoverableMax)
              const highlighted = highlightCellRef !== null && cell.cell_ref === highlightCellRef
              const dark = bucket >= 3
              const cellText = t.diagnosis.cellTooltip({
                sizeClass: cell.size_class,
                form: t.mineralForms[cell.mineral_form],
                diagnosis: t.diagnoses[cell.diagnosis],
                tons: formatTons(cell.tons, t.units),
                share: Math.round(cell.share_of_class_pct),
                cellRef: cell.cell_ref,
              })
              return (
                <button
                  key={form}
                  type="button"
                  className={cx(
                    styles.cell,
                    inert && styles.cellInert,
                    dark && styles.cellDark,
                    highlighted && styles.cellHighlight,
                  )}
                  data-bucket={inert ? 'inert' : bucket}
                  title={cellText}
                  aria-label={cellText}
                >
                  <span className={styles.cellTons}>{formatTons(cell.tons, t.units)}</span>
                  {inert && <span className={styles.cellNote}>{t.diagnosis.notRecoverable}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendLabel}>0</span>
        {[0, 1, 2, 3, 4].map((b) => (
          <span key={b} className={styles.legendSwatch} data-bucket={b} />
        ))}
        <span className={styles.legendLabel}>{formatTons(recoverableMax, t.units)}</span>
        <span className={styles.legendDivider} />
        <span className={cx(styles.legendSwatch, styles.legendInert)} data-bucket="inert" />
        <span className={styles.legendLabel}>{t.diagnosis.notRecoverable}</span>
      </div>
    </div>
  )
}
