import { describe, expect, test } from 'bun:test'
import {
  BADGE_CAP,
  NAV_ITEMS,
  badgeAccessibleName,
  canCreateCourse,
  canReview,
  formatBadgeCount,
  getActiveNavItemId,
  getVisibleNavItems,
} from '#/features/navigation/navigation.config'
import {
  buildModuleCrumbs,
  buildWorkspaceCrumbs,
  buildWorkspaceTabLinks,
} from '#/features/navigation/navigation.breadcrumbs'
import { RESUME_MAX_AGE_MS, resolveResumeDecision } from '#/features/navigation/navigation.resume'
import type {
  CourseWorkspacePreference,
  ResumeFacts,
} from '#/features/navigation/navigation.resume'
import { canSwitchWorkspace } from '#/features/workspaces/workspaces.types'
import type { WorkspaceContext } from '#/features/workspaces/workspaces.types'
import { WORKSPACE_TABS } from '#/features/courses/courses.workspace'
import type { PlatformRole } from '#/features/auth'

/**
 * S-A.1 Global Navigation (spec 02, Revision 3).
 *
 * These are the *contract* tests: the capability map, the active-route rules,
 * the badge maths, the Ge'ez-safe breadcrumb shape, and the Resume authoring
 * conflict table. They are pure, so they run without a router, a database or a
 * DOM.
 */

const ROLES: PlatformRole[] = ['admin', 'editor', 'reviewer', 'viewer', 'support']

/** The S-A.1 wireframe, in order. */
const WIREFRAME_ORDER = [
  'Dashboard',
  'Courses',
  'Content Library',
  'Students',
  'Review',
  'Analytics',
  'Marketing',
  'Settings',
]

describe('Nav Item → Capability map', () => {
  test('the sidebar order is the wireframe order (spec criterion 4)', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(WIREFRAME_ORDER)
  })

  test('an item a role cannot use is absent, never disabled (spec criterion 4)', () => {
    const expected: Record<PlatformRole, string[]> = {
      admin: WIREFRAME_ORDER,
      editor: ['Dashboard', 'Courses', 'Content Library', 'Students', 'Analytics', 'Marketing'],
      reviewer: [
        'Dashboard',
        'Courses',
        'Content Library',
        'Students',
        'Review',
        'Analytics',
        'Marketing',
      ],
      viewer: ['Dashboard', 'Courses', 'Content Library', 'Students', 'Analytics', 'Marketing'],
      support: ['Dashboard', 'Content Library', 'Students', 'Marketing'],
    }

    for (const role of ROLES) {
      expect(getVisibleNavItems(role).map((item) => item.label)).toEqual(expected[role])
    }
  })

  test('Support has no course-authoring nav item at all', () => {
    const support = getVisibleNavItems('support')
    expect(support.some((item) => item.id === 'courses')).toBe(false)
    expect(support.some((item) => item.id === 'review')).toBe(false)
    expect(canCreateCourse('support')).toBe(false)
  })

  test('New Course is absent for Reviewer, Viewer and Support', () => {
    expect(canCreateCourse('admin')).toBe(true)
    expect(canCreateCourse('editor')).toBe(true)
    for (const role of ['reviewer', 'viewer', 'support'] as PlatformRole[]) {
      expect(canCreateCourse(role)).toBe(false)
    }
  })

  test('Review is a separate item for Admin and Reviewer only', () => {
    expect(canReview('admin')).toBe(true)
    expect(canReview('reviewer')).toBe(true)
    expect(canReview('editor')).toBe(false)
    expect(canReview('viewer')).toBe(false)
    expect(canReview('support')).toBe(false)
  })

  test('every item names the capability that grants it', () => {
    for (const item of NAV_ITEMS) {
      expect(item.capability.length).toBeGreaterThan(0)
      expect(item.roles.length).toBeGreaterThan(0)
    }
  })
})

describe('active item', () => {
  test('marks the module a nested route belongs to', () => {
    expect(getActiveNavItemId('admin', '/dashboard')).toBe('dashboard')
    expect(getActiveNavItemId('admin', '/students/badges')).toBe('students')
    expect(getActiveNavItemId('viewer', '/content-library')).toBe('content-library')
  })

  test('the review queue lights Review, never Courses (one aria-current at a time)', () => {
    expect(getActiveNavItemId('admin', '/courses/reviews')).toBe('review')
    expect(getActiveNavItemId('reviewer', '/courses/reviews')).toBe('review')
    expect(getActiveNavItemId('viewer', '/courses/reviews')).toBe(null)
  })

  test('a course workspace keeps Courses active', () => {
    expect(getActiveNavItemId('editor', '/courses/toefl-101')).toBe('courses')
    expect(getActiveNavItemId('admin', '/courses/templates')).toBe('courses')
  })

  test('no active item outside the navigation', () => {
    expect(getActiveNavItemId('admin', '/search')).toBe(null)
  })
})

