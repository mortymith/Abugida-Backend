import { describe, expect, test } from 'bun:test'
import {
  ANALYTICS_TABS,
  buildCourseWorkspaceHref,
  buildLessonAliasHref,
  canAccessWorkspaceTab,
  canTransitionCourseLifecycle,
  COUNTED_WORKSPACE_TABS,
  courseLifecycleCta,
  COURSE_LIFECYCLE_STATES,
  CURRICULUM_ITEM_KINDS,
  CURRICULUM_TAB,
  DEFAULT_ANALYTICS_TAB,
  DEFAULT_WORKSPACE_TAB,
  deriveCourseLifecycleState,
  deriveCurriculumItemKind,
  isCourseAnalyticsTab,
  isCourseLifecycleState,
  isCourseVisibleToStudents,
  isCourseWorkspaceTab,
  isCurriculumItemKind,
  isInPublishedSet,
  isInPublishedSetAt,
  isItemVisibility,
  ITEM_VISIBILITY_LABELS,
  ITEM_VISIBILITIES,
  isSaveState,
  isUnresolvedSaveState,
  normalizeItemPublicId,
  itemVisibilityPillLabel,
  parseCourseWorkspaceSearch,
  resolveAnalyticsTab,
  resolveWorkspaceTab,
  SAVE_STATE_EXTENSIONS,
  SAVE_STATE_EXTENSION_LABELS,
  SAVE_STATE_LABELS,
  SAVE_STATES,
  saveStateBlocksNavigation,
  serializeCourseWorkspaceSearch,
  validateCourseWorkspaceSearch,
  workspaceTabsForRole,
  WORKSPACE_TABS,
} from '#/features/courses/courses.workspace'
import type { CourseWorkspaceSearchParams } from '#/features/courses/courses.workspace'

describe('workspace tab union (S-2.6 shell)', () => {
  test('is exactly the five spec tabs, in nav order', () => {
    expect([...WORKSPACE_TABS]).toEqual([
      'overview',
      'curriculum',
      'students',
      'analytics',
      'settings',
    ])
  })

  test('overview is the default tab', () => {
    expect(DEFAULT_WORKSPACE_TAB).toBe('overview')
    expect(CURRICULUM_TAB).toBe('curriculum')
  })

  test('isCourseWorkspaceTab narrows only known tabs', () => {
    expect(isCourseWorkspaceTab('analytics')).toBe(true)
    expect(isCourseWorkspaceTab('wizard')).toBe(false)
    expect(isCourseWorkspaceTab(undefined)).toBe(false)
    expect(isCourseWorkspaceTab(3)).toBe(false)
  })
})

describe('curriculum item kind union (spec 04 taxonomy)', () => {
  test('is exactly lesson | quiz | assignment', () => {
    expect([...CURRICULUM_ITEM_KINDS]).toEqual(['lesson', 'quiz', 'assignment'])
  })

  test('kind is derived from contentType, not stored', () => {
    expect(deriveCurriculumItemKind('video')).toBe('lesson')
    expect(deriveCurriculumItemKind('pdf')).toBe('lesson')
    expect(deriveCurriculumItemKind('link')).toBe('lesson')
    expect(deriveCurriculumItemKind('quiz')).toBe('quiz')
    expect(deriveCurriculumItemKind('exercise')).toBe('assignment')
  })

  test('derivation is case/whitespace tolerant and rejects unknown types', () => {
    expect(deriveCurriculumItemKind('  VIDEO ')).toBe('lesson')
    expect(deriveCurriculumItemKind('simulcast')).toBeNull()
    expect(deriveCurriculumItemKind(42)).toBeNull()
    expect(deriveCurriculumItemKind(null)).toBeNull()
  })

  test('isCurriculumItemKind guards the union', () => {
    expect(isCurriculumItemKind('assignment')).toBe(true)
    expect(isCurriculumItemKind('section')).toBe(false)
  })
})

