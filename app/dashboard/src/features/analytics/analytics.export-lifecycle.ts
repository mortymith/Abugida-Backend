/**
 * S-5.4 Export job lifecycle logic (spec 07 § S-5.4 — async export).
 *
 * The spec: "an export under 1 MB downloads directly. At or over 1 MB it
 * becomes a queued job — the modal closes, a row appears in the Exports
 * list with its state, and completion is announced in-app. The download
 * link is valid for 7 days, then the state becomes Expired."
 *
 * States: Generating / Queued / Ready / Expired / Failed.
 *
 * Revenue is redacted server-side: a role without `finance.view_revenue`
 * can never produce a report containing revenue — the option is absent,
 * not disabled.
 */

import {
  EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES,
  EXPORT_RETENTION_DAYS,
  MAX_EXPORT_COURSES,
} from './analytics.metric-dictionary'

export type ExportJobState = 'generating' | 'queued' | 'ready' | 'expired' | 'failed'

export const EXPORT_JOB_STATE_LABELS: Record<ExportJobState, string> = {
  generating: 'Generating',
  queued: 'Queued',
  ready: 'Ready',
  expired: 'Expired',
  failed: 'Failed',
}

export interface ExportEstimate {
  readonly estimatedRows: number
  readonly estimatedSizeBytes: number
  readonly willQueue: boolean
  readonly label: string
}

/**
 * Compute the export row estimate. The spec: "A row estimate ('≈ 1,204
 * students × 24 items') is shown before generating so the user can narrow
 * the selection rather than queue a job they did not intend."
 *
 * Returns `willQueue: true` when the estimated size is at or over the 1 MB
 * threshold.
 */
export function computeExportEstimate(
  studentCount: number,
  itemCount: number,
  courseCount: number,
): ExportEstimate {
  const estimatedRows = studentCount * itemCount
  // Rough estimate: ~100 bytes per row in CSV, ~200 bytes in XLSX, ~300
  // bytes in PDF. Use 200 as a blended average.
  const estimatedSizeBytes = estimatedRows * 200
  const willQueue = estimatedSizeBytes >= EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES

  const studentNoun = studentCount === 1 ? 'student' : 'students'
  const itemNoun = itemCount === 1 ? 'item' : 'items'
  const courseNoun = courseCount === 1 ? 'course' : 'courses'

  let label: string
  if (willQueue) {
    const sizeMb = (estimatedSizeBytes / (1024 * 1024)).toFixed(1)
    label = `≈ ${studentCount.toLocaleString()} ${studentNoun} × ${itemCount} ${itemNoun} — about ${sizeMb} MB, over the 1 MB limit, so this will run as a queued job.`
  } else {
    label = `≈ ${studentCount.toLocaleString()} ${studentNoun} × ${itemCount} ${itemNoun} across ${courseCount} ${courseNoun}.`
  }

  return { estimatedRows, estimatedSizeBytes, willQueue, label }
}

/**
 * Whether the course selection exceeds the maximum. The spec: "Course
 * multi-select accepts at most `MAX_EXPORT_COURSES = 25`; the 26th
 * selection is refused inline."
 */
export function exceedsMaxCourses(selectedCount: number): boolean {
  return selectedCount > MAX_EXPORT_COURSES
}

/**
 * The inline refusal message for exceeding the course limit.
 */
export function maxCoursesRefusalMessage(): string {
  return `${MAX_EXPORT_COURSES} courses is the maximum for one export. Remove one to add another.`
}

/**
 * Compute the expiry date for a new export job. 7 days from `now`.
 */
export function computeExportExpiry(now: number): Date {
  return new Date(now + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Whether a Ready export has expired. The spec: "The download link is
 * valid for 7 days, then the state becomes Expired."
 */
export function isExportExpired(
  status: ExportJobState,
  expiresAt: number | null,
  now: number,
): boolean {
  if (status !== 'ready') return false
  if (expiresAt === null) return false
  return now >= expiresAt
}

/**
 * The expiry label for a Ready export. "Available for 7 days, until
 * {date}." or "Expired" when past.
 */
export function exportExpiryLabel(
  status: ExportJobState,
  expiresAt: number | null,
  now: number,
): string {
  if (status === 'expired') return 'This export has expired.'
  if (status !== 'ready' || expiresAt === null) return ''
  if (now >= expiresAt) return 'This export has expired.'

  const daysRemaining = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))
  if (daysRemaining === 0) return 'Available for less than 1 day.'
  if (daysRemaining === 1) return 'Available for 1 day.'
  return `Available for ${daysRemaining} days.`
}

/**
 * The "Queued" position label. The spec: "Queued — position 2 of 3.
 * We'll notify you in-app when it's ready."
 */
export function queuedPositionLabel(position: number, total: number): string {
  return `Queued — position ${position} of ${total}. We'll notify you in-app when it's ready.`
}

/**
 * The "Failed" label. The spec: "We couldn't finish this export — nothing
 * was shared."
 */
export const FAILED_LABEL = "We couldn't finish this export — nothing was shared."

/**
 * The "True empty" label. The spec: "a report type with no underlying
 * records offers 'Nothing to export for this selection' rather than
 * producing a zero-byte file."
 */
export const TRUE_EMPTY_LABEL = 'Nothing to export for this selection.'

// ── Revenue redaction ──────────────────────────────────────────────────────

/**
 * Whether the revenue report type should be shown. The spec: "A role
 * without `finance.view_revenue` sees no revenue report type, and a
 * crafted request returns a file with no revenue columns." The option is
 * **absent, not disabled**.
 */
export function shouldShowRevenueReportType(canViewRevenue: boolean): boolean {
  return canViewRevenue
}

/**
 * Whether the student-level data checkbox should be shown. The spec:
 * "Student-level data is gated by `students.read`; the checkbox is absent
 * without it."
 */
export function shouldShowStudentLevelCheckbox(canReadStudents: boolean): boolean {
  return canReadStudents
}

/**
 * The available report types for a user, with revenue redacted server-side.
 */
export function availableReportTypes(canViewRevenue: boolean): readonly string[] {
  const types = [
    'course_performance',
    'student_progress',
    'quiz_analytics',
    'cohort_comparison',
    'funnel',
  ]
  if (canViewRevenue) {
    return [...types, 'revenue_report']
  }
  return types
}
