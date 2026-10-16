/**
 * Analytics instrumentation event vocabulary (spec 07 § Instrumentation &
 * acceptance, spec 11 § Observability).
 *
 * Every screen in Part 07 ships an `Instrumentation & acceptance` block.
 * The spec is explicit: "IDs, counts, and ranges only — no names." No
 * student names, no handles, no emails, no quiz text, no tag values in
 * any event property.
 */

export const ANALYTICS_INSTRUMENTATION_EVENTS = [
  // S-5.1 Course Performance
  'course_performance_viewed',
  'insight_shown',
  'insight_action_taken',
  'chart_table_toggled',
  'period_compare_toggled',
  // S-5.2 Quiz Analytics
  'quiz_analytics_viewed',
  'question_expanded',
  'question_revise_clicked',
  'distractor_appended',
  'quiz_analytics_exported',
  // S-5.3 Drop-off Analysis
  'funnel_viewed',
  'funnel_step_opened',
  'funnel_heatmap_opened',
  'funnel_exported',
  // S-5.4 Export Reports
  'export_configured',
  'export_generated',
  'export_downloaded',
  'export_expired',
  'export_retry_clicked',
  // S-5.5 Cohort Comparison
  'cohort_comparison_viewed',
  'cohort_added',
  'cohort_removed',
  'cohort_comparison_exported',
] as const

export type AnalyticsInstrumentationEvent = (typeof ANALYTICS_INSTRUMENTATION_EVENTS)[number]

export interface AnalyticsInstrumentationPayload {
  readonly id: string
  readonly count?: number
  readonly [key: string]: unknown
}

const FORBIDDEN_KEYS = new Set([
  'name',
  'studentName',
  'displayName',
  'handle',
  'telegramHandle',
  'email',
  'phone',
  'phoneNumber',
  'address',
  'body',
  'text',
  'messageText',
  'content',
  'questionText',
  'answer',
  'correctAnswer',
  'studentAnswer',
  'tag',
  'tags',
  'tagValue',
  'subject',
  'note',
  'reason',
])

export function validateAnalyticsPayload(payload: AnalyticsInstrumentationPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0) {
    return 'Analytics instrumentation payload must have a non-empty string `id`'
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `Analytics instrumentation payload must not include key "${key}" (PII or content leak)`
    }
  }
  if (payload.count !== undefined && typeof payload.count !== 'number') {
    return 'Analytics instrumentation payload `count` must be a number'
  }
  return null
}

export function trackAnalyticsEvent(
  event: AnalyticsInstrumentationEvent,
  payload: AnalyticsInstrumentationPayload,
  send: (event: string, payload: AnalyticsInstrumentationPayload) => void,
): void {
  const error = validateAnalyticsPayload(payload)
  if (error !== null) {
    console.warn(`[analytics-instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}

export const ANALYTICS_PERFORMANCE_BUDGETS: Readonly<Record<string, number>> = {
  course_performance_lcp: 2500,
  course_performance_range_requery: 1000,
  course_performance_data_table: 300,
  quiz_analytics_lcp: 2500,
  quiz_analytics_expand: 300,
  funnel_lcp: 2500,
  funnel_repaint: 1000,
  export_config_form_interactive: 1000,
  export_row_estimate: 400,
  export_direct_download: 2000,
  export_queued_announce: 60_000,
  cohort_comparison_lcp: 2500,
  cohort_comparison_reflow: 1000,
} as const

export function breachesAnalyticsBudget(metric: string, durationMs: number): boolean {
  const budget = (ANALYTICS_PERFORMANCE_BUDGETS as Record<string, number>)[metric]
  if (!budget) return false
  return durationMs > budget
}
