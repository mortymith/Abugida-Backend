/**
 * Static settings constants (spec 08 + spec 11). Pure data and pure functions —
 * no db, no env, no framework imports — so both server and client code and
 * unit tests can import it safely.
 */

// ── S-6.1 General ────────────────────────────────────────────────────────────

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'አማርኛ (Amharic)' },
] as const

export const COMMON_TIMEZONES = [
  'Africa/Addis_Ababa',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'UTC',
] as const

// ── S-6.2 Team role definitions (spec S-6.2 wireframe) ───────────────────────

export const ROLE_DEFINITIONS: Array<{ role: string; description: string }> = [
  { role: 'Admin', description: 'Full access to all features' },
  { role: 'Editor', description: 'Can create, edit, and manage courses' },
  { role: 'Reviewer', description: 'Approves or rejects lessons for publication' },
  { role: 'Viewer', description: 'Read-only access to courses and analytics' },
  { role: 'Support', description: 'Can view students and send communications' },
]

// ── S-6.9 Roles & Permissions matrix (spec 11 modules) ───────────────────────

export const PERMISSION_MODULES = [
  'Dashboard',
  'Courses',
  'Content Library',
  'Students',
  'Analytics',
  'Settings',
  'Billing',
] as const

export const PERMISSION_CAPABILITIES = ['view', 'create', 'edit', 'delete', 'publish'] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]
export type PermissionCapability = (typeof PERMISSION_CAPABILITIES)[number]

export type PermissionMatrix = Record<string, string[]>

/**
 * Spec 11 roles matrix translated into module → capabilities per role. This
 * is the starting default when a role row is first saved and the baseline a
 * custom role clones. Capabilities not meaningful for a module are simply
 * absent (matches the "—" cells in the spec matrix).
 */
export const BUILT_IN_ROLE_PERMISSIONS: Record<string, PermissionMatrix> = {
  admin: {
    Dashboard: ['view', 'create', 'edit', 'delete', 'publish'],
    Courses: ['view', 'create', 'edit', 'delete', 'publish'],
    'Content Library': ['view', 'create', 'edit', 'delete', 'publish'],
    Students: ['view', 'create', 'edit', 'delete', 'publish'],
    Analytics: ['view', 'create', 'edit', 'delete', 'publish'],
    Settings: ['view', 'create', 'edit', 'delete'],
    Billing: ['view', 'create', 'edit', 'delete'],
  },
  editor: {
    Dashboard: ['view', 'create', 'edit', 'delete', 'publish'],
    Courses: ['view', 'create', 'edit', 'publish'],
    'Content Library': ['view', 'create', 'edit', 'delete', 'publish'],
    Students: ['view', 'create', 'edit'],
    Analytics: ['view'],
  },
  reviewer: {
    Dashboard: ['view'],
    Courses: ['view', 'publish'],
    Analytics: ['view'],
    Students: ['view'],
    'Content Library': ['view'],
  },
  viewer: {
    Dashboard: ['view'],
    Courses: ['view'],
    'Content Library': ['view'],
    Analytics: ['view'],
    Students: ['view'],
  },
  support: {
    Dashboard: ['view'],
    Students: ['view', 'create'],
    Analytics: ['view'],
    Courses: ['view'],
  },
}

/** Built-in roles are seeded from this order; admin always exists first. */
export const BUILT_IN_ROLES = ['admin', 'editor', 'reviewer', 'support', 'viewer'] as const

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access to all features',
  editor: 'Can create, edit, and manage courses',
  reviewer: 'Approves or rejects lessons for publication',
  support: 'Can view students and send communications',
  viewer: 'Read-only access to courses and analytics',
}

// ── S-6.9 Course Lifecycle Capabilities (spec 11 § Course Lifecycle) ─────────
//
// The course lifecycle (S-2.22) introduces capabilities finer-grained than the
// module rows above. They are toggled individually in S-6.9 and are why a
// course's *approval gate* and *publish permission* are separate concerns.
//
// Two of the spec's cells are not static: `course.review` is "✖ on own work"
// and `course.publish` is "only when the course is ungated". Those live in
// `canUseCourseLifecycleCapability` below as pure logic rather than as table
// lookups, so the rule is testable and the table stays a plain data export.

export const COURSE_LIFECYCLE_ROLES = ['admin', 'editor', 'reviewer', 'viewer'] as const

export type CourseLifecycleRole = (typeof COURSE_LIFECYCLE_ROLES)[number]

export const COURSE_LIFECYCLE_ROLE_LABELS: Record<CourseLifecycleRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  reviewer: 'Reviewer',
  viewer: 'Viewer',
}

