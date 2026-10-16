/**
 * Course Lifecycle Capabilities (spec 04 § Permission Model, spec 11 §
 * Roles & Permissions Matrix → Course Lifecycle Capabilities).
 *
 * Two independent role systems grant capabilities (spec 13 § Identity):
 *
 * 1. **Member role** (`member.role`, workspace-wide) — `owner | admin | member`.
 *    Reviewer and Support are NOT member roles.
 * 2. **Course roles** (`roles` + `course_roles`, per course).
 *
 * Effective role = union of both, **capped by** the member role. A course
 * role never grants what the member role denies.
 *
 * This module is framework-free: it owns the capability vocabulary and the
 * three-case rendering rule. The React component consults `renderRule` to
 * decide whether a control is `absent`, `disabled-with-reason`, `confirm`,
 * or `editable`.
 */

import type { FieldLockField, FieldLockRule } from './courses.field-lock'
import type { CourseLifecycleState } from './courses.workspace'

export const COURSE_CAPABILITIES = [
  'course.create',
  'course.edit_details',
  'course.edit_pricing',
  'course.manage_curriculum',
  'course.archive_item',
  'course.submit_review',
  'course.review',
  'course.publish',
  'course.unpublish',
  'course.archive',
  'course.restore',
  'course.delete',
  'course.duplicate',
  'course.template',
  'assignment.grade',
  'finance.view_revenue',
  'students.read',
  'students.message',
  'courses.read_enrolled_context',
  'assets.read',
  'testimonials.moderate',
  'audit.read_own_actions',
] as const

export type CourseCapability = (typeof COURSE_CAPABILITIES)[number]

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export type CourseRole = 'admin' | 'editor' | 'reviewer' | 'viewer' | 'support'

export type EffectiveRole = WorkspaceRole | CourseRole

/**
 * The capability matrix. `✔` = granted, `✖` = denied.
 *
 * From spec 11 § Course Lifecycle Capabilities:
 *
 * | Capability | Admin | Editor | Reviewer | Viewer | Support |
 * |---|---|---|---|---|---|
 * | course.create | ✔ | ✔ | ✖ | ✖ | |
 * | course.edit_details | ✔ | ✔ | ✖ | ✖ | |
 * | course.edit_pricing | ✔ | ✔ | ✖ | ✖ | |
 * | course.manage_curriculum | ✔ | ✔ | ✖ | ✖ | |
 * | course.archive_item | ✔ | ✔ | ✖ | ✖ | |
 * | course.submit_review | ✔ | ✔ | ✖ | ✖ | |
 * | course.review | ✔ | ✖ on own work | ✔ | ✖ | |
 * | course.publish | ✔ | ungated only | with course.publish | ✖ | |
 * | course.unpublish | ✔ | ✖ | ✖ | ✖ | |
 * | course.archive / restore | ✔ | ✖ | ✖ | ✖ | |
 * | course.delete | ✔ | ✖ | ✖ | ✖ | |
 * | course.duplicate / template | ✔ | ✔ | ✖ | ✖ | |
 * | assignment.grade | ✔ | ✔ | ✖ | ✖ | |
 * | finance.view_revenue | ✔ | ✔ (view only) | ✖ | ✖ | ✖ (server-side redacted) |
 * | students.read | ✔ | ✔ | ✖ | ✖ | ✔ |
 * | students.message | ✔ | ✔ | ✖ | ✖ | ✔ |
 *
 * Support additionally has `courses.read_enrolled_context`, `assets.read`,
 * `testimonials.moderate`, `audit.read_own_actions`.
 *
 * The owner member role maps to admin capabilities.
 */
const CAPABILITY_MATRIX: Record<EffectiveRole, ReadonlySet<CourseCapability>> = {
  owner: new Set<CourseCapability>([
    'course.create',
    'course.edit_details',
    'course.edit_pricing',
    'course.manage_curriculum',
    'course.archive_item',
    'course.submit_review',
    'course.review',
    'course.publish',
    'course.unpublish',
    'course.archive',
    'course.restore',
    'course.delete',
    'course.duplicate',
    'course.template',
    'assignment.grade',
    'finance.view_revenue',
    'students.read',
    'students.message',
    'assets.read',
    'testimonials.moderate',
    'audit.read_own_actions',
  ]),
  admin: new Set<CourseCapability>([
    'course.create',
    'course.edit_details',
    'course.edit_pricing',
    'course.manage_curriculum',
    'course.archive_item',
    'course.submit_review',
    'course.review',
    'course.publish',
    'course.unpublish',
    'course.archive',
    'course.restore',
    'course.delete',
    'course.duplicate',
    'course.template',
    'assignment.grade',
    'finance.view_revenue',
    'students.read',
    'students.message',
    'assets.read',
    'testimonials.moderate',
    'audit.read_own_actions',
  ]),
  member: new Set<CourseCapability>([]),
  editor: new Set<CourseCapability>([
    'course.create',
    'course.edit_details',
    'course.edit_pricing',
    'course.manage_curriculum',
    'course.archive_item',
    'course.submit_review',
    'course.publish',
    'course.duplicate',
    'course.template',
    'assignment.grade',
    'finance.view_revenue',
    'students.read',
    'students.message',
    'assets.read',
  ]),
  reviewer: new Set<CourseCapability>(['course.review', 'course.publish']),
  viewer: new Set<CourseCapability>([]),
  support: new Set<CourseCapability>([
    'students.read',
    'students.message',
    'courses.read_enrolled_context',
    'assets.read',
    'testimonials.moderate',
    'audit.read_own_actions',
  ]),
}

