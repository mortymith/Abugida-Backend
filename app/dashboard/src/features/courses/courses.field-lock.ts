/**
 * The Field Lock Table (spec 04 § Field Lock Table).
 *
 * "The single source of truth for what is editable in which course state. Every
 * screen's prose about editability must agree with this table; where a screen
 * and this table disagree, this table wins."
 *
 * Framework-free on purpose: this is data plus a resolver, so the identity
 * header, the item pane, the curriculum tree, and the settings sections all
 * consult one implementation and cannot drift into disagreeing about whether a
 * field is editable in, say, an Approved course.
 *
 * It encodes the **three-case permission rule** from spec 04 § Workspace Model:
 *
 * 1. Out of capability  → `absent`   (the control does not render at all)
 * 2. Blocked by state   → `disabled` (rendered, with the reason in a tooltip
 *                                    *and* `aria-describedby`)
 * 3. Editable but live  → `confirm`  (editable behind an S-7.1 confirmation
 *                                    stating the student-visible effect)
 *
 * Case 2 is never a silent no-op and case 3 is never a hidden field.
 */
import type { CourseLifecycleState } from './courses.workspace'

// ── The three render modes ──────────────────────────────────────────────────

export const FIELD_LOCK_MODES = ['absent', 'disabled', 'confirm', 'editable'] as const

export type FieldLockMode = (typeof FIELD_LOCK_MODES)[number]

// ── Title length (spec 04 § S-2.6 validation) ──────────────────────────────
//
// "3–300 characters measured in **grapheme clusters**." The unit matters: a
// title is counted the way a reader counts it, so Ethiopic — which composes a
// syllable from several code points — is not rejected for being "too long" when
// it is in fact short. A code-unit count (`title.length`) would undercount
// Amharic and accept an overlong Latin title.

/** Minimum title length in grapheme clusters (`RC-1`/S-2.6). */
export const COURSE_TITLE_MIN_GRAPHEMES = 3
/** Maximum title length in grapheme clusters (S-2.6). */
export const COURSE_TITLE_MAX_GRAPHEMES = 300

/**
 * Count grapheme clusters, falling back to code points where `Intl.Segmenter`
 * is unavailable (older Node/bun). The fallback is deliberately the *lower*
 * bound: a segmenter-less environment counts more, so it errs toward rejecting
 * an overlong title rather than accepting one.
 */
export function countGraphemes(value: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    let count = 0
    for (const _ of segmenter.segment(value)) count += 1
    return count
  }
  return [...value].length
}

/** Validate a title against the S-2.6 bounds. `null` when it is acceptable. */
export function validateCourseTitle(value: string): string | null {
  const length = countGraphemes(value.trim())
  if (length < COURSE_TITLE_MIN_GRAPHEMES) {
    return `A title needs at least ${COURSE_TITLE_MIN_GRAPHEMES} characters.`
  }
  if (length > COURSE_TITLE_MAX_GRAPHEMES) {
    return `A title can be at most ${COURSE_TITLE_MAX_GRAPHEMES} characters.`
  }
  return null
}

/** How a field renders in one course state. */
export interface FieldLockRule {
  mode: FieldLockMode
  /**
   * Why the field is disabled or why editing needs a confirmation. Always set
   * for `disabled` (case 2 requires a stated reason) and optional for
   * `confirm`. Never rendered for `editable` or `absent`.
   */
  reason?: string
  /** How a `confirm` field's dialog must be titled. */
  confirmTitle?: string
}

// ── Field identifiers ───────────────────────────────────────────────────────
//
// Named after the owning entity + field so a call site reads as the spec's
// table does rather than as a string literal nobody can look up.

export const FIELD_LOCK_FIELDS = [
  'course.title',
  'course.slug',
  'course.details',
  'course.content_language',
  'course.pricing',
  'course.requires_approval',
  'section.metadata',
  'item.title',
  'item.body',
  'item.unlock_rules',
  'item.visibility',
  'course.lifecycle',
] as const

export type FieldLockField = (typeof FIELD_LOCK_FIELDS)[number]

const EDITABLE: FieldLockRule = { mode: 'editable' }
const READ_ONLY: FieldLockRule = {
  mode: 'disabled',
  reason: 'Archived — restore the course to make changes',
}

const IN_REVIEW_LOCK = 'In review — withdraw to edit'
const APPROVED_LOCK = 'Approved — editing clears the approval'

/**
 * The table itself, keyed `[field][state]`. Every cell is explicit: a missing
 * cell would be an implicit "editable", and an implicit default is exactly how
 * a lock gets forgotten when a lifecycle state is added.
 */