describe('review badge', () => {
  test('caps at 99+ while the exact count stays in the name', () => {
    expect(formatBadgeCount(0)).toBe('0')
    expect(formatBadgeCount(BADGE_CAP)).toBe('99')
    expect(formatBadgeCount(BADGE_CAP + 1)).toBe('99+')
    expect(badgeAccessibleName(120)).toContain('120')
  })

  test('a mixed assignment reads "2 of 5 assigned to you"', () => {
    expect(badgeAccessibleName(5, 2)).toBe('2 of 5 open reviews assigned to you')
  })

  test('names what is counted', () => {
    expect(badgeAccessibleName(1)).toBe('1 open review awaiting review')
    expect(badgeAccessibleName(3)).toBe('3 open reviews awaiting review')
  })
})

describe('workspace switcher', () => {
  const context = (count: number): WorkspaceContext => ({
    workspaces: Array.from({ length: count }, (_, index) => ({
      id: `w${index}`,
      name: `Workspace ${index}`,
      slug: `w${index}`,
      memberRole: 'member',
      platformRole: 'viewer' as const,
      isActive: index === 0,
    })),
    activeWorkspaceId: 'w0',
    role: 'viewer',
  })

  test('absent for a single-workspace user, never disabled', () => {
    expect(canSwitchWorkspace(context(1))).toBe(false)
    expect(canSwitchWorkspace(context(2))).toBe(true)
    expect(canSwitchWorkspace({ ...context(0), activeWorkspaceId: null })).toBe(false)
  })
})

describe('breadcrumbs', () => {
  test('outside a workspace the trail is the module trail', () => {
    expect(buildModuleCrumbs('/dashboard').map((crumb) => crumb.label)).toEqual(['Dashboard'])
    expect(buildModuleCrumbs('/students/cohorts').map((crumb) => crumb.label)).toEqual([
      'Students',
      'Cohorts',
    ])
  })

  test('intermediate crumbs link, the last crumb is text', () => {
    const crumbs = buildModuleCrumbs('/settings/team')
    expect(crumbs[0]?.to).toBe('/settings')
    expect(crumbs[0]?.isCurrent).toBe(false)
    expect(crumbs.at(-1)?.to).toBeUndefined()
    expect(crumbs.at(-1)?.isCurrent).toBe(true)
  })

  test('inside a workspace: Courses / course / tab, with the tab as a disclosure', () => {
    const crumbs = buildWorkspaceCrumbs(
      {
        coursePublicId: 'toefl',
        courseTitle: 'TOEFL Complete',
        tab: 'curriculum',
        itemExists: true,
        curriculumPending: false,
      },
      { showCoursesCrumb: true },
    )
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Courses', 'TOEFL Complete', 'Curriculum'])
    expect(crumbs.at(-1)?.to).toBeUndefined()
    expect(crumbs.at(-1)?.tabs?.map((tab) => tab.label)).toEqual([
      'Overview',
      'Curriculum',
      'Students',
      'Analytics',
      'Settings',
    ])
    expect(WORKSPACE_TABS).toHaveLength(5)
  })

  test('truncating segments carry the full value for title and aria-label', () => {
    const crumbs = buildWorkspaceCrumbs(
      {
        coursePublicId: 'c1',
        courseTitle: 'TOEFL Complete',
        tab: 'overview',
        itemExists: true,
        curriculumPending: false,
      },
      { showCoursesCrumb: true },
    )
    expect(crumbs[1]?.fullLabel).toBe('TOEFL Complete')
  })

  test('a selected item extends the trail to Courses / course / Curriculum / item', () => {
    const crumbs = buildWorkspaceCrumbs(
      {
        coursePublicId: 'c1',
        courseTitle: 'TOEFL Complete',
        tab: 'curriculum',
        itemPublicId: 'l1',
        itemTitle: 'Skimming Basics',
        itemExists: true,
        curriculumPending: false,
      },
      { showCoursesCrumb: true },
    )
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      'Courses',
      'TOEFL Complete',
      'Curriculum',
      'Skimming Basics',
    ])
  })

  test('an item that no longer exists is dropped rather than linked', () => {
    const crumbs = buildWorkspaceCrumbs(
      {
        coursePublicId: 'c1',
        courseTitle: 'TOEFL Complete',
        tab: 'curriculum',
        itemPublicId: 'gone',
        itemExists: false,
        curriculumPending: false,
      },
      { showCoursesCrumb: true },
    )
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Courses', 'TOEFL Complete', 'Curriculum'])
  })

  test('the item is kept while the curriculum is still loading', () => {
    const crumbs = buildWorkspaceCrumbs(
      {
        coursePublicId: 'c1',
        courseTitle: 'TOEFL Complete',
        tab: 'curriculum',
        itemPublicId: 'l1',
        itemTitle: 'Skimming Basics',
        itemExists: false,
        curriculumPending: true,
      },
      { showCoursesCrumb: true },
    )
    expect(crumbs.at(-1)?.label).toBe('Skimming Basics')
  })

  test('every tab link points at a real workspace destination', () => {
    const links = buildWorkspaceTabLinks('toefl', 'students')
    expect(links.find((link) => link.isActive)?.to).toBe('/courses/toefl?tab=students')
    expect(links.every((link) => link.to.startsWith('/courses/toefl?tab='))).toBe(true)
  })
})

