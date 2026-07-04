export function safeHref(url: string | null): string | null {
  if (url === null) {
    return null
  }
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }
  } catch {
    return null
  }
  return null
}
