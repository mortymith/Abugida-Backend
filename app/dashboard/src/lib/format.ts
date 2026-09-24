/**
 * Shared display formatters. Money and metrics use `tabular-nums` in the UI
 * (spec 11) — these helpers only produce strings; alignment is CSS.
 */

export function formatCurrency(value: number | null | undefined, currency = 'ETB'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value)
}

export function formatCompactCurrency(value: number | null | undefined, currency = 'ETB'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value)
}

export function formatInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(Math.round(value * 10 ** fractionDigits) / 10 ** fractionDigits).toFixed(fractionDigits)}%`
}

export function formatRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(1)
}
