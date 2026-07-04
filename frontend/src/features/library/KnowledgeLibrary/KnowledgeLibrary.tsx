import { useQuery } from '@tanstack/react-query'
import type { DocumentRef } from '@/contracts.ts'
import type { LibraryFile } from '@/mocks/library.ts'
import { api } from '@/api.ts'
import { Panel } from '@/components/Panel/Panel.tsx'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { useT } from '@/i18n/index.tsx'
import { cx } from '@/lib/cx.ts'
import { safeHref } from '@/lib/url.ts'
import styles from './KnowledgeLibrary.module.css'

export function KnowledgeLibrary() {
  const t = useT()
  const library = useQuery({ queryKey: ['library'], queryFn: api.getLibrary })
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })

  if (library.isPending || extract.isPending) {
    return <LoadingState />
  }
  if (library.isError || extract.isError) {
    return <ErrorState onRetry={() => refetchAll([library, extract])} />
  }

  const docById = new Map<string, DocumentRef>(extract.data.documents.map((d) => [d.id, d]))
  const caseFiles = library.data.files.filter((f) => f.kind === 'case')
  const openFiles = library.data.files.filter((f) => f.kind === 'open')

  const renderFile = (file: LibraryFile) => {
    const doc = file.documentId !== null ? docById.get(file.documentId) : undefined
    const isOpen = file.kind === 'open'
    const docHref = safeHref(doc?.source_url ?? null)
    return (
      <li key={file.name} className={styles.fileRow}>
        <div className={styles.fileMain}>
          <span className={styles.fileName}>{file.name}</span>
          {doc !== undefined && (
            <span className={styles.fileTitle}>
              {isOpen && docHref !== null ? (
                <a href={docHref} target="_blank" rel="noreferrer">
                  {doc.title}
                </a>
              ) : (
                doc.title
              )}
              {isOpen && <span className={styles.openBadge}>{t.library.openBadge}</span>}
            </span>
          )}
        </div>
        <span
          className={cx(
            styles.fileStatus,
            file.status === 'processed' ? styles.statusOk : styles.statusFailed,
          )}
        >
          {file.status === 'processed' ? t.library.statusProcessed : t.library.statusFailed}
        </span>
        <span className={styles.fileFacts}>{t.library.facts(file.factsCount)}</span>
      </li>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.folderBox}>
        <span className={styles.folderPath}>{library.data.folder}</span>
      </div>
      <Panel title={t.library.corpus} className={styles.corpusPanel}>
        <ul className={styles.countList}>
          {library.data.typeCounts.map((tc) => (
            <li key={tc.label} className={styles.countPill}>
              <span className={styles.countNumber}>{tc.count}</span> {tc.label}
            </li>
          ))}
        </ul>
      </Panel>
      <div className={styles.columns}>
        <Panel title={t.library.caseSources} bar className={styles.listPanel}>
          {caseFiles.length > 0 ? (
            <ul className={styles.fileList}>{caseFiles.map(renderFile)}</ul>
          ) : (
            <p className={styles.empty}>{t.library.empty}</p>
          )}
        </Panel>
        <Panel title={t.library.openSources} bar className={styles.listPanel}>
          {openFiles.length > 0 ? (
            <ul className={styles.fileList}>{openFiles.map(renderFile)}</ul>
          ) : (
            <p className={styles.empty}>{t.library.empty}</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
