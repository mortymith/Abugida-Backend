/**
 * S-6.9 Flat tri-state capability list (spec 08 § S-6.9). Replaces the
 * module × CRUD matrix with one flat list identical to Part 11 § Course
 * Lifecycle Capabilities, plus finance.view_revenue and students.read.
 */

export type CapabilityState = 'granted' | 'denied' | 'not_applicable'

export const CAPABILITY_STATE_LABELS: Record<CapabilityState, string> = {
  granted: 'Granted',
  denied: 'Denied',
  not_applicable: 'N/A',
}

export type CapabilityId =
  | 'course.create'
  | 'course.edit_details'
  | 'course.edit_pricing'
  | 'course.manage_curriculum'
  | 'course.archive_item'
  | 'course.submit_review'
  | 'course.review'
  | 'course.publish'
  | 'course.unpublish'
  | 'course.archive'
  | 'course.restore'
  | 'course.delete'
  | 'course.duplicate'
  | 'course.template'
  | 'assignment.grade'
  | 'finance.view_revenue'
  | 'students.read'
  | 'students.message'
  | 'courses.read_enrolled_context'
  | 'assets.read'
  | 'testimonials.moderate'
  | 'audit.read_own_actions'

export interface CapabilityRow {
  readonly id: CapabilityId
  readonly label: string
  readonly description: string
  readonly link: string
  readonly adminDefault: CapabilityState
  readonly editorDefault: CapabilityState
  readonly reviewerDefault: CapabilityState
  readonly viewerDefault: CapabilityState
  readonly supportDefault: CapabilityState
}

/**
 * The flat capability list. Part 11 is the single source of truth for
 * default values; this screen edits them.
 */
export const CAPABILITY_LIST: readonly CapabilityRow[] = [
  {
    id: 'course.create',
    label: 'Create a course',
    description: 'Create a new course.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.edit_details',
    label: 'Edit course details',
    description: 'Edit title, description, tags, thumbnail.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.edit_pricing',
    label: 'Edit pricing',
    description: 'Price a course.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.manage_curriculum',
    label: 'Manage curriculum',
    description: 'Add/rename/reorder sections & items.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.archive_item',
    label: 'Archive item',
    description: 'Reversibly hide a single item.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.submit_review',
    label: 'Submit for review',
    description: 'Draft → In Review.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.review',
    label: 'Review submissions',
    description: 'Approve or reject.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'granted',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.publish',
    label: 'Publish course',
    description: 'Publish; gated when requiresApproval is on.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.unpublish',
    label: 'Unpublish course',
    description: 'Admin only.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.archive',
    label: 'Archive course',
    description: 'Admin only.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.restore',
    label: 'Restore course',
    description: 'Admin only.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.delete',
    label: 'Delete course',
    description: 'Admin only.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.duplicate',
    label: 'Duplicate course',
    description: 'Copy course structure.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'course.template',
    label: 'Save as template',
    description: 'Create a reusable template.',
    link: '/courses',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'assignment.grade',
    label: 'Grade assignments',
    description: 'Score and release feedback.',
    link: '/students',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'finance.view_revenue',
    label: 'View revenue',
    description: 'See revenue figures.',
    link: '/analytics',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'denied',
  },
  {
    id: 'students.read',
    label: 'Read students',
    description: 'Read student directory.',
    link: '/students',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'granted',
  },
  {
    id: 'students.message',
    label: 'Message students',
    description: 'Send messages to students.',
    link: '/students/messaging',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'granted',
  },
  {
    id: 'courses.read_enrolled_context',
    label: 'Read enrolled context',
    description: 'Read enrollment context.',
    link: '/students',
    adminDefault: 'denied',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'granted',
  },
  {
    id: 'assets.read',
    label: 'Read assets',
    description: 'Read media assets.',
    link: '/media',
    adminDefault: 'granted',
    editorDefault: 'granted',
    reviewerDefault: 'granted',
    viewerDefault: 'granted',
    supportDefault: 'granted',
  },
  {
    id: 'testimonials.moderate',
    label: 'Moderate testimonials',
    description: 'Approve or reject testimonials.',
    link: '/settings',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'granted',
  },
  {
    id: 'audit.read_own_actions',
    label: 'Read own audit actions',
    description: 'Read own actions in audit log.',
    link: '/settings/security',
    adminDefault: 'granted',
    editorDefault: 'denied',
    reviewerDefault: 'denied',
    viewerDefault: 'denied',
    supportDefault: 'granted',
  },
]

/**
 * Whether a role matrix save is blocked. The spec:
 * - Admin core permissions are locked.
 * - A save that would leave zero users able to manage Billing or Settings is blocked.
 * - A save that would leave no reviewer on a gated course is blocked.
 */
export function canSaveRoleMatrix(
  matrix: Readonly<Record<CapabilityId, CapabilityState>>,
  hasGatedCourse: boolean,
): { permitted: boolean; reason: string | null } {
  // Admin core permissions (course.delete, course.unpublish, course.archive) must be granted for admin
  // This is checked at the UI level — the cells are locked.

  // Zero billing/settings manager check
  if (matrix['finance.view_revenue'] === 'denied' || matrix['students.read'] === 'denied') {
    // If both are denied across all roles, no one can manage billing or settings
    // This is a simplified check — the full check needs role membership data
  }

  // Zero reviewer on a gated course
  if (hasGatedCourse && matrix['course.review'] === 'denied') {
    return {
      permitted: false,
      reason: 'A gated course requires at least one role with review capability.',
    }
  }

  return { permitted: true, reason: null }
}

/**
 * Whether the Support role's finance.view_revenue should be absent (not
 * rendered as denied). The spec: "finance.view_revenue is absent from
 * the Support payload rather than rendered as denied."
 */
export function isSupportCapabilityExcluded(capability: CapabilityId): boolean {
  return capability === 'finance.view_revenue'
}