describe('save-state vocabulary (S-7.8)', () => {
  test('is the six shared states, in indicator order', () => {
    expect([...SAVE_STATES]).toEqual(['idle', 'dirty', 'saving', 'saved', 'error', 'conflict'])
  })

  test('suspended/offline are extensions, not part of the save contract', () => {
    expect([...SAVE_STATE_EXTENSIONS]).toEqual(['suspended', 'offline'])
    expect(isSaveState('suspended')).toBe(false)
  })

  test('every state has a label — no surface invents its own wording', () => {
    for (const state of SAVE_STATES) {
      expect(SAVE_STATE_LABELS[state]).toBeTruthy()
    }
    expect(SAVE_STATE_EXTENSION_LABELS.suspended).toBeTruthy()
    expect(SAVE_STATE_EXTENSION_LABELS.offline).toBeTruthy()
  })

  test('dirty/error/conflict block navigation until the buffer is flushed', () => {
    expect(saveStateBlocksNavigation('dirty')).toBe(true)
    expect(saveStateBlocksNavigation('error')).toBe(true)
    expect(saveStateBlocksNavigation('conflict')).toBe(true)
    expect(saveStateBlocksNavigation('idle')).toBe(false)
    expect(saveStateBlocksNavigation('saved')).toBe(false)
  })

  test('error and conflict stay visible until resolved', () => {
    expect(isUnresolvedSaveState('error')).toBe(true)
    expect(isUnresolvedSaveState('conflict')).toBe(true)
    expect(isUnresolvedSaveState('saving')).toBe(false)
  })
})

describe('course lifecycle union (spec 04 Revision 3)', () => {
  test('is draft → in_review → approved → published → archived', () => {
    expect([...COURSE_LIFECYCLE_STATES]).toEqual([
      'draft',
      'in_review',
      'approved',
      'published',
      'archived',
    ])
  })

  test('guards narrow the union', () => {
    expect(isCourseLifecycleState('in_review')).toBe(true)
    expect(isCourseLifecycleState('approved')).toBe(true)
    expect(isCourseLifecycleState('In Review')).toBe(false)
  })

  test('only a published course is visible to students', () => {
    expect(isCourseVisibleToStudents('published')).toBe(true)
    expect(isCourseVisibleToStudents('in_review')).toBe(false)
    expect(isCourseVisibleToStudents('approved')).toBe(false)
    expect(isCourseVisibleToStudents('archived')).toBe(false)
  })

  test('archived restores to draft, never straight to published', () => {
    expect(canTransitionCourseLifecycle('archived', 'draft')).toBe(true)
    expect(canTransitionCourseLifecycle('archived', 'published')).toBe(false)
    expect(canTransitionCourseLifecycle('published', 'archived')).toBe(true)
    expect(canTransitionCourseLifecycle('published', 'in_review')).toBe(false)
  })

  test('Approved is derived, not stored: a draft with approved_at set', () => {
    const approvedAt = new Date().toISOString()
    expect(deriveCourseLifecycleState({ status: 'draft' })).toBe('draft')
    expect(deriveCourseLifecycleState({ status: 'draft', approvedAt: null })).toBe('draft')
    expect(deriveCourseLifecycleState({ status: 'draft', approvedAt })).toBe('approved')
    // A stale approval must not resurrect once the course is live or withdrawn.
    expect(deriveCourseLifecycleState({ status: 'published', approvedAt })).toBe('published')
    expect(deriveCourseLifecycleState({ status: 'in_review', approvedAt })).toBe('in_review')
    expect(deriveCourseLifecycleState({ status: 'archived', approvedAt })).toBe('archived')
  })

  test('the CTA names the state a course is actually in', () => {
    // A gated draft submits for review so an Editor cannot self-approve; an
    // ungated one publishes straight from Draft.
    expect(courseLifecycleCta('draft', true)).toEqual({
      action: 'submit',
      label: 'Submit for review',
    })
    expect(courseLifecycleCta('draft', false)).toEqual({ action: 'publish', label: 'Publish' })
    expect(courseLifecycleCta('in_review', true)).toEqual({ action: 'withdraw', label: 'Withdraw' })
    // Approved is precisely the state that sits between review and publication.
    expect(courseLifecycleCta('approved', true)).toEqual({ action: 'publish', label: 'Publish' })
    expect(courseLifecycleCta('published', true)).toEqual({
      action: 'unpublish',
      label: 'Unpublish',
    })
    expect(courseLifecycleCta('archived', true)).toEqual({ action: 'restore', label: 'Restore' })
  })
})

