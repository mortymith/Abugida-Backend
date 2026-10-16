import { describe, expect, test } from 'bun:test'
import {
  canEditCoursePricing,
  canPublishCourse,
  canReviewSubmission,
  canUseCourseLifecycleCapability,
  canUseCourseLifecycleCapabilityBoolean,
  COURSE_LIFECYCLE_CAPABILITIES,
  COURSE_LIFECYCLE_DENIAL_MESSAGES,
  COURSE_LIFECYCLE_ROLE_CAPABILITIES,
  COURSE_LIFECYCLE_ROLE_LABELS,
  COURSE_LIFECYCLE_ROLES,
  grantsCourseLifecycleCapability,
  resolveCourseReviewQueueRow,
  REVIEW_QUEUE_OWN_SUBMISSION_LABEL,
} from '#/features/settings/settings.constants'
import type {
  CourseLifecycleCapability,
  CourseLifecycleContext,
  CourseLifecycleRole,
} from '#/features/settings/settings.constants'

const ALL_CAPABILITIES = COURSE_LIFECYCLE_CAPABILITIES.map((row) => row.capability)

function context(
  role: CourseLifecycleRole,
  overrides: Partial<CourseLifecycleContext> = {},
): CourseLifecycleContext {
  return { role, requiresApproval: false, isCourseLive: false, ...overrides }
}

describe('course lifecycle capability catalogue (spec 11 / S-6.9)', () => {
  test('exposes exactly the fifteen spec capabilities', () => {
    expect(ALL_CAPABILITIES).toEqual([
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
    ])
  })

  test('covers Admin, Editor, Reviewer, Viewer', () => {
    expect([...COURSE_LIFECYCLE_ROLES]).toEqual(['admin', 'editor', 'reviewer', 'viewer'])
    expect(COURSE_LIFECYCLE_ROLE_LABELS).toEqual({
      admin: 'Admin',
      editor: 'Editor',
      reviewer: 'Reviewer',
      viewer: 'Viewer',
    })
  })

  test('every capability has a one-line explanation and an owning screen', () => {
    for (const row of COURSE_LIFECYCLE_CAPABILITIES) {
      expect(row.description.length).toBeGreaterThan(0)
      expect(row.screen).toMatch(/^S-\d+\.\d+$/)
    }
  })
})

describe('role × capability matrix', () => {
  test('Admin holds every capability', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(grantsCourseLifecycleCapability('admin', capability)).toBe(true)
    }
  })

  test('Editor may author but never ship, archive, or destroy', () => {
    expect([...COURSE_LIFECYCLE_ROLE_CAPABILITIES.editor].sort()).toEqual([
      'assignment.grade',
      'course.archive_item',
      'course.create',
      'course.duplicate',
      'course.edit_details',
      'course.edit_pricing',
      'course.manage_curriculum',
      'course.review',
      'course.submit_review',
      'course.template',
    ])
    for (const denied of [
      'course.unpublish',
      'course.archive',
      'course.restore',
      'course.delete',
    ] as const) {
      expect(grantsCourseLifecycleCapability('editor', denied)).toBe(false)
    }
  })

  test('Reviewer reviews and publishes, but cannot author', () => {
    expect([...COURSE_LIFECYCLE_ROLE_CAPABILITIES.reviewer]).toEqual([
      'course.review',
      'course.publish',
    ])
    for (const denied of [
      'course.create',
      'course.edit_details',
      'course.edit_pricing',
      'course.manage_curriculum',
      'course.submit_review',
      'course.unpublish',
      'course.archive',
    ] as const) {
      expect(grantsCourseLifecycleCapability('reviewer', denied)).toBe(false)
    }
  })

  test('Viewer holds none of the lifecycle capabilities', () => {
    expect(COURSE_LIFECYCLE_ROLE_CAPABILITIES.viewer).toEqual([])
    for (const capability of ALL_CAPABILITIES) {
      expect(canUseCourseLifecycleCapabilityBoolean(capability, context('viewer'))).toBe(false)
    }
    expect(canUseCourseLifecycleCapability('course.create', context('viewer')).reason).toBe(
      'viewer_read_only',
    )
  })

  test('the unpublish/archive/restore/delete block is Admin-only', () => {
    const adminOnly: CourseLifecycleCapability[] = [
      'course.unpublish',
      'course.archive',
      'course.restore',
      'course.delete',
    ]
    for (const capability of adminOnly) {
      const grants = COURSE_LIFECYCLE_ROLES.filter((role) =>
        grantsCourseLifecycleCapability(role, capability),
      )
      expect(grants).toEqual(['admin'])
    }
  })
})