/**
 * Whether `role` has `capability`. The owner and admin member roles map to
 * the full admin capability set; the member role grants nothing by itself
 * (a bare member has no course capabilities — they must come from a course
 * role).
 */
export function hasCapability(role: EffectiveRole, capability: CourseCapability): boolean {
  return CAPABILITY_MATRIX[role].has(capability)
}

/**
 * Compute the effective capability set from a member role and a course role.
 * The course role is unioned in, then capped by the member role: a course
 * role never grants what the member role denies.
 *
 * Example: a `member` (bare, no workspace admin) with a course `editor`
 * role has the editor's capabilities. A `member` with a course `admin`
 * role still only has the editor's capabilities, because the member role
 * caps the course role.
 */
export function effectiveCapabilities(
  memberRole: WorkspaceRole,
  courseRole: CourseRole | null,
): Set<CourseCapability> {
  const memberCaps = CAPABILITY_MATRIX[memberRole]
  if (!courseRole) return new Set(memberCaps)
  const courseCaps = CAPABILITY_MATRIX[courseRole]
  // Owner/admin member role: full set, course role is redundant.
  if (memberRole === 'owner' || memberRole === 'admin') {
    return new Set(memberCaps)
  }
  // Member role caps the course role: union, but the member role itself
  // grants nothing, so the result is just the course role's set.
  return new Set(courseCaps)
}

// ── Three-case rendering rule ──────────────────────────────────────────────
//
// spec 04 § Workspace Model:
//
// 1. Out of capability → ABSENT entirely (control does not render).
// 2. Capable but blocked by state → DISABLED WITH A REASON (in tooltip AND
//    aria-describedby).
// 3. Whole surface locked → REPLACED WITH AN EXPLANATION.
//
// A mixed screen does not collapse to read-only: it drops case-1 controls
// and keeps case-2 controls visible but disabled-with-a-reason.

export type RenderRule =
  | { readonly mode: 'absent' }
  | { readonly mode: 'disabled'; readonly reason: string }
  | { readonly mode: 'confirm'; readonly reason: string; readonly confirmTitle: string }
  | { readonly mode: 'editable' }

/**
 * Resolve the render rule for a field, given the user's effective
 * capability set and the course's lifecycle state.
 *
 * This is the load-bearing function every screen's UI consults. It
 * combines the Field Lock Table (state-based) with the capability matrix
 * (role-based) to produce a single render decision.
 *
 * The rule:
 * 1. If the user lacks the capability for the field, return `absent`
 *    (case 1). The control does not render at all.
 * 2. Otherwise, consult the Field Lock Table for the field's rule in the
 *    current state. The table returns `editable`, `disabled`, `confirm`,
 *    or `absent` (e.g. `item.visibility` is absent while the course is
 *    In Review).
 * 3. Return the table's rule.
 *
 * The caller is responsible for case 3 (whole-surface replacement) — that
 * is a screen-level decision, not a field-level one.
 */
export function renderRule(
  field: FieldLockField,
  fieldLockResolver: (field: FieldLockField, state: CourseLifecycleState) => FieldLockRule,
  state: CourseLifecycleState,
  capabilities: Set<CourseCapability>,
): RenderRule {
  // Step 1: capability check. Map field → required capability.
  const requiredCapability = capabilityForField(field)
  if (requiredCapability && !capabilities.has(requiredCapability)) {
    return { mode: 'absent' }
  }

  // Step 2: consult the Field Lock Table.
  const rule = fieldLockResolver(field, state)
  if (rule.mode === 'absent') return { mode: 'absent' }
  if (rule.mode === 'disabled') {
    return { mode: 'disabled', reason: rule.reason ?? 'Not available in this state' }
  }
  if (rule.mode === 'confirm') {
    return {
      mode: 'confirm',
      reason: rule.reason ?? 'This change has a student-visible effect',
      confirmTitle: rule.confirmTitle ?? 'Confirm change',
    }
  }
  return { mode: 'editable' }
}

/**
 * Map a Field Lock Table field to the capability required to exercise it.
 * Read-only fields (no capability required) return `null`.
 */
