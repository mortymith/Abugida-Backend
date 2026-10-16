/**
 * Students instrumentation event vocabulary (spec 06 § Instrumentation &
 * acceptance, spec 11 § Observability).
 *
 * Every screen in Part 06 ships an `Instrumentation & acceptance` block.
 * The spec is explicit about hard invariants:
 *
 * 1. **No PII.** Event payloads never include student names, handles,
 *    emails, phone numbers, or any personally identifiable information.
 * 2. **No content.** Event payloads never include message text, tag
 *    values, badge note text, or denial notes. Only IDs, counts, reason
 *    codes, and ranges.
 *
 * The `{ id, count }` shape is the universal payload.
 */

export const STUDENTS_INSTRUMENTATION_EVENTS = [
  // S-4.1 Student Directory
  'students_export_requested',
  'students_export_completed',
  'enrollment_invite_created',
  'enrollment_invite_claimed',
  // S-4.2 Student Profile
  'student_profile_viewed',
  'student_metadata_saved',
  'student_archived',
  'student_restored',
  // S-4.3 Student Progress Dashboard
  'student_progress_viewed',
  'student_progress_range_changed',
  'student_progress_exported',
  // S-4.4 Cohort Management
  'cohort_viewed',
  'cohort_created',
  'cohort_student_added',
  'cohort_student_removed',
  'cohort_send_started',
  // S-4.5 Messaging Center
  'message_sent',
  'message_delivery_failed',
  'message_read',
  'broadcast_blocked',
  'message_purged',
  // S-4.6 Enrollment Requests / Waitlist
  'enrollment_request_approved',
  'enrollment_request_denied',
  'enrollment_bulk_approve',
  'waitlist_auto_promoted',
  'enrollment_delivery_failed',
  // S-4.7 Badges & Achievements
  'badge_created',
  'badge_dry_run',
  'badge_evaluation_run',
  'badge_awarded',
  'badge_paused',
  'badge_archived',
  'badge_revoked',
  'badge_delivery_failed',
  // S-4.8 Automated Enrollment Rules
  'rule_created',
  'rule_dry_run',
  'rule_saved',
  'rule_cycle_rejected',
  'rule_sweep_run',
  'rule_deferred',
] as const

export type StudentsInstrumentationEvent = (typeof STUDENTS_INSTRUMENTATION_EVENTS)[number]

export interface StudentsInstrumentationPayload {
  readonly id: string // entity public ID (opaque, no PII)
  readonly count?: number // optional numeric metric
  readonly [key: string]: unknown
}

/**
 * Keys forbidden in any students instrumentation payload because they
 * carry PII or content. The spec: "No student names, handles, or
 * addresses. No message text, no tag values, no note text."
 */
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
  'note',
  'decisionNote',
  'tag',
  'tags',
  'tagValue',
  'reason', // reasonCode is allowed; free-text reason is not
  'subject',
])

/**
 * Validate that a students instrumentation payload conforms to the spec.
 * Returns `null` when valid, or an error message describing the violation.
 */
export function validateStudentsPayload(payload: StudentsInstrumentationPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0) {
    return 'Students instrumentation payload must have a non-empty string `id`'
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `Students instrumentation payload must not include key "${key}" (PII or content leak)`
    }
  }
  if (payload.count !== undefined && typeof payload.count !== 'number') {
    return 'Students instrumentation payload `count` must be a number'
  }
  return null
}

/**
 * Track a students instrumentation event. Validates the payload and
 * delegates to the `send` callback. A validation failure is logged but
 * does not throw — instrumentation must never break the user flow.
 */
export function trackStudentsEvent(
  event: StudentsInstrumentationEvent,
  payload: StudentsInstrumentationPayload,
  send: (event: string, payload: StudentsInstrumentationPayload) => void,
): void {
  const error = validateStudentsPayload(payload)
  if (error !== null) {
    console.warn(`[students-instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}

// ── Performance budgets ────────────────────────────────────────────────────

export const STUDENTS_PERFORMANCE_BUDGETS: Readonly<Record<string, number>> = {
  // S-4.1 Directory
  directory_lcp_25_rows: 1500,
  directory_filter_sort_requery: 400,
  // S-4.3 Progress
  progress_lcp: 2500,
  progress_course_chart_render: 600,
  progress_data_table_on_demand: 200,
  // S-4.5 Messaging
  messaging_thread_list_interactive: 500,
  messaging_send_optimistic: 200,
  // S-4.7 Badges
  badges_grid_interactive: 500,
  badges_dry_run: 2000,
  // S-4.8 Rules
  rules_list_interactive: 500,
  rules_dry_run: 2000,
  rules_cycle_detection: 100,
} as const

export function breachesStudentsBudget(metric: string, durationMs: number): boolean {
  const budget = (STUDENTS_PERFORMANCE_BUDGETS as Record<string, number>)[metric]
  if (!budget) return false
  return durationMs > budget
}
