/**
 * Shared display formatters. Money and metrics use `tabular-nums` in the UI
 * (spec 11) — these helpers only produce strings; alignment is CSS.
 *
 * Money always carries the **currency code** (`ETB 12,430.00`), never a bare
 * symbol and never a bare number: spec 11 § Localization & Formatting treats the
 * code as the primary signal, with two decimals so a pasted figure is exact.
 */

export function formatCurrency(value: number | null | undefined, currency = 'ETB'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCompactCurrency(value: number | null | undefined, currency = 'ETB'): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    notation: value >= 100_000 ? 'compact' : 'standard',
    minimumFractionDigits: value >= 100_000 ? 1 : 2,
    maximumFractionDigits: value >= 100_000 ? 1 : 2,
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