export function capabilityForField(field: FieldLockField): CourseCapability | null {
  switch (field) {
    case 'course.title':
    case 'course.slug':
    case 'course.details':
    case 'course.content_language':
      return 'course.edit_details'
    case 'course.pricing':
      return 'course.edit_pricing'
    case 'course.requires_approval':
      // Admin-only regardless of state.
      return 'course.edit_details'
    case 'section.metadata':
    case 'item.title':
    case 'item.body':
    case 'item.unlock_rules':
    case 'item.visibility':
      return 'course.manage_curriculum'
    case 'course.lifecycle':
      // The lifecycle transition row is gated by the specific transition
      // (publish/unpublish/archive/restore), not a single capability.
      // The caller resolves the transition capability separately.
      return null
    default:
      return null
  }
}

/**
 * The set of valid lifecycle transitions (spec 04 § Course Lifecycle).
 * Admin can do every transition in this set; other roles are gated by
 * capability + state. A transition not in this set is invalid for everyone
 * (e.g. `archived → published` — must restore to Draft first).
 */
const VALID_TRANSITIONS: ReadonlySet<`${CourseLifecycleState}->${CourseLifecycleState}`> = new Set([
  'draft->in_review',
  'draft->published',
  'in_review->draft',
  'in_review->approved',
  'in_review->published',
  'approved->draft',
  'approved->published',
  'published->draft',
  'published->archived',
  'archived->draft',
])

function isValidTransition(from: CourseLifecycleState, to: CourseLifecycleState): boolean {
  return VALID_TRANSITIONS.has(`${from}->${to}`)
}

/**
 * Whether a lifecycle transition is permitted for the given role and
 * state. From spec 04 § Course Lifecycle:
 *
 * | From | To | Who |
 * |---|---|---|
 * | Draft | In Review | Editor (requiresApproval on) |
 * | Draft | Published | Editor (ungated) / Admin (gated) |
 * | In Review | Draft | Editor (withdraw) / Reviewer (changes requested) |
 * | In Review | Approved | Reviewer |
 * | In Review | Published | Reviewer (approve+publish) / Admin |
 * | Approved | Draft | Editor (edit clears approval) |
 * | Approved | Published | Editor / Admin |
 * | Published | Draft | Admin (unpublish) |
 * | Published | Archived | Admin (archive) |
 * | Archived | Draft | Admin (restore) |
 *
 * Editor cannot self-approve when `requiresApproval` is on — the
 * `canSelfApprove` guard is checked separately by the caller.
 */
export function canTransitionLifecycle(
  from: CourseLifecycleState,
  to: CourseLifecycleState,
  capabilities: Set<CourseCapability>,
  requiresApproval: boolean,
): boolean {
  // Invalid transitions (not in the spec table, e.g. archived → published)
  // are denied for everyone — an archived course must be restored to Draft
  // before it can be republished.
  if (!isValidTransition(from, to)) return false

  // Admin can do every valid transition.
  const isAdmin = capabilities.has('course.archive') // only admin has this
  if (isAdmin) return true

  const canEdit = capabilities.has('course.manage_curriculum')
  const canReview = capabilities.has('course.review')
  const canPublish = capabilities.has('course.publish')

  // Draft → In Review (Editor, ungated when requiresApproval on)
  if (from === 'draft' && to === 'in_review') {
    return canEdit && requiresApproval
  }
  // Draft → Published (Editor ungated, Admin gated)
  if (from === 'draft' && to === 'published') {
    if (!requiresApproval) return canEdit
    return false // gated — only Admin (handled above) or Reviewer-with-publish
  }
  // In Review → Draft (withdraw / changes requested)
  if (from === 'in_review' && to === 'draft') {
    return canEdit || canReview
  }
  // In Review → Approved (Reviewer)
  if (from === 'in_review' && to === 'approved') {
    return canReview
  }
  // In Review → Published (Reviewer approve+publish, or Admin)
  if (from === 'in_review' && to === 'published') {
    return canReview && canPublish
  }
  // Approved → Draft (Editor edit clears approval)
  if (from === 'approved' && to === 'draft') {
    return canEdit
  }
  // Approved → Published (Editor / Admin)
  if (from === 'approved' && to === 'published') {
    return canEdit || canPublish
  }
  // Published → Draft (Admin only — unpublish)
  if (from === 'published' && to === 'draft') {
    return false // admin-only, handled above
  }
  // Published → Archived (Admin only)
  if (from === 'published' && to === 'archived') {
    return false // admin-only
  }
  // Archived → Draft (Admin only — restore)
  if (from === 'archived' && to === 'draft') {
    return false // admin-only
  }
  return false
}

/**
 * Self-approval guard: a user can never approve a submission they
 * authored. The caller checks `authorId !== currentUserId` before calling
 * `canTransitionLifecycle` for the `in_review → approved` transition.
 */
export function canSelfApprove(authorId: string, currentUserId: string): boolean {
  return authorId !== currentUserId
}
