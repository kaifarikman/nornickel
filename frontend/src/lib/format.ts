import type { Dict } from '@/i18n/dict.ts'

export type Units = Dict['units']

const NBSP = ' '
const NDASH = '–'

export function formatHypId(id: string): string {
  const match = /(\d+)$/.exec(id)
  if (match?.[1] === undefined) {
    return id
  }
  return `H-${match[1].slice(-2)}`
}

function groupDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

export function formatTons(value: number, units: Units): string {
  if (!Number.isFinite(value)) {
    return units.noData
  }
  return `${groupDigits(value)}${NBSP}${units.tons}`
}

export function formatUsd(value: number, units: Units): string {
  if (!Number.isFinite(value)) {
    return units.noData
  }
  if (value >= 1_000_000) {
    const mln = value / 1_000_000
    const digits = mln >= 100 ? 0 : mln >= 10 ? 1 : 2
    return `$${mln.toFixed(digits)}${NBSP}${units.mln}`
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}${NBSP}${units.thousand}`
  }
  return `$${groupDigits(value)}`
}

export function formatUsdRange(range: [number, number], units: Units): string {
  const [lo, hi] = range
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return units.noData
  }
  if (hi >= 1_000_000) {
    const loMln = lo / 1_000_000
    const hiMln = hi / 1_000_000
    const digits = hiMln >= 100 ? 0 : 2
    return `$${loMln.toFixed(digits)}${NDASH}${hiMln.toFixed(digits)}${NBSP}${units.mln}${units.perYear}`
  }
  return `${formatUsd(lo, units)}${NDASH}${formatUsd(hi, units).replace('$', '')}${units.perYear}`
}

export function formatUsdPerYear(value: number, units: Units): string {
  return `${formatUsd(value, units)}${units.perYear}`
}

export function formatPctRange(range: [number, number]): string {
  return `${range[0]}${NDASH}${range[1]}%`
}