describe('workspace search params (spec 00 § 2.6 route shape)', () => {
  test('parses tab + item publicId', () => {
    expect(parseCourseWorkspaceSearch('?tab=curriculum&item=les_9f2a')).toEqual({
      tab: 'curriculum',
      item: 'les_9f2a',
    })
  })

  test('a missing tab falls back to overview', () => {
    expect(parseCourseWorkspaceSearch({})).toEqual({ tab: 'overview' })
    expect(parseCourseWorkspaceSearch('')).toEqual({ tab: 'overview' })
    expect(parseCourseWorkspaceSearch(null)).toEqual({ tab: 'overview' })
    expect(parseCourseWorkspaceSearch(undefined)).toEqual({ tab: 'overview' })
  })

  test('an invalid tab falls back to overview and drops the item', () => {
    expect(parseCourseWorkspaceSearch('?tab=wizard&item=les_9f2a')).toEqual({ tab: 'overview' })
    expect(parseCourseWorkspaceSearch({ tab: 'publish', item: 'les_9f2a' })).toEqual({
      tab: 'overview',
    })
    expect(parseCourseWorkspaceSearch({ tab: 7 })).toEqual({ tab: 'overview' })
  })

  test('item is ignored outside the curriculum tab', () => {
    expect(parseCourseWorkspaceSearch('?tab=settings&item=les_9f2a')).toEqual({ tab: 'settings' })
  })

  test('accepts URLSearchParams and a bare query string', () => {
    const params = new URLSearchParams({ tab: 'analytics' })
    expect(parseCourseWorkspaceSearch(params)).toEqual({
      tab: 'analytics',
      atab: DEFAULT_ANALYTICS_TAB,
    })
    expect(parseCourseWorkspaceSearch('tab=students')).toEqual({ tab: 'students' })
  })

  test('rejects values that cannot be a publicId', () => {
    expect(parseCourseWorkspaceSearch('?tab=curriculum&item=')).toEqual({ tab: 'curriculum' })
    expect(parseCourseWorkspaceSearch('?tab=curriculum&item=%20%20')).toEqual({ tab: 'curriculum' })
    expect(normalizeItemPublicId('les 9f2a')).toBeUndefined()
    expect(normalizeItemPublicId('les/9f2a')).toBeUndefined()
    expect(normalizeItemPublicId('  les_9f2a  ')).toBe('les_9f2a')
  })

  test('serialises the active tab always, so every tab is linkable', () => {
    expect(serializeCourseWorkspaceSearch({ tab: 'overview' })).toBe('?tab=overview')
    expect(serializeCourseWorkspaceSearch({ tab: 'students' })).toBe('?tab=students')
  })

  test('round-trips every tab, with and without an item', () => {
    const cases: CourseWorkspaceSearchParams[] = [
      { tab: 'overview' },
      { tab: 'curriculum' },
      { tab: 'curriculum', item: 'les_9f2a' },
      { tab: 'students' },
      // An `analytics` tab always carries its `atab` after a round-trip, because
      // `performance` is the default and is written explicitly to make the URL
      // self-describing (spec: "an unknown value falls back to it").
      { tab: 'analytics', atab: 'performance' },
      { tab: 'analytics', atab: 'dropoff' },
      { tab: 'settings' },
    ]
    for (const params of cases) {
      expect(parseCourseWorkspaceSearch(serializeCourseWorkspaceSearch(params))).toEqual(params)
    }
  })

  test('round-trips through a search object the way a router hands it back', () => {
    const query = serializeCourseWorkspaceSearch({ tab: 'curriculum', item: 'les_9f2a' })
    const asObject = Object.fromEntries(new URLSearchParams(query).entries())
    expect(parseCourseWorkspaceSearch(asObject)).toEqual({ tab: 'curriculum', item: 'les_9f2a' })
  })

  test('an item on a non-curriculum tab never survives a round-trip', () => {
    const dirty: CourseWorkspaceSearchParams = { tab: 'analytics', item: 'les_9f2a' }
    const cleaned = serializeCourseWorkspaceSearch(dirty)
    expect(cleaned).toBe('?tab=analytics&atab=performance')
    expect(parseCourseWorkspaceSearch(cleaned)).toEqual({ tab: 'analytics', atab: 'performance' })
  })

  test('builds workspace and lesson-alias hrefs', () => {
    expect(buildCourseWorkspaceHref('/courses/crs_1', { tab: 'analytics' })).toBe(
      '/courses/crs_1?tab=analytics&atab=performance',
    )
    expect(
      buildCourseWorkspaceHref('/courses/crs_1/', { tab: 'curriculum', item: 'les_9f2a' }),
    ).toBe('/courses/crs_1?tab=curriculum&item=les_9f2a')
    // One editor, two hosts: the alias route redirects into the workspace pane.
    expect(buildLessonAliasHref('/courses/crs_1', 'les_9f2a')).toBe(
      '/courses/crs_1?tab=curriculum&item=les_9f2a',
    )
  })
})