export const COURSE_LIFECYCLE_CAPABILITIES = [
  {
    capability: 'course.create',
    description: 'Create a new course as a Draft',
    screen: 'S-2.2',
  },
  {
    capability: 'course.edit_details',
    description: 'Title, description, tags, thumbnail; the slug only while Draft',
    screen: 'S-2.20',
  },
  {
    capability: 'course.edit_pricing',
    description: 'Pricing model, price, billing interval, enrollment window',
    screen: 'S-2.20',
  },
  {
    capability: 'course.manage_curriculum',
    description: 'Add, rename, reorder, move, duplicate, archive, delete sections and items',
    screen: 'S-2.17',
  },
  {
    capability: 'course.archive_item',
    description: 'Reversibly hide a single section or item',
    screen: 'S-2.17',
  },
  {
    capability: 'course.submit_review',
    description: 'Submit a Draft course for review',
    screen: 'S-2.22',
  },
  {
    capability: 'course.review',
    description: 'Approve or request changes on a submission — never your own',
    screen: 'S-2.14',
  },
  {
    capability: 'course.publish',
    description: 'Publish an approved or ungated course',
    screen: 'S-2.22',
  },
  {
    capability: 'course.unpublish',
    description: 'Remove student access; Admin only',
    screen: 'S-2.22',
  },
  {
    capability: 'course.archive',
    description: 'Close enrollment and remove the course from the catalog; Admin only',
    screen: 'S-2.22',
  },
  {
    capability: 'course.restore',
    description: 'Return an archived course to Draft; Admin only',
    screen: 'S-2.22',
  },
  {
    capability: 'course.delete',
    description: 'Delete a course; blocked while issued certificates exist',
    screen: 'S-2.20',
  },
  {
    capability: 'course.duplicate',
    description: 'Copy a course, including its curriculum, into a new Draft',
    screen: 'S-2.1',
  },
  {
    capability: 'course.template',
    description: 'Save a course as a reusable template',
    screen: 'S-2.12',
  },
  {
    capability: 'assignment.grade',
    description: 'Score submissions and release feedback',
    screen: 'S-2.23',
  },
] as const

export type CourseLifecycleCapability = (typeof COURSE_LIFECYCLE_CAPABILITIES)[number]['capability']

export type CourseLifecycleCapabilityRow = (typeof COURSE_LIFECYCLE_CAPABILITIES)[number]

/**
 * The unconditional half of the spec 11 matrix. Two cells are deliberately
 * absent because they are conditional, not denied:
 * - `course.publish` is not granted to `editor` here; the ungated rule in
 *   `canUseCourseLifecycleCapability` grants it per course.
 * - `course.review` is granted to `editor` here, but only ever on other
 *   people's work — the self-approval guard filters it at decision time.
 * Viewer holds none of these (read-only); it keeps the module-level
 * `Courses: ['view']` grant in `BUILT_IN_ROLE_PERMISSIONS`.
 */
export const COURSE_LIFECYCLE_ROLE_CAPABILITIES: Record<
  CourseLifecycleRole,
  readonly CourseLifecycleCapability[]
> = {
  admin: COURSE_LIFECYCLE_CAPABILITIES.map((row) => row.capability),
  editor: [
    'course.create',
    'course.edit_details',
    'course.edit_pricing',
    'course.manage_curriculum',
    'course.archive_item',
    'course.submit_review',
    'course.review',
    'course.duplicate',
    'course.template',
    'assignment.grade',
  ],
  reviewer: ['course.review', 'course.publish'],
  viewer: [],
}

/** Static table lookup — the unconditional grants only, no conditional rules. */
export function grantsCourseLifecycleCapability(
  role: CourseLifecycleRole,
  capability: CourseLifecycleCapability,
): boolean {
  return COURSE_LIFECYCLE_ROLE_CAPABILITIES[role].includes(capability)
}

/** Why an action is unavailable, so the UI can explain rather than disable silently. */
export type CourseLifecycleDenialReason =
  'not_granted' | 'self_approval_guard' | 'approval_gate' | 'requires_publish' | 'viewer_read_only'

export const COURSE_LIFECYCLE_DENIAL_MESSAGES: Record<CourseLifecycleDenialReason, string> = {
  not_granted: 'Your role does not have this capability.',
  self_approval_guard: 'You cannot approve a submission you authored.',
  approval_gate: 'This course requires approval. An Editor cannot self-publish it.',
  requires_publish: 'Changing the price of a live course also requires course.publish.',
  viewer_read_only: 'Viewers have read-only access.',
}

export interface CourseLifecycleContext {
  role: CourseLifecycleRole
  /** Whether this course has the approval gate switched on. */
  requiresApproval: boolean
  /** True once the course is Published and visible to students. */
  isCourseLive: boolean
  /** Set only when deciding a review, so the self-approval guard can apply. */
  authorId?: string
  /** The acting user, for review decisions. */
  actorId?: string
}

export interface CourseLifecycleDecision {
  allowed: boolean
  reason: CourseLifecycleDenialReason | null
  message: string | null
}

const ALLOWED: CourseLifecycleDecision = { allowed: true, reason: null, message: null }

function deny(reason: CourseLifecycleDenialReason): CourseLifecycleDecision {
  return { allowed: false, reason, message: COURSE_LIFECYCLE_DENIAL_MESSAGES[reason] }
}

