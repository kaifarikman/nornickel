import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { api } from '@/api.ts'
import type { BoardResponse, RerunAction } from '@/contracts.ts'
import { refetchAll } from '@/components/QueryBoundary/QueryBoundary.tsx'
import { ErrorState, LoadingState } from '@/components/QueryState/QueryState.tsx'
import { RunPendingState } from '@/components/RunPendingState/RunPendingState.tsx'
import { useT } from '@/i18n/index.tsx'
import { useFactory } from '@/app/factory.tsx'
import { HypothesisCard } from '@/features/hypotheses/HypothesisCard/HypothesisCard.tsx'
import { RerunControls } from '@/features/hypotheses/RerunControls/RerunControls.tsx'
import styles from './HypothesisBoard.module.css'

interface BoardDiff {
  shifts: Record<string, number>
  changed: Set<string>
}

function diffBoards(prev: BoardResponse, next: BoardResponse): BoardDiff {
  const prevById = new Map(prev.hypotheses.map((h) => [h.id, h]))
  const shifts: Record<string, number> = {}
  const changed = new Set<string>()
  for (const hyp of next.hypotheses) {
    const before = prevById.get(hyp.id)
    if (before === undefined) {
      continue
    }
    const shift = before.rank - hyp.rank
    if (shift !== 0) {
      shifts[hyp.id] = shift
    }
    if (shift !== 0 || before.status !== hyp.status || before.score_total !== hyp.score_total) {
      changed.add(hyp.id)
    }
  }
  return { shifts, changed }
}

export function HypothesisBoard() {
  const t = useT()
  const { factory } = useFactory()
  const queryClient = useQueryClient()
  const [diff, setDiff] = useState<BoardDiff | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    if (!toastVisible) {
      return
    }
    const timer = setTimeout(() => setToastVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [toastVisible])

  const board = useQuery({ queryKey: ['board', factory], queryFn: () => api.getBoard(factory) })
  const extract = useQuery({ queryKey: ['extract'], queryFn: api.getExtract })

  const rerunMutation = useMutation({
    mutationFn: async (actions: RerunAction[]) => {
      let next: BoardResponse | null = null
      for (const action of actions) {
        next = await api.rerun(factory, action)
      }
      return next
    },
    onSuccess: (next) => {
      if (next === null || board.data === undefined || board.data === null) {
        return
      }
      setDiff(diffBoards(board.data, next))
      queryClient.setQueryData(['board', factory], next)
      setToastVisible(true)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => api.resetRun(factory),
    onSuccess: (next) => {
      setDiff(null)
      queryClient.setQueryData(['board', factory], next)
    },
  })

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
  const pending = rerunMutation.isPending || resetMutation.isPending
  const hypotheses = [...boardData.hypotheses].sort((a, b) => a.rank - b.rank)

  const controllableIds = new Set(
    extract.data.entities.filter((n) => n.tags.includes('controllable')).map((n) => n.id),
  )
  const excluded = new Set(boardData.kpi_contract.excluded_factors ?? [])

  const excludableFactor = (hyp: (typeof hypotheses)[number]): string | undefined =>
    hyp.source_nodes.find((id) => controllableIds.has(id) && !excluded.has(id))

  const handleExclude = (factorId: string) => {
    rerunMutation.mutate([{ kind: 'exclude_factor', payload: { factor_id: factorId } }])
  }

  return (
    <div className={styles.screen}>
      <h2 className="sr-only">{t.board.subtitle}</h2>
      <div className={styles.headRow}>
        <span className={styles.hashBadge}>
          <span className={styles.hashMono}>snapshot {boardData.snapshot.hash}</span>
          <span className={styles.hashLabel}>{t.board.hashBadge}</span>
        </span>
        {toastVisible && (
          <span className={styles.toast}>
            <Check size={14} aria-hidden="true" /> {t.board.recomputed}
          </span>
        )}
      </div>

      <RerunControls
        extract={extract.data}
        contract={boardData.kpi_contract}
        pending={pending}
        onApply={(actions) => rerunMutation.mutate(actions)}
        onParseText={(text) => api.parseConstraints(factory, text)}
        onReset={() => resetMutation.mutate()}
      />

      <div className={styles.list}>
        {hypotheses.map((hyp, index) => (
          <div key={hyp.id} className={styles.cardEnter} style={{ '--i': index } as CSSProperties}>
            <HypothesisCard
              hypothesis={hyp}
              contract={boardData.kpi_contract}
              entities={extract.data.entities}
              rankShift={diff?.shifts[hyp.id]}
              highlight={diff?.changed.has(hyp.id) ?? false}
              excludableFactorId={excludableFactor(hyp)}
              onExclude={handleExclude}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
