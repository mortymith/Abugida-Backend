import { describe, expect, test } from 'bun:test'
import {
  canSelfApprove,
  canTransitionLifecycle,
  COURSE_CAPABILITIES,
  effectiveCapabilities,
  hasCapability,
  renderRule,
} from '#/features/courses/courses.capabilities'
import type { CourseCapability } from '#/features/courses/courses.capabilities'
import { resolveFieldLock } from '#/features/courses/courses.field-lock'
import type { CourseLifecycleState } from '#/features/courses/courses.workspace'

describe('capability matrix', () => {
  test('admin has every authoring/admin capability', () => {
    // Admin has every capability except the Support-only ones
    // (courses.read_enrolled_context, students.message for support-only
    // contexts, testimonials.moderate, audit.read_own_actions).
    const supportOnly: CourseCapability[] = [
      'courses.read_enrolled_context',
      'testimonials.moderate',
      'audit.read_own_actions',
    ]
    for (const cap of COURSE_CAPABILITIES) {
      if (supportOnly.includes(cap)) continue
      expect(hasCapability('admin', cap)).toBe(true)
    }
    expect(hasCapability('admin', 'course.delete')).toBe(true)
    expect(hasCapability('admin', 'course.unpublish')).toBe(true)
  })

  test('owner maps to admin capabilities', () => {
    expect(hasCapability('owner', 'course.delete')).toBe(true)
    expect(hasCapability('owner', 'course.archive')).toBe(true)
  })

  test('editor cannot unpublish, archive, restore, or delete', () => {
    expect(hasCapability('editor', 'course.unpublish')).toBe(false)
    expect(hasCapability('editor', 'course.archive')).toBe(false)
    expect(hasCapability('editor', 'course.restore')).toBe(false)
    expect(hasCapability('editor', 'course.delete')).toBe(false)
  })

  test('editor can grade assignments (Admin AND Editor)', () => {
    expect(hasCapability('editor', 'assignment.grade')).toBe(true)
    expect(hasCapability('admin', 'assignment.grade')).toBe(true)
    expect(hasCapability('reviewer', 'assignment.grade')).toBe(false)
  })

  test('reviewer can review and publish but not edit', () => {
    expect(hasCapability('reviewer', 'course.review')).toBe(true)
    expect(hasCapability('reviewer', 'course.publish')).toBe(true)
    expect(hasCapability('reviewer', 'course.edit_details')).toBe(false)
    expect(hasCapability('reviewer', 'course.manage_curriculum')).toBe(false)
  })

  test('support sees students only', () => {
    expect(hasCapability('support', 'students.read')).toBe(true)
    expect(hasCapability('support', 'students.message')).toBe(true)
    expect(hasCapability('support', 'course.edit_details')).toBe(false)
    expect(hasCapability('support', 'course.manage_curriculum')).toBe(false)
  })

  test('finance.view_revenue is denied for support', () => {
    expect(hasCapability('support', 'finance.view_revenue')).toBe(false)
  })
})

describe('effectiveCapabilities', () => {
  test('member + course editor = editor capabilities', () => {
    const result = effectiveCapabilities('member', 'editor')
    expect(result.has('course.edit_details')).toBe(true)
    expect(result.has('course.delete')).toBe(false)
  })

  test('admin member role = full set, course role is redundant', () => {
    const result = effectiveCapabilities('admin', 'editor')
    expect(result.has('course.delete')).toBe(true)
  })

  test('member + course admin = course admin capabilities (member caps)', () => {
    const result = effectiveCapabilities('member', 'admin')
    expect(result.has('course.delete')).toBe(true)
  })

  test('member with no course role = empty set', () => {
    const result = effectiveCapabilities('member', null)
    expect(result.size).toBe(0)
  })
})

describe('renderRule — three-case permission', () => {
  test('case 1: out of capability → absent', () => {
    // Support viewer lacks course.edit_details
    const supportCaps = effectiveCapabilities('member', 'support')
    const rule = renderRule('course.title', resolveFieldLock, 'draft', supportCaps)
    expect(rule.mode).toBe('absent')
  })

  test('case 2: capable but blocked by state → disabled with reason', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    // item.title in approved state is locked-w-reason
    const rule = renderRule('item.title', resolveFieldLock, 'approved', editorCaps)
    expect(rule.mode).toBe('disabled')
    if (rule.mode === 'disabled') {
      expect(rule.reason).toContain('Approved')
    }
  })

  test('case 3 precursor: confirm mode for live course edits', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    const rule = renderRule('course.title', resolveFieldLock, 'published', editorCaps)
    expect(rule.mode).toBe('confirm')
    if (rule.mode === 'confirm') {
      expect(rule.confirmTitle).toBeDefined()
    }
  })

  test('editable when capable and state allows', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    const rule = renderRule('course.title', resolveFieldLock, 'draft', editorCaps)
    expect(rule.mode).toBe('editable')
  })

  test('item.visibility is absent in In Review state (lifecycle owns it)', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    const rule = renderRule('item.visibility', resolveFieldLock, 'in_review', editorCaps)
    expect(rule.mode).toBe('absent')
  })
})

describe('canTransitionLifecycle', () => {
  const allStates: CourseLifecycleState[] = [
    'draft',
    'in_review',
    'approved',
    'published',
    'archived',
  ]

  test('admin can do every transition', () => {
    const adminCaps = effectiveCapabilities('admin', null)
    for (const from of allStates) {
      for (const to of allStates) {
        if (from === to) continue
        // Admin can do every valid transition (invalid ones like archived→published still false)
        const result = canTransitionLifecycle(from, to, adminCaps, false)
        // Valid transitions for admin: all in the spec table
        const validAdminTransitions: Array<[string, string]> = [
          ['draft', 'in_review'],
          ['draft', 'published'],
          ['in_review', 'draft'],
          ['in_review', 'approved'],
          ['in_review', 'published'],
          ['approved', 'draft'],
          ['approved', 'published'],
          ['published', 'draft'],
          ['published', 'archived'],
          ['archived', 'draft'],
        ]
        const isValid = validAdminTransitions.some(([f, t]) => f === from && t === to)
        expect(result).toBe(isValid)
      }
    }
  })

  test('editor can submit for review when requiresApproval on', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    expect(canTransitionLifecycle('draft', 'in_review', editorCaps, true)).toBe(true)
  })

  test('editor cannot submit for review when requiresApproval off (no transition needed)', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    expect(canTransitionLifecycle('draft', 'in_review', editorCaps, false)).toBe(false)
  })

  test('editor cannot unpublish (admin only)', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    expect(canTransitionLifecycle('published', 'draft', editorCaps, false)).toBe(false)
  })

  test('editor cannot archive (admin only)', () => {
    const editorCaps = effectiveCapabilities('member', 'editor')
    expect(canTransitionLifecycle('published', 'archived', editorCaps, false)).toBe(false)
  })

  test('reviewer can approve (in_review → approved)', () => {
    const reviewerCaps = effectiveCapabilities('member', 'reviewer')
    expect(canTransitionLifecycle('in_review', 'approved', reviewerCaps, false)).toBe(true)
  })

  test('reviewer can publish on approval (in_review → published) when has course.publish', () => {
    const reviewerCaps = effectiveCapabilities('member', 'reviewer')
    expect(canTransitionLifecycle('in_review', 'published', reviewerCaps, false)).toBe(true)
  })
})

describe('canSelfApprove', () => {
  test('false when author is the current user', () => {
    expect(canSelfApprove('user-1', 'user-1')).toBe(false)
  })

  test('true when author is a different user', () => {
    expect(canSelfApprove('user-1', 'user-2')).toBe(true)
  })
})
