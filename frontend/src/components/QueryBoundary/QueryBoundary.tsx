import type { UseQueryResult } from '@tanstack/react-query'

export function refetchAll(queries: UseQueryResult[]): void {
  void Promise.all(queries.map((q) => q.refetch()))
}
