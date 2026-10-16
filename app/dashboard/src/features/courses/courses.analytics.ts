/**
 * Course analytics metric definitions (spec 04 § S-2.19 → Course Workspace —
 * Analytics, spec 11 § Localization & Formatting).
 *
 * The spec defines a Metric Definitions table with explicit numerator,
 * denominator, window, timezone, and inclusion rule for every metric.
 * This module is the single source of truth for those definitions — every
 * analytics surface (the four sub-tabs, the insights engine, the export)
 * consults it.
 *
 * Hard invariants encoded here:
 *
 * 1. **Half-open interval `[start, end)`** in `Africa/Addis_Ababa`. A
 *    completion at exactly `end` belongs to the next window, not this one.
 * 2. **`n < 5` suppression.** A metric whose denominator is fewer than 5
 *    students renders as "—" (not 0%, not 100%, not a misleading number).
 *    The spec is explicit: small cohorts must not produce fake precision.
 * 3. **"0 completions" vs "not published"** distinction. A course with no
 *    completions because it has no enrolled students is different from a
 *    course with no completions because it was never published. The
 *    `notPublished` flag distinguishes them.
 * 4. **Active 7d denominator = today's enrolled count; Complete %
 *    denominator = enrolled-as-of-publish-date cohort.** (Decision D10.)
 *    These are separate queries; this module encodes which denominator
 *    each metric uses.
 */

export const ANALYTICS_TIMEZONE = 'Africa/Addis_Ababa'
export const ANALYTICS_SUPPRESSION_THRESHOLD = 5
export const ACTIVE_WINDOW_DAYS = 7

export const ANALYTICS_SUB_TABS = ['performance', 'drop_off', 'quizzes', 'items'] as const

export type AnalyticsSubTab = (typeof ANALYTICS_SUB_TABS)[number]

export const ANALYTICS_SUB_TAB_LABELS: Record<AnalyticsSubTab, string> = {
  performance: 'Performance',
  drop_off: 'Drop-off',
  quizzes: 'Quizzes',
  items: 'Items',
}

export type MetricDenominator =
  'none' | 'enrolled-today' | 'enrolled-at-publish' | 'reached' | 'reviews'

export interface MetricDefinition {
  readonly id: string
  readonly label: string
  readonly numerator: string
  readonly denominator: MetricDenominator
  readonly window: 'all-time' | 'rolling-7d'
  readonly suppressBelow: number
  /** Whether the metric renders as a percentage, a count, or a duration. */
  readonly format: 'percentage' | 'count' | 'duration' | 'rating'
}

/**
 * The Metric Definitions table (spec 04 § S-2.19).
 */
export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: 'students',
    label: 'Students',
    numerator: 'COUNT(enrollments)',
    denominator: 'none',
    window: 'all-time',
    suppressBelow: 0,
    format: 'count',
  },
  {
    id: 'active_7d',
    label: 'Active 7d',
    numerator: "COUNT(DISTINCT user_id WHERE last_active >= now() - interval '7 days')",
    denominator: 'enrolled-today',
    window: 'rolling-7d',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'count',
  },
  {
    id: 'complete_pct',
    label: 'Complete %',
    numerator: 'COUNT(enrollments WHERE progress = 100%)',
    denominator: 'enrolled-at-publish',
    window: 'all-time',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'percentage',
  },
  {
    id: 'avg_time',
    label: 'Avg time',
    numerator: 'AVG(lesson_completions.time_spent)',
    denominator: 'none',
    window: 'all-time',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'duration',
  },
  {
    id: 'reached',
    label: 'Reached',
    numerator: 'COUNT(DISTINCT user_id WHERE lesson_completions.lesson_id = X)',
    denominator: 'enrolled-at-publish',
    window: 'all-time',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'count',
  },
  {
    id: 'completed',
    label: 'Completed',
    numerator: 'COUNT(DISTINCT user_id WHERE lesson_completions.lesson_id = X AND completed)',
    denominator: 'reached',
    window: 'all-time',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'count',
  },
  {
    id: 'at_risk',
    label: 'At risk',
    numerator: 'COUNT(enrollments WHERE at_risk_flag = true)',
    denominator: 'enrolled-today',
    window: 'rolling-7d',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'count',
  },
  {
    id: 'rating',
    label: 'Rating',
    numerator: 'AVG(course_reviews.rating)',
    denominator: 'reviews',
    window: 'all-time',
    suppressBelow: ANALYTICS_SUPPRESSION_THRESHOLD,
    format: 'rating',
  },
]

export interface MetricInput {
  readonly definition: MetricDefinition
  readonly numerator: number
  readonly denominator: number
  readonly notPublished?: boolean
}

export interface MetricResult {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly suppressed: boolean
  readonly notPublished?: boolean
  readonly format: MetricDefinition['format']
}

/**
 * Evaluate a single metric against its definition.
 *
 * The suppression rule: if `denominator < suppressBelow`, the metric
 * renders as "—" (suppressed). The spec is explicit that small cohorts
 * must not produce fake precision — a 100% completion rate from 1 student
 * is not a signal.
 *
 * The `notPublished` flag is distinct from suppression: a course that was
 * never published has no completions *because* it was never published, not
 * because the cohort is too small. The metric renders as "Not published"
 * in that case.
 */