describe('analytics sub-tabs (S-2.19, mirrored in ?atab=)', () => {
  test('is exactly the four spec sub-tabs', () => {
    expect([...ANALYTICS_TABS]).toEqual(['performance', 'dropoff', 'quizzes', 'items'])
  })

  test('an unknown atab falls back to performance', () => {
    expect(resolveAnalyticsTab('items')).toBe('items')
    expect(resolveAnalyticsTab('wizard')).toBe(DEFAULT_ANALYTICS_TAB)
    expect(resolveAnalyticsTab(undefined)).toBe(DEFAULT_ANALYTICS_TAB)
    expect(isCourseAnalyticsTab('dropoff')).toBe(true)
    expect(isCourseAnalyticsTab('revenue')).toBe(false)
  })

  test('atab is ignored outside the analytics tab', () => {
    expect(parseCourseWorkspaceSearch('?tab=settings&atab=quizzes')).toEqual({ tab: 'settings' })
  })
})

describe('workspace role access (S-2.6 routing contract)', () => {
  test('Support sees the Students tab only — absent, not disabled', () => {
    expect([...workspaceTabsForRole('support')]).toEqual(['students'])
    expect(canAccessWorkspaceTab('support', 'students')).toBe(true)
    expect(canAccessWorkspaceTab('support', 'curriculum')).toBe(false)
    expect(canAccessWorkspaceTab('support', 'overview')).toBe(false)
  })

  test('every other role gets all five destinations in nav order', () => {
    for (const role of ['admin', 'editor', 'reviewer', 'viewer']) {
      expect([...workspaceTabsForRole(role)]).toEqual([...WORKSPACE_TABS])
    }
  })

  test('an unrecognised role falls back to the read-only set', () => {
    // An unknown capability must never grant an authoring surface.
    expect([...workspaceTabsForRole('superuser')]).toEqual(['students'])
  })

  test('a deep link Support may not open lands on their default tab', () => {
    expect(resolveWorkspaceTab('support', 'analytics')).toBe('students')
    expect(resolveWorkspaceTab('support', 'students')).toBe('students')
    expect(resolveWorkspaceTab('admin', 'analytics')).toBe('analytics')
  })

  test('only Curriculum and Students carry a count badge', () => {
    expect([...COUNTED_WORKSPACE_TABS]).toEqual(['curriculum', 'students'])
  })
})

