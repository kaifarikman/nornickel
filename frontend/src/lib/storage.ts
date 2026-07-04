/**
 * localStorage can throw (Safari private mode, disabled storage, quota).
 * These helpers swallow those failures so callers never crash on access.
 */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore: storage unavailable (e.g. Safari private mode)
  }
}