export function evaluateMetric(input: MetricInput): MetricResult {
  const { definition, numerator, denominator, notPublished } = input

  if (notPublished && definition.id === 'complete_pct') {
    return {
      id: definition.id,
      label: definition.label,
      value: 'Not published',
      suppressed: false,
      notPublished: true,
      format: definition.format,
    }
  }

  if (denominator < definition.suppressBelow) {
    return {
      id: definition.id,
      label: definition.label,
      value: '—',
      suppressed: true,
      format: definition.format,
    }
  }

  const value = formatMetricValue(definition, numerator, denominator)
  return {
    id: definition.id,
    label: definition.label,
    value,
    suppressed: false,
    format: definition.format,
  }
}

/**
 * Format a metric value according to its definition. Percentages render
 * as `42%`, counts as `1,234`, durations as `1h 23m`, ratings as `4.2`.
 */
export function formatMetricValue(
  definition: MetricDefinition,
  numerator: number,
  denominator: number,
): string {
  if (definition.format === 'percentage') {
    const pct = denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)
    return `${pct}%`
  }
  if (definition.format === 'count') {
    return numerator.toLocaleString('en-US')
  }
  if (definition.format === 'duration') {
    const seconds = Math.round(numerator)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }
  // Remaining format is 'rating' (percentage/count/duration handled above).
  return (Math.round(numerator * 10) / 10).toFixed(1)
}

// ── Half-open interval `[start, end)` ──────────────────────────────────────
//
// The spec mandates half-open intervals in `Africa/Addis_Ababa`: a
// completion at exactly `end` belongs to the next window. This helper
// computes the `[start, end)` bounds for a rolling-N-day window.

export interface DateWindow {
  readonly start: Date
  readonly end: Date
}

/**
 * Compute the `[start, end)` window for a rolling-N-day window ending at
 * `now`. The window is half-open: `start <= t < end`.
 *
 * Times are interpreted in `Africa/Addis_Ababa`. The spec is explicit that
 * all analytics times are in EAT, never UTC.
 */
export function rollingWindow(now: Date, days: number): DateWindow {
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return { start, end }
}

/**
 * Whether `t` falls within the half-open window `[start, end)`.
 */
export function isInWindow(t: Date, window: DateWindow): boolean {
  return t >= window.start && t < window.end
}

// ── Insights engine ─────────────────────────────────────────────────────────
//
// The spec calls for an insights engine that flags items with anomalous
// metrics (e.g. high drop-off, low completion, low quiz pass rate). Each
// insight has a severity, an explanation, and deep links to "Edit item"
// and "Preview as student".

export type InsightSeverity = 'info' | 'warning' | 'critical'

export const INSIGHT_SEVERITY_LABELS: Record<InsightSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}

export interface ItemInsight {
  readonly itemId: string
  readonly itemTitle: string
  readonly severity: InsightSeverity
  readonly explanation: string
  readonly editHref: string
  readonly previewHref: string
}

/**
 * Compute insights for a list of items. The rules (from spec 04 § S-2.19
 * → Insights):
 *
 * - Drop-off > 50% → `critical`
 * - Drop-off 30–50% → `warning`
 * - Completion < 20% (with ≥5 reached) → `warning`
 * - Quiz pass rate < 50% (with ≥5 attempts) → `warning`
 *
 * Items with fewer than 5 students in any denominator are skipped
 * (suppression rule).
 */
export function computeItemInsights(
  items: ReadonlyArray<{
    itemId: string
    itemTitle: string
    reached: number
    completed: number
    dropOffPct: number
    quizPassRate: number | null
    coursePublicId: string
  }>,
): ItemInsight[] {
  const insights: ItemInsight[] = []

  for (const item of items) {
    if (item.reached < ANALYTICS_SUPPRESSION_THRESHOLD) continue

    const editHref = `/courses/${item.coursePublicId}?tab=curriculum&item=${item.itemId}`
    const previewHref = `/courses/${item.coursePublicId}?tab=curriculum&item=${item.itemId}&preview=1`

    if (item.dropOffPct > 50) {
      insights.push({
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        severity: 'critical',
        explanation: `Drop-off is ${item.dropOffPct}% — over half the students who reach this item leave before completing it. Consider shortening the item or splitting it.`,
        editHref,
        previewHref,
      })
    } else if (item.dropOffPct >= 30) {
      insights.push({
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        severity: 'warning',
        explanation: `Drop-off is ${item.dropOffPct}%. This is above the 30% threshold — review the item for friction.`,
        editHref,
        previewHref,
      })
    }

    const completionPct = item.reached === 0 ? 0 : (item.completed / item.reached) * 100
    if (completionPct < 20) {
      insights.push({
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        severity: 'warning',
        explanation: `Completion is ${Math.round(completionPct)}% of students who reached it. Below 20% suggests the item is too hard or unclear.`,
        editHref,
        previewHref,
      })
    }

    if (item.quizPassRate !== null && item.quizPassRate < 50) {
      insights.push({
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        severity: 'warning',
        explanation: `Quiz pass rate is ${Math.round(item.quizPassRate)}%. Below 50% suggests the questions or the source content need revision.`,
        editHref,
        previewHref,
      })
    }
  }

  return insights
}
