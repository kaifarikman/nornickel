import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, API_BASE, usingBackend } from '@/api.ts'
import { useFactory } from '@/app/factory.tsx'
import { Button } from '@/components/Button/Button.tsx'
import { Panel } from '@/components/Panel/Panel.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { RunPendingState } from '@/components/RunPendingState/RunPendingState.tsx'
import { StatusBadge } from '@/components/StatusBadge/StatusBadge.tsx'
import { useT } from '@/i18n/index.tsx'
import { buildCsv } from '@/lib/csv.ts'
import { byRank } from '@/lib/domain.ts'
import { downloadBlob, downloadCsv, downloadJson } from '@/lib/download.ts'
import { formatHypId, formatUsdRange } from '@/lib/format.ts'
import { safeHref } from '@/lib/url.ts'
import styles from './ReportExport.module.css'

export function ReportExport() {
  const t = useT()
  const { factory } = useFactory()
  const [locallyGenerated, setLocallyGenerated] = useState(false)
  const board = useQuery({ queryKey: ['board', factory], queryFn: () => api.getBoard(factory) })
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })

  if (board.isPending || extract.isPending) {
    return <LoadingState />
  }
  if (board.isError || extract.isError) {
    return <ErrorState onRetry={() => refetchAll([board, extract])} />
  }

  if (board.data === null) {
    return <RunPendingState />
  }

  const boardData = board.data
  const hypotheses = byRank(boardData.hypotheses)

  const handleExportJson = () => {
    downloadJson(`board_${factory}.json`, boardData)
    setLocallyGenerated(true)
  }
  const handleExportCsv = async () => {
    if (usingBackend) {
      try {
        const res = await fetch(`${API_BASE}/export/board.csv`, {
          headers: { Accept: 'text/csv' },
        })
        if (!res.ok) {
          throw new Error(`GET ${API_BASE}/export/board.csv → ${res.status}`)
        }
        downloadBlob(`board_${factory}.csv`, await res.blob())
        setLocallyGenerated(false)
        return
      } catch (err) {
        console.warn('[report] backend csv export failed, generating locally:', err)
      }
    }
    downloadCsv(
      `board_${factory}.csv`,
      buildCsv(t.report.columns, boardData.hypotheses, extract.data.entities),
    )
    setLocallyGenerated(true)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.columns}>
        <Panel bar className={styles.report}>
          <h2 className={styles.reportName}>{t.report.reportName}</h2>
          <ul className={styles.hypList}>
            {hypotheses.map((h) => (
              <li key={h.id} className={styles.hypRow}>
                <span className={styles.hypId}>{formatHypId(h.id)}</span>
                <span className={styles.hypTitle}>{h.title}</span>
                <span className={styles.hypValue}>
                  {formatUsdRange(h.economic_effect.value_usd_range, t.units)}
                </span>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
          <div className={styles.sources}>
            <span className={styles.sourcesTitle}>{t.common.source}</span>
            <ul className={styles.sourceList}>
              {extract.data.documents.map((doc) => {
                const href = safeHref(doc.source_url)
                return (
                  <li key={doc.id}>
                    {href !== null ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {doc.title}
                      </a>
                    ) : (
                      `${doc.title} (${t.common.internalDocument})`
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </Panel>
        <div className={styles.aside}>
          <Button variant="primary" onClick={handleExportJson}>
            {t.report.exportJson}
          </Button>
          <Button
            onClick={() => {
              void handleExportCsv()
            }}
          >
            {t.report.exportCsv}
          </Button>
          {locallyGenerated && (
            <span className={styles.localBadge}>{t.report.generatedLocally}</span>
          )}
        </div>
      </div>
    </div>
  )
}
