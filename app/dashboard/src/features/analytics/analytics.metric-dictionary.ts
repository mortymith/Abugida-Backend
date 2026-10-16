/**
 * Metric Dictionary constants + suppression logic (spec 07 § Metric
 * Definitions).
 *
 * The spec mandates a normative Metric Dictionary: every metric states
 * numerator, denominator, window, timezone, and inclusion rule. The
 * constants below are the named thresholds the spec calls out.
 *
 * The load-bearing rule: **a metric below `MIN_SAMPLE_SIZE = 5` renders
 * `—`, never a misleading percentage**, and carries the tooltip "Not
 * enough students for a reliable figure." `0%` always means "measured,
 * and nobody succeeded" — it is never a substitute for "too few to
 * measure."
 */

/** Minimum sample size for any student-count metric (spec 07 rule 2). */
export const MIN_SAMPLE_SIZE = 5

/** Minimum sample size for an insight to render (spec 07 S-5.1). */
export const MIN_INSIGHT_N = 5

/** At-risk threshold: no activity for 14+ days (spec 07 Metric Dictionary). */
export const AT_RISK_DAYS = 14

/** Funnel steep-drop threshold in percentage points (spec 07 S-5.3). */
export const FUNNEL_STEEP_DROP_PTS = 20

/** Quiz low-correct-rate threshold (spec 07 S-5.2). */
export const QUIZ_LOW_CORRECT_PCT = 50

/** Quiz too-easy threshold (spec 07 S-5.2). */
export const QUIZ_TOO_EASY_PCT = 95

/** Maximum courses per export (spec 07 S-5.4). */
export const MAX_EXPORT_COURSES = 25

/** Threshold for async export queueing: 1 MB (spec 07 S-5.4). */
export const EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES = 1_048_576

/** Export retention period: 7 days (spec 07 S-5.4). */
export const EXPORT_RETENTION_DAYS = 7

/** Analytics timezone (spec 07 Metric Dictionary — every metric uses this). */
export const ANALYTICS_TIMEZONE = 'Africa/Addis_Ababa'

/** Suppression tooltip text. */
export const SUPPRESSION_TOOLTIP = 'Not enough students for a reliable figure'

/** Suppressed value — what renders when `denominator < MIN_SAMPLE_SIZE`. */
export const SUPPRESSED_VALUE = '—'

/**
 * Whether a metric should be suppressed. Returns `true` when the
 * denominator is below `MIN_SAMPLE_SIZE`. The spec: "A metric with fewer
 * than 5 contributing students renders `—` with the tooltip, never a
 * percentage."
 */
export function shouldSuppress(denominator: number): boolean {
  return denominator < MIN_SAMPLE_SIZE
}

/**
 * Render a metric value, suppressing when the denominator is too small.
 * Returns `SUPPRESSED_VALUE` ('—') when suppressed, otherwise the
 * `displayValue`.
 */
export function renderMetric(displayValue: string, denominator: number): string {
  return shouldSuppress(denominator) ? SUPPRESSED_VALUE : displayValue
}

/**
 * Render a percentage metric, suppressing when the denominator is too
 * small. Returns '—' when suppressed, otherwise `${pct}%`.
 */
export function renderPercentage(numerator: number, denominator: number): string {
  if (shouldSuppress(denominator)) return SUPPRESSED_VALUE
  if (denominator === 0) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

/**
 * Render a percentage-point difference (for funnel drop-off), suppressing
 * when the denominator is too small. The spec: "labelled pts rather than
 * % so it cannot be misread."
 */
export function renderPercentagePoints(dropPct: number, denominator: number): string {
  if (shouldSuppress(denominator)) return SUPPRESSED_VALUE
  return `${dropPct} pts`
}

/**
 * Whether a funnel step-to-step decline exceeds the steep-drop threshold.
 * The spec: "⚠️ on any step-to-step decline greater than
 * `FUNNEL_STEEP_DROP_PTS = 20` percentage points."
 */
export function isSteepDrop(declinePts: number): boolean {
  return declinePts > FUNNEL_STEEP_DROP_PTS
}

/**
 * Whether a quiz question's correct rate is below the low-correct
 * threshold. The spec: "flags a question students get wrong more than
 * half the time."
 */
export function isLowCorrect(correctPct: number): boolean {
  return correctPct < QUIZ_LOW_CORRECT_PCT
}

/**
 * Whether a quiz question's correct rate is above the too-easy threshold.
 * The spec: "flags a question almost everyone gets right." The ambiguity
 * note: "A high correct rate may mean the question is ambiguous, not that
 * it is wrong."
 */
export function isTooEasy(correctPct: number): boolean {
  return correctPct >= QUIZ_TOO_EASY_PCT
}

/**
 * The too-easy ambiguity note. The spec: "High correct rate. If the
 * wording is ambiguous, students may be guessing correctly rather than
 * understanding."
 */
export const TOO_EASY_AMBIGUITY_NOTE =
  'High correct rate. If the wording is ambiguous, students may be guessing correctly rather than understanding.'

/**
 * Whether an insight should be rendered. The spec: "An insight displays
 * `n` whenever it is displayed at all; below `MIN_INSIGHT_N = 5` it is
 * not rendered rather than rendered without its sample size."
 */
export function shouldRenderInsight(n: number): boolean {
  return n >= MIN_INSIGHT_N
}