describe('resume authoring', () => {
  const NOW = 1_800_000_000_000

  const preference: CourseWorkspacePreference = {
    coursePublicId: 'toefl',
    courseTitle: 'TOEFL Complete',
    tab: 'curriculum',
    itemPublicId: 'l1',
    savedAt: NOW - 60_000,
  }

  const facts = (overrides: Partial<ResumeFacts> = {}): ResumeFacts => ({
    role: 'editor',
    courseExists: true,
    courseStatus: 'draft',
    itemExists: true,
    curriculumPending: false,
    now: NOW,
    ...overrides,
  })

  test('resumes at the tab and item the user left', () => {
    const decision = resolveResumeDecision(preference, facts())
    expect(decision.kind).toBe('resume')
    if (decision.kind !== 'resume') return
    expect(decision.to).toBe('/courses/toefl?tab=curriculum&item=l1')
  })

  test('no preference means no control', () => {
    expect(resolveResumeDecision(null, facts())).toEqual({
      kind: 'hidden',
      reason: 'no-preference',
      clearPreference: false,
    })
  })

  test('never shown for a Viewer, under any condition', () => {
    expect(resolveResumeDecision(preference, facts({ role: 'viewer' })).kind).toBe('hidden')
  })

  test('hidden once course.manage_curriculum is lost to a role change', () => {
    const decision = resolveResumeDecision(preference, facts({ role: 'reviewer' }))
    expect(decision).toMatchObject({ kind: 'hidden', reason: 'not-authoring' })
  })

  test('hidden for an archived course, and the preference is kept', () => {
    expect(resolveResumeDecision(preference, facts({ courseStatus: 'archived' }))).toEqual({
      kind: 'hidden',
      reason: 'course-archived',
      clearPreference: false,
    })
  })

  test('hidden for a deleted course, and the stale preference is cleared', () => {
    expect(resolveResumeDecision(preference, facts({ courseExists: false }))).toEqual({
      kind: 'hidden',
      reason: 'course-deleted',
      clearPreference: true,
    })
  })

  test('older than seven days is hidden, and the preference is retained', () => {
    const stale = { ...preference, savedAt: NOW - RESUME_MAX_AGE_MS - 1 }
    expect(resolveResumeDecision(stale, facts())).toEqual({
      kind: 'hidden',
      reason: 'stale',
      clearPreference: false,
    })
  })

  test('exactly seven days old is still offered', () => {
    const edge = { ...preference, savedAt: NOW - RESUME_MAX_AGE_MS }
    expect(resolveResumeDecision(edge, facts()).kind).toBe('resume')
  })

  test('an archived or moved item falls back to the course Overview and says so', () => {
    const decision = resolveResumeDecision(preference, facts({ itemExists: false }))
    expect(decision.kind).toBe('fallback')
    if (decision.kind !== 'fallback') return
    expect(decision.to).toBe('/courses/toefl?tab=overview')
    expect(decision.message).toBe('That lesson was archived. Opening TOEFL Complete.')
  })

  test('absence is not a fact while the curriculum is loading', () => {
    expect(
      resolveResumeDecision(preference, facts({ itemExists: false, curriculumPending: true })).kind,
    ).toBe('resume')
  })

  test('a course left outside the Curriculum tab resumes at its own tab', () => {
    const decision = resolveResumeDecision({ ...preference, tab: 'settings' }, facts())
    expect(decision.kind === 'resume' && decision.to).toBe('/courses/toefl?tab=settings')
  })
})