const FIELD_LOCK_TABLE: Record<FieldLockField, Record<CourseLifecycleState, FieldLockRule>> = {
  'course.title': {
    draft: EDITABLE,
    in_review: EDITABLE,
    // Editing a reviewed course would invalidate the approval, so the control
    // is present but explains itself rather than silently reverting on commit.
    approved: { mode: 'disabled', reason: APPROVED_LOCK },
    published: {
      mode: 'confirm',
      reason: 'Students see this title immediately',
      confirmTitle: 'Rename a live course?',
    },
    archived: READ_ONLY,
  },
  'course.slug': {
    draft: EDITABLE,
    in_review: { mode: 'disabled', reason: 'Slugs are frozen while in review' },
    approved: { mode: 'disabled', reason: 'Slugs are frozen once approved' },
    published: { mode: 'disabled', reason: 'Frozen at first publish — inbound links depend on it' },
    archived: READ_ONLY,
  },
  'course.details': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    published: EDITABLE,
    archived: READ_ONLY,
  },
  'course.content_language': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    published: {
      mode: 'confirm',
      reason: 'Existing items keep their own language',
      confirmTitle: 'Change the default content language?',
    },
    archived: READ_ONLY,
  },
  'course.pricing': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    published: {
      mode: 'confirm',
      reason: 'Students who already paid keep their access',
      confirmTitle: 'Change pricing on a live course?',
    },
    archived: READ_ONLY,
  },
  // Admin-only regardless of state (the lifecycle row below handles the
  // transitions themselves); see `capabilities.ts` for the role half.
  'course.requires_approval': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    published: EDITABLE,
    archived: READ_ONLY,
  },
  'section.metadata': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    published: EDITABLE,
    archived: READ_ONLY,
  },
  'item.title': {
    draft: EDITABLE,
    in_review: { mode: 'disabled', reason: IN_REVIEW_LOCK },
    approved: { mode: 'disabled', reason: APPROVED_LOCK },
    published: { mode: 'confirm', reason: 'Students see this title immediately' },
    archived: READ_ONLY,
  },
  'item.body': {
    draft: EDITABLE,
    in_review: { mode: 'disabled', reason: IN_REVIEW_LOCK },
    approved: { mode: 'disabled', reason: APPROVED_LOCK },
    published: { mode: 'confirm', reason: 'This changes a live lesson' },
    archived: READ_ONLY,
  },
  'item.unlock_rules': {
    draft: EDITABLE,
    in_review: { mode: 'disabled', reason: IN_REVIEW_LOCK },
    approved: { mode: 'disabled', reason: APPROVED_LOCK },
    published: { mode: 'confirm', reason: 'Changing rules re-locks live items' },
    archived: READ_ONLY,
  },
  'item.visibility': {
    draft: EDITABLE,
    // "absent — the lifecycle owns it": the control must not render at all
    // while the course is In Review, not render disabled.
    in_review: { mode: 'absent' },
    approved: EDITABLE,
    published: { mode: 'confirm', reason: 'This changes what students can see right now' },
    archived: READ_ONLY,
  },
  'course.lifecycle': {
    draft: EDITABLE,
    in_review: EDITABLE,
    approved: EDITABLE,
    // Unpublish / Archive are Admin-only on a live course (spec 04 § Course
    // Lifecycle), so they are absent for everyone else.
    published: EDITABLE,
    archived: EDITABLE,
  },
}

/**
 * Resolve one cell of the table.
 *
 * Both failure directions resolve **away** from writable: an unknown *field* is
 * `absent` (there is no such control to lock), and an unknown *state* is
 * `disabled` with a stated reason. Neither may resolve to `editable`, because
 * the dangerous case is a lock that silently opens when the caller passes a
 * value this module does not recognise.
 */
export function resolveFieldLock(
  field: FieldLockField,
  state: CourseLifecycleState,
): FieldLockRule {
  // Widened to the defensive-lookup shape (the pattern in
  // `settings.constants.ts`): the table is total by construction, but a
  // value that slips past the type system must still resolve away from
  // writable — never to `editable`.
  const byState = (
    FIELD_LOCK_TABLE as Record<string, Record<CourseLifecycleState, FieldLockRule> | undefined>
  )[field]
  if (byState === undefined) return { mode: 'absent' }
  const rule = (byState as Record<string, FieldLockRule | undefined>)[state]
  if (rule === undefined) {
    return { mode: 'disabled', reason: 'This course state is not recognised — changes are locked' }
  }
  return rule
}

/** Convenience: is the control rendered at all? */
export function isFieldPresent(field: FieldLockField, state: CourseLifecycleState): boolean {
  return resolveFieldLock(field, state).mode !== 'absent'
}

/** Convenience: is the control rendered but inert? */
export function isFieldDisabled(field: FieldLockField, state: CourseLifecycleState): boolean {
  return resolveFieldLock(field, state).mode === 'disabled'
}

/** The reason a control is inert — what goes in the tooltip and `aria-describedby`. */
export function fieldLockReason(
  field: FieldLockField,
  state: CourseLifecycleState,
): string | undefined {
  const rule = resolveFieldLock(field, state)
  return rule.mode === 'disabled' || rule.mode === 'confirm' ? rule.reason : undefined
}

/**
 * The whole-surface locks (case 3). An Archived course replaces the workspace
 * with an explanation rather than a field-by-field disabled form — this is the
 * one place "read-only" is correct, because the *entire* surface is locked.
 *
 * A mixed screen does **not** collapse to read-only: it drops absent controls
 * and keeps disabled-with-a-reason controls visible.
 */
export function isSurfaceLocked(state: CourseLifecycleState): boolean {
  return state === 'archived'
}

/**
 * Whether autosave should run for a field in this state. A `disabled` field has
 * no buffer to flush, so the 60s timer must not spin on it.
 */
export function isFieldAutosavable(field: FieldLockField, state: CourseLifecycleState): boolean {
  const mode = resolveFieldLock(field, state).mode
  return mode === 'editable' || mode === 'confirm'
}
