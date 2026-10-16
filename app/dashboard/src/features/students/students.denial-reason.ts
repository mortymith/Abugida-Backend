/**
 * Denial-reason logic (spec 06 § S-4.6 — "A denial requires a reason, and
 * the student sees it").
 *
 * The spec: "Deny opens a required, bounded-select-plus-optional-note
 * dialog (reasons: course full, prerequisites not met, duplicate request,
 * not eligible for this cohort, other — add a note). A denial with no
 * reason is not submittable: the confirm button is disabled with
 * `aria-describedby` 'Choose a reason — the student sees this.'"
 */

export const DENIAL_REASONS = [
  'course_full',
  'prerequisites_not_met',
  'duplicate_request',
  'not_eligible',
  'other',
] as const

export type DenialReason = (typeof DENIAL_REASONS)[number]

export const DENIAL_REASON_LABELS: Record<DenialReason, string> = {
  course_full: 'Course full',
  prerequisites_not_met: 'Prerequisites not met',
  duplicate_request: 'Duplicate request',
  not_eligible: 'Not eligible for this cohort',
  other: 'Other — add a note',
}

/**
 * The aria-describedby text for the disabled confirm button. The spec:
 * "Choose a reason — the student sees this."
 */
export const DENIAL_REASON_REQUIRED_LABEL = 'Choose a reason — the student sees this.'

/**
 * Whether a denial reason requires a note. `other` requires a note; the
 * bounded reasons do not (the reason itself is the explanation).
 */
export function requiresNote(reason: DenialReason | null): boolean {
  return reason === 'other'
}

/**
 * Whether the deny dialog can be submitted. The spec: "A denial with no
 * reason is not submittable." `other` requires a non-empty note.
 */
export function canSubmitDenial(reason: DenialReason | null, note: string): boolean {
  if (reason === null) return false
  if (reason === 'other') {
    return note.trim().length > 0
  }
  return true
}

/**
 * The validation error for the deny dialog. Returns `null` when valid.
 */
export function validateDenial(reason: DenialReason | null, note: string): string | null {
  if (reason === null) {
    return DENIAL_REASON_REQUIRED_LABEL
  }
  if (reason === 'other' && note.trim().length === 0) {
    return 'A note is required when the reason is "Other".'
  }
  return null
}

/**
 * The denial message delivered to the student. The spec: "The reason is
 * delivered with the outcome, not filed silently."
 */
export function denialMessageForStudent(reason: DenialReason, note: string): string {
  const label = DENIAL_REASON_LABELS[reason]
  if (reason === 'other' && note.trim()) {
    return `Your enrollment request was denied: ${note.trim()}`
  }
  return `Your enrollment request was denied: ${label}.`
}
