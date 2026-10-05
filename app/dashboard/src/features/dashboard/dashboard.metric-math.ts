/**
 * Pure arithmetic for the S-1.1 / S-1.2 stat cards.
 *
 * Kept out of the impl modules and the components so the rule the spec is most
 * explicit about — *a delta without history renders `—`, never `0%`* — is
 * testable without a database, a component tree, or a browser.
 */

/**
 * Minimum contributing records before a percentage change is believable
 * (spec S-1.1: `MIN_SAMPLE_SIZE = 5`).
 *
 * Below this, a delta is noise, and rendering it as a number would be a claim
 * the data cannot support. `0%` is reserved for "measured, unchanged".
 */
export const MIN_SAMPLE_SIZE = 5

export interface ComparisonInput {
  /** Value for the selected range. */
  current: number
  /** Value for the comparison period. */
  previous: number
  /** Contributing records in the **comparison** period. */
  previousSample: number
}

/**
 * Percentage change against the comparison period, or `null` when the delta
 * must render as `—`.
 *
 * `null` when: either value is not finite, or the comparison period has fewer
 * than {@link MIN_SAMPLE_SIZE} contributing records. A previous value of zero
 * with a non-zero current is likewise `null` — "up from nothing" is not a
 * percentage — while zero against zero is a real `0`.
 */
export function comparisonDelta({
  current,
  previous,
  previousSample,
}: ComparisonInput): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previousSample < MIN_SAMPLE_SIZE) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** `+23%` / `−4.5%` — the format the stat card and the CSV export share. */
export function formatDelta(deltaPct: number | null): string {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  const magnitude = Math.abs(deltaPct)
  const rounded = magnitude >= 10 ? Math.round(magnitude) : Math.round(magnitude * 10) / 10
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : ''
  return `${sign}${rounded}%`
}

/** "vs previous 30 days" → the short form printed under a delta. */
export function shortComparisonLabel(comparisonLabel: string): string {
  return `vs ${comparisonLabel.replace(/^previous /, 'prev ')}`
}
