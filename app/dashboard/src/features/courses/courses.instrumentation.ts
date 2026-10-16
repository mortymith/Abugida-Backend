/**
 * Instrumentation event vocabulary (spec 04 § Instrumentation &
 * acceptance, spec 11 § Observability).
 *
 * Every screen that ships an `Instrumentation & acceptance` block emits
 * named events with `{ id, count }` payloads. The spec is explicit:
 *
 * - **No PII.** Event payloads never include titles, names, emails, or
 *   any personally identifiable information.
 * - **No content.** Event payloads never include lesson bodies, quiz
 *   questions, or review comments — only counts and IDs.
 * - **`{ id, count }` shape.** Every event has an `id` (the entity
 *   public ID, opaque) and a `count` (a numeric metric relevant to the
 *   event).
 *
 * This module owns the event name vocabulary and the payload shape
 * validator. The React component calls `trackEvent` to emit; the
 * observability singleton (`@abugida/observability`) handles delivery.
 */

export const COURSE_INSTRUMENTATION_EVENTS = [
  // S-2.1 Course Catalog
  'course_catalog_viewed',
  'course_catalog_filtered',
  'course_catalog_bulk_publish_attempted',
  // S-2.6 Course Workspace — Overview
  'workspace_opened',
  'workspace_lifecycle_transitioned',
  // S-2.17 Course Workspace — Curriculum
  'curriculum_tree_loaded',
  'curriculum_item_created',
  'curriculum_item_reordered',
  'curriculum_item_published',
  'curriculum_item_unpublished',
  'curriculum_item_archived',
  'curriculum_item_deleted',
  'curriculum_bulk_action_completed',
  // S-2.18 Course Workspace — Students
  'course_roster_viewed',
  'course_student_enrolled',
  'course_student_unenrolled',
  // S-2.19 Course Workspace — Analytics
  'course_analytics_viewed',
  'course_analytics_tab_changed',
  // S-2.7 Lesson Editor
  'item_editor_opened',
  'item_editor_autosaved',
  'item_editor_flushed',
  'item_editor_conflict_resolved',
  // S-2.22 Publish Readiness & Course Review
  'publish_readiness_viewed',
  'course_submitted_for_review',
  'course_review_decided',
  'course_published',
  'course_unpublished',
  'course_archived',
  'course_restored',
  'course_version_restored',
] as const

export type CourseInstrumentationEvent = (typeof COURSE_INSTRUMENTATION_EVENTS)[number]

export interface InstrumentationPayload {
  readonly id: string // entity public ID (opaque, no PII)
  readonly count?: number // optional numeric metric
  readonly [key: string]: unknown
}

/**
 * Validate that an instrumentation payload conforms to the spec:
 * - `id` is a non-empty string (the entity public ID).
 * - No PII keys (`title`, `name`, `email`, `body`, `comment`, `content`).
 * - No content keys that would leak lesson/quiz/review content.
 *
 * Returns `null` when valid, or an error message describing the violation.
 */
const FORBIDDEN_KEYS = new Set([
  'title',
  'name',
  'email',
  'body',
  'comment',
  'content',
  'description',
  'question',
  'answer',
  'password',
  'token',
  'secret',
])

export function validatePayload(payload: InstrumentationPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0) {
    return 'Instrumentation payload must have a non-empty string `id`'
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `Instrumentation payload must not include key "${key}" (PII or content leak)`
    }
  }
  if (payload.count !== undefined && typeof payload.count !== 'number') {
    return 'Instrumentation payload `count` must be a number'
  }
  return null
}

/**
 * Track an instrumentation event. Validates the payload and delegates to
 * the observability singleton. A validation failure is logged but does
 * not throw — instrumentation must never break the user flow.
 *
 * The caller passes a `send` function that the observability singleton
 * owns; this keeps the module framework-free.
 */
export function trackEvent(
  event: CourseInstrumentationEvent,
  payload: InstrumentationPayload,
  send: (event: string, payload: InstrumentationPayload) => void,
): void {
  const error = validatePayload(payload)
  if (error !== null) {
    // Log the validation error but do not throw. Instrumentation must
    // never break the user flow; a mis-shaped event is a developer bug
    // to fix, not a user-facing failure.
    console.warn(`[instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}

// ── Performance budgets ────────────────────────────────────────────────────
//
// The spec pins performance budgets for several screens. These are the
// thresholds the instrumentation layer measures against; a breach is
// logged as a warning (not an error) so the team can investigate without
// paging.

export const PERFORMANCE_BUDGETS: Readonly<Record<string, number>> = {
  // First paint / hydration budgets (ms)
  course_catalog_first_paint: 1500,
  course_catalog_filter_requery: 400,
  workspace_first_paint: 1500,
  curriculum_tree_500_items_render: 1000,
  lesson_editor_200k_char_hydrate: 1500,
  lesson_editor_inp: 200,
  publish_readiness_evaluate: 1000,
}

/**
 * Whether a measured duration breaches the budget for `metric`. The
 * caller logs a warning on breach; the instrumentation event carries
 * `over_budget: true` so the dashboard can filter to slow sessions.
 */
export function breachesBudget(metric: string, durationMs: number): boolean {
  const budget = PERFORMANCE_BUDGETS[metric]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (budget === undefined) return false
  return durationMs > budget
}