describe('item visibility and the published set (spec 04 Revision 3)', () => {
  test('is draft / published / scheduled', () => {
    expect([...ITEM_VISIBILITIES]).toEqual(['draft', 'published', 'scheduled'])
    expect(isItemVisibility('scheduled')).toBe(true)
    expect(isItemVisibility('live')).toBe(false)
  })

  test('the published set is published and not archived and not deleted', () => {
    expect(isInPublishedSet({ visibility: 'published', archivedAt: null, deletedAt: null })).toBe(
      true,
    )
    // Unpublished, scheduled, archived and deleted all fall out of it.
    expect(isInPublishedSet({ visibility: 'draft', archivedAt: null, deletedAt: null })).toBe(false)
    expect(isInPublishedSet({ visibility: 'scheduled', archivedAt: null, deletedAt: null })).toBe(
      false,
    )
    expect(
      isInPublishedSet({ visibility: 'published', archivedAt: new Date().toISOString() }),
    ).toBe(false)
    expect(isInPublishedSet({ visibility: 'published', deletedAt: new Date().toISOString() })).toBe(
      false,
    )
  })

  test('a scheduled item joins the published set once its moment passes', () => {
    const now = new Date()
    const item = {
      visibility: 'scheduled' as const,
      scheduledPublishAt: new Date(now.getTime() + 60_000).toISOString(),
      archivedAt: null,
      deletedAt: null,
    }
    expect(isInPublishedSetAt(item, now)).toBe(false)
    expect(isInPublishedSetAt(item, new Date(now.getTime() + 120_000))).toBe(true)
    // A schedule with no date never counts — it is not a promise.
    expect(isInPublishedSetAt({ ...item, scheduledPublishAt: null }, now)).toBe(false)
  })

  test('only a draft publishes an unnamed pill — published is the happy path', () => {
    expect(itemVisibilityPillLabel('draft')).toBe(ITEM_VISIBILITY_LABELS.draft)
    expect(itemVisibilityPillLabel('published')).toBeNull()
    expect(itemVisibilityPillLabel('scheduled')).toBe(ITEM_VISIBILITY_LABELS.scheduled)
    expect(itemVisibilityPillLabel('scheduled', new Date('2026-09-15T09:00:00Z'))).toBe(
      'Scheduled 15 Sep',
    )
  })
})

describe('validateCourseWorkspaceSearch (the route shape)', () => {
  test('every field stays optional, so a link may omit search entirely', () => {
    // The whole point of the separate route shape: a required `tab` here would
    // force every `<Link to="/courses/$courseId">` in the app to name a tab.
    expect(validateCourseWorkspaceSearch({})).toEqual({})
    expect(validateCourseWorkspaceSearch({ tab: 'curriculum' })).toEqual({ tab: 'curriculum' })
  })

  test('an unrecognised tab is dropped rather than defaulted', () => {
    // Defaulting belongs to `parseCourseWorkspaceSearch`; the route keeps the
    // absence so the shell decides what the role should land on.
    expect(validateCourseWorkspaceSearch({ tab: 'nonsense' })).toEqual({})
    expect(validateCourseWorkspaceSearch({ tab: 42 })).toEqual({})
  })

  test('item survives only on the curriculum tab or with no tab at all', () => {
    expect(validateCourseWorkspaceSearch({ item: 'les_abc' })).toEqual({ item: 'les_abc' })
    expect(validateCourseWorkspaceSearch({ tab: 'curriculum', item: 'les_abc' })).toEqual({
      tab: 'curriculum',
      item: 'les_abc',
    })
    // On any other tab the param is meaningless, so it is dropped — same rule
    // the parser applies, from the same predicates.
    expect(validateCourseWorkspaceSearch({ tab: 'students', item: 'les_abc' })).toEqual({
      tab: 'students',
    })
  })

  test('a malformed item is dropped, not passed through to open a dead pane', () => {
    for (const bad of ['', '  ', 'has space', 'has/slash', 'x'.repeat(129)]) {
      expect(validateCourseWorkspaceSearch({ tab: 'curriculum', item: bad })).toEqual({
        tab: 'curriculum',
      })
    }
  })

  test('atab is resolved to the default on the analytics tab only', () => {
    expect(validateCourseWorkspaceSearch({ tab: 'analytics' })).toEqual({
      tab: 'analytics',
      atab: 'performance',
    })
    expect(validateCourseWorkspaceSearch({ tab: 'analytics', atab: 'bogus' })).toEqual({
      tab: 'analytics',
      atab: 'performance',
    })
    expect(validateCourseWorkspaceSearch({ tab: 'analytics', atab: 'dropoff' })).toEqual({
      tab: 'analytics',
      atab: 'dropoff',
    })
    expect(validateCourseWorkspaceSearch({ tab: 'overview', atab: 'dropoff' })).toEqual({
      tab: 'overview',
    })
  })

  test('the route shape and the resolved shape agree on every legal value', () => {
    // The two functions share their predicates; this pins that they cannot
    // drift on what a legal value is — only on whether a default is applied.
    for (const tab of WORKSPACE_TABS) {
      const raw = { tab }
      const validated = validateCourseWorkspaceSearch(raw)
      expect(validated.tab).toBe(tab)
      expect(parseCourseWorkspaceSearch(raw).tab).toBe(tab)
    }
  })
})