function isOwnWork(context: CourseLifecycleContext): boolean {
  return context.authorId !== undefined && context.authorId === context.actorId
}

/**
 * SELF-APPROVAL GUARD (spec 11): a user can never approve a submission they
 * authored. Where a workspace's only reviewer authored the change, the queue row
 * must offer Reassign rather than fail silently — see
 * `resolveCourseReviewQueueRow`.
 */
export function canReviewSubmission(context: CourseLifecycleContext): CourseLifecycleDecision {
  if (!grantsCourseLifecycleCapability(context.role, 'course.review')) {
    return context.role === 'viewer' ? deny('viewer_read_only') : deny('not_granted')
  }
  if (isOwnWork(context)) return deny('self_approval_guard')
  return ALLOWED
}

/**
 * UNGATED PUBLISH (spec 11): when `requiresApproval` is true an Editor cannot
 * self-publish. `course.publish` is available to an Editor only while the
 * course is ungated. Reviewer publishes; Admin always.
 */
export function canPublishCourse(context: CourseLifecycleContext): CourseLifecycleDecision {
  if (context.role === 'admin') return ALLOWED
  if (context.role === 'reviewer') {
    // A reviewer publishing their own authored course is still a self-approval.
    return isOwnWork(context) ? deny('self_approval_guard') : ALLOWED
  }
  if (context.role === 'editor') {
    if (context.requiresApproval) return deny('approval_gate')
    return ALLOWED
  }
  return deny('viewer_read_only')
}

/**
 * Pricing: `course.edit_pricing`, plus `course.publish` when the course is
 * already live — changing the price of a live course also requires
 * `course.publish` (spec 11 capability note).
 */
export function canEditCoursePricing(context: CourseLifecycleContext): CourseLifecycleDecision {
  if (!grantsCourseLifecycleCapability(context.role, 'course.edit_pricing')) {
    return context.role === 'viewer' ? deny('viewer_read_only') : deny('not_granted')
  }
  if (context.isCourseLive) return canPublishCourse(context)
  return ALLOWED
}

/**
 * The single entry point every surface should call. Conditional rules apply
 * only to their own capabilities; everything else is the static table.
 */
export function canUseCourseLifecycleCapability(
  capability: CourseLifecycleCapability,
  context: CourseLifecycleContext,
): CourseLifecycleDecision {
  switch (capability) {
    case 'course.review':
      return canReviewSubmission(context)
    case 'course.publish':
      return canPublishCourse(context)
    case 'course.edit_pricing':
      return canEditCoursePricing(context)
    default:
      break
  }
  if (context.role === 'viewer') return deny('viewer_read_only')
  return grantsCourseLifecycleCapability(context.role, capability) ? ALLOWED : deny('not_granted')
}

export function canUseCourseLifecycleCapabilityBoolean(
  capability: CourseLifecycleCapability,
  context: CourseLifecycleContext,
): boolean {
  return canUseCourseLifecycleCapability(capability, context).allowed
}

// ── S-6.14 Review queue row (spec 11 self-approval guard) ───────────────────

export const REVIEW_QUEUE_OWN_SUBMISSION_LABEL = 'Yours — awaiting another reviewer'

export type ReviewQueueRowState = 'actionable' | 'awaiting_other_reviewer' | 'read_only'

export interface ReviewQueueRow {
  state: ReviewQueueRowState
  /** Label to render in place of the decide buttons. */
  label: string
  /** Show the Reassign action (spec 11) instead of a silent failure. */
  showReassign: boolean
  decision: CourseLifecycleDecision
}

/**
 * Resolve a review-queue row. This is the non-silent half of the self-approval
 * guard: a row the actor authored is never a dead row, it is
 * "Yours — awaiting another reviewer" plus a Reassign action.
 */
export function resolveCourseReviewQueueRow(context: CourseLifecycleContext): ReviewQueueRow {
  const decision = canReviewSubmission(context)
  if (decision.allowed) {
    return { state: 'actionable', label: '', showReassign: false, decision }
  }
  if (decision.reason === 'self_approval_guard') {
    return {
      state: 'awaiting_other_reviewer',
      label: REVIEW_QUEUE_OWN_SUBMISSION_LABEL,
      showReassign: true,
      decision,
    }
  }
  return { state: 'read_only', label: decision.message ?? '', showReassign: false, decision }
}

// ── S-6.7 API keys ───────────────────────────────────────────────────────────

export const API_KEY_PREFIX = 'sk_live'
export const WEBHOOK_EVENT_TYPES = [
  'enrollment.created',
  'course.published',
  'student.updated',
  'payment.completed',
] as const

// ── S-6.10 Privacy ───────────────────────────────────────────────────────────

export const SLA_DAYS = 30
export const SLA_WARNING_DAYS = 5
export const RETENTION_INACTIVITY_OPTIONS = [6, 12, 18, 24, 36] as const
export const RETENTION_WARNING_OPTIONS = [7, 14, 30] as const
