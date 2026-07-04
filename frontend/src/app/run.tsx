import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Element, FactoryId } from '@/contracts.ts'
import { ELEMENTS } from '@/lib/domain.ts'

export interface RunParams {
  element: Element
  price: number
  capexLimit: number
}

export function parseRunParams(state: unknown): RunParams | null {
  if (typeof state !== 'object' || state === null) {
    return null
  }
  const s = state as Record<string, unknown>
  if (
    ELEMENTS.includes(s['element'] as Element) &&
    typeof s['price'] === 'number' &&
    Number.isFinite(s['price']) &&
    typeof s['capexLimit'] === 'number'
  ) {
    return { element: s['element'] as Element, price: s['price'], capexLimit: s['capexLimit'] }
  }
  return null
}

const STORAGE_KEY = 'hf-runs'

interface RunContextValue {
  hasRun: (factory: FactoryId) => boolean
  markRun: (factory: FactoryId) => void
  clearRun: (factory: FactoryId) => void
}

const RunContext = createContext<RunContextValue | null>(null)

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function RunProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Record<string, boolean>>(readStored)

  const persist = useCallback((next: Record<string, boolean>) => {
    setRuns(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const value = useMemo<RunContextValue>(
    () => ({
      hasRun: (factory) => runs[factory] === true,
      markRun: (factory) => persist({ ...runs, [factory]: true }),
      clearRun: (factory) => {
        const next = Object.fromEntries(Object.entries(runs).filter(([key]) => key !== factory))
        persist(next)
      },
    }),
    [runs, persist],
  )

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext)
  if (ctx === null) {
    throw new Error('useRun must be used within RunProvider')
  }
  return ctx
}
