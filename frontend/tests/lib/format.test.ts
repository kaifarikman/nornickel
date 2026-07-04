import { describe, expect, it } from 'vitest'
import { formatHypId, formatPctRange, formatTons, formatUsd, formatUsdRange } from '@/lib/format.ts'
import { ru } from '@/i18n/ru.ts'

const u = ru.units

describe('format', () => {
  it('formats hypothesis ids', () => {
    expect(formatHypId('hyp_001')).toBe('H-01')
    expect(formatHypId('hyp_012')).toBe('H-12')
    expect(formatHypId('custom')).toBe('custom')
  })

  it('formats tons with grouped digits', () => {
    expect(formatTons(10392.3, u)).toMatch(/^10.392.т$/u)
    expect(formatTons(4794, u)).toMatch(/^4.794.т$/u)
  })

  it('formats usd magnitudes', () => {
    expect(formatUsd(123_750_000, u)).toMatch(/^\$124.млн$/u)
    expect(formatUsd(2_400_000, u)).toMatch(/^\$2\.40.млн$/u)
    expect(formatUsd(740_000, u)).toMatch(/^\$740.тыс\.$/u)
  })

  it('formats a usd range in millions per year', () => {
    expect(formatUsdRange([3955050, 11865150], u)).toMatch(/^\$3\.96–11\.87.млн\/год$/u)
  })

  it('formats percent ranges', () => {
    expect(formatPctRange([5, 15])).toBe('5–15%')
  })

  it('returns the no-data marker for non-finite values', () => {
    expect(formatUsd(NaN, u)).toBe(u.noData)
    expect(formatTons(NaN, u)).toBe(u.noData)
    expect(formatUsdRange([NaN, 5], u)).toBe(u.noData)
  })

  it('picks the тыс./млн magnitude by value', () => {
    expect(formatUsd(740_000, u)).toContain('тыс.')
    expect(formatUsd(123_750_000, u)).toContain('млн')
  })
})