describe('rule (a) — self-approval guard', () => {
  test('nobody may approve a submission they authored', () => {
    for (const role of COURSE_LIFECYCLE_ROLES) {
      const decision = canReviewSubmission(
        context(role, { actorId: 'usr_alex', authorId: 'usr_alex' }),
      )
      expect(decision.allowed).toBe(false)
      if (role === 'viewer') {
        expect(decision.reason).toBe('viewer_read_only')
      } else {
        expect(decision.reason).toBe('self_approval_guard')
        expect(decision.message).toBe(COURSE_LIFECYCLE_DENIAL_MESSAGES.self_approval_guard)
      }
    }
  })

  test('a reviewer may decide someone else’s submission', () => {
    const decision = canReviewSubmission(
      context('reviewer', { actorId: 'usr_alex', authorId: 'usr_jane' }),
    )
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBeNull()
  })

  test('an Editor may review, but only work that is not their own', () => {
    expect(
      canReviewSubmission(context('editor', { actorId: 'usr_jane', authorId: 'usr_bob' })).allowed,
    ).toBe(true)
    expect(
      canReviewSubmission(context('editor', { actorId: 'usr_jane', authorId: 'usr_jane' })).allowed,
    ).toBe(false)
  })

  test('the queue row reads "Yours — awaiting another reviewer" with Reassign', () => {
    const row = resolveCourseReviewQueueRow(
      context('reviewer', { actorId: 'usr_alex', authorId: 'usr_alex' }),
    )
    expect(row.state).toBe('awaiting_other_reviewer')
    expect(row.label).toBe('Yours — awaiting another reviewer')
    expect(REVIEW_QUEUE_OWN_SUBMISSION_LABEL).toBe(row.label)
    expect(row.showReassign).toBe(true)
    expect(row.decision.reason).toBe('self_approval_guard')
  })

  test('an actionable row offers decisions and no Reassign', () => {
    const row = resolveCourseReviewQueueRow(
      context('reviewer', { actorId: 'usr_alex', authorId: 'usr_jane' }),
    )
    expect(row.state).toBe('actionable')
    expect(row.showReassign).toBe(false)
    expect(row.label).toBe('')
  })

  test('a viewer’s row is read-only, not a silent failure', () => {
    const row = resolveCourseReviewQueueRow(
      context('viewer', { actorId: 'usr_alex', authorId: 'usr_jane' }),
    )
    expect(row.state).toBe('read_only')
    expect(row.showReassign).toBe(false)
    expect(row.label).toBe(COURSE_LIFECYCLE_DENIAL_MESSAGES.viewer_read_only)
  })
})

describe('rule (b) — ungated publish', () => {
  test('an Editor may self-publish only when the course is ungated', () => {
    expect(canPublishCourse(context('editor', { requiresApproval: false })).allowed).toBe(true)
    const gated = canPublishCourse(context('editor', { requiresApproval: true }))
    expect(gated.allowed).toBe(false)
    expect(gated.reason).toBe('approval_gate')
    expect(gated.message).toBe(COURSE_LIFECYCLE_DENIAL_MESSAGES.approval_gate)
  })

  test('Reviewer publishes', () => {
    expect(canPublishCourse(context('reviewer', { requiresApproval: true })).allowed).toBe(true)
    expect(canPublishCourse(context('reviewer', { requiresApproval: false })).allowed).toBe(true)
  })

  test('Admin always publishes, gated or not', () => {
    expect(canPublishCourse(context('admin', { requiresApproval: true })).allowed).toBe(true)
    expect(canPublishCourse(context('admin', { requiresApproval: false })).allowed).toBe(true)
  })

  test('Viewer never publishes', () => {
    const decision = canPublishCourse(context('viewer', { requiresApproval: false }))
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('viewer_read_only')
  })

  test('the self-approval guard also covers a reviewer publishing their own course', () => {
    const decision = canPublishCourse(
      context('reviewer', { requiresApproval: true, actorId: 'usr_alex', authorId: 'usr_alex' }),
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('self_approval_guard')
  })
})

describe('pricing on a live course', () => {
  test('changing price on a live course also requires course.publish', () => {
    const gatedEditor = context('editor', { requiresApproval: true, isCourseLive: true })
    expect(canEditCoursePricing(gatedEditor).allowed).toBe(false)
    expect(canEditCoursePricing(gatedEditor).reason).toBe('approval_gate')

    const ungatedEditor = context('editor', { requiresApproval: false, isCourseLive: true })
    expect(canEditCoursePricing(ungatedEditor).allowed).toBe(true)

    expect(canEditCoursePricing(context('admin', { isCourseLive: true })).allowed).toBe(true)
  })

  test('holding publish is necessary but not sufficient — a Reviewer still cannot price', () => {
    // The live-course rule only ever *adds* a requirement; it never grants
    // edit_pricing to a role that lacks the static grant.
    const decision = canEditCoursePricing(context('reviewer', { isCourseLive: true }))
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('not_granted')
  })

  test('a draft course only needs the static edit_pricing grant', () => {
    const draftEditor = context('editor', { requiresApproval: true, isCourseLive: false })
    expect(canEditCoursePricing(draftEditor).allowed).toBe(true)
    expect(canEditCoursePricing(context('reviewer', { isCourseLive: false })).reason).toBe(
      'not_granted',
    )
  })
})

describe('capability dispatch', () => {
  test('conditional capabilities route to their rule, plain ones to the table', () => {
    const editor = context('editor', { requiresApproval: true })
    expect(canUseCourseLifecycleCapability('course.publish', editor).reason).toBe('approval_gate')
    expect(canUseCourseLifecycleCapability('course.review', editor).allowed).toBe(true)
    expect(canUseCourseLifecycleCapability('course.edit_pricing', editor).allowed).toBe(true)
    expect(canUseCourseLifecycleCapability('course.create', editor).allowed).toBe(true)
    expect(canUseCourseLifecycleCapability('course.delete', editor).allowed).toBe(false)
    expect(canUseCourseLifecycleCapability('course.delete', editor).reason).toBe('not_granted')
  })

  test('a review context without an author is not treated as own work', () => {
    expect(canUseCourseLifecycleCapability('course.review', context('reviewer')).allowed).toBe(true)
    expect(
      canUseCourseLifecycleCapability('course.review', context('reviewer', { actorId: 'usr_alex' }))
        .allowed,
    ).toBe(true)
  })

  test('the boolean helper is the same decision, without the reason', () => {
    const editor = context('editor', { requiresApproval: true })
    expect(canUseCourseLifecycleCapabilityBoolean('course.publish', editor)).toBe(false)
    expect(canUseCourseLifecycleCapabilityBoolean('course.submit_review', editor)).toBe(true)
  })
})
