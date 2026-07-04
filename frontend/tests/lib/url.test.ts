import { describe, expect, it } from 'vitest'
import { safeHref } from '@/lib/url.ts'

describe('safeHref', () => {
  it('returns null for null input', () => {
    expect(safeHref(null)).toBeNull()
  })

  it('returns the normalized href for a valid https url', () => {
    expect(safeHref('https://ok.com/x')).toBe(new URL('https://ok.com/x').href)
  })

  it('preserves an http origin', () => {
    expect(safeHref('http://a.com')).toContain('http://a.com')
  })

  it('rejects javascript: urls', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
  })

  it('rejects data: urls', () => {
    expect(safeHref('data:text/html,x')).toBeNull()
  })

  it('rejects vbscript: urls', () => {
    expect(safeHref('vbscript:x')).toBeNull()
  })

  it('resolves protocol-relative urls to an absolute http(s) href', () => {
    const result = safeHref('//evil.com/x')
    expect(result).not.toBeNull()
    expect(result).toMatch(/^https?:\/\//)
    expect(result?.startsWith('//')).toBe(false)
  })

  it('does not throw on malformed input', () => {
    expect(() => safeHref('not a url ::: %%%')).not.toThrow()
  })
})
