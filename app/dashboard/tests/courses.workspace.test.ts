import { describe, expect, test } from 'bun:test'
import {
  buildCourseWorkspaceHref,
  buildLessonAliasHref,
  canTransitionCourseLifecycle,
  COURSE_LIFECYCLE_STATES,
  CURRICULUM_ITEM_KINDS,
  CURRICULUM_TAB,
  DEFAULT_WORKSPACE_TAB,
  deriveCurriculumItemKind,
  isCourseLifecycleState,
  isCourseVisibleToStudents,
  isCourseWorkspaceTab,
  isCurriculumItemKind,
  isSaveState,
  isUnresolvedSaveState,
  normalizeItemPublicId,
  parseCourseWorkspaceSearch,
  SAVE_STATE_EXTENSIONS,
  SAVE_STATE_EXTENSION_LABELS,
  SAVE_STATE_LABELS,
  SAVE_STATES,
  saveStateBlocksNavigation,
  serializeCourseWorkspaceSearch,
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

describe('course lifecycle union (spec 04)', () => {
  test('is draft → in_review → published → archived', () => {
    expect([...COURSE_LIFECYCLE_STATES]).toEqual(['draft', 'in_review', 'published', 'archived'])
  })

  test('guards narrow the union', () => {
    expect(isCourseLifecycleState('in_review')).toBe(true)
    expect(isCourseLifecycleState('In Review')).toBe(false)
  })

  test('only a published course is visible to students', () => {
    expect(isCourseVisibleToStudents('published')).toBe(true)
    expect(isCourseVisibleToStudents('in_review')).toBe(false)
    expect(isCourseVisibleToStudents('archived')).toBe(false)
  })

  test('archived restores to draft, never straight to published', () => {
    expect(canTransitionCourseLifecycle('archived', 'draft')).toBe(true)
    expect(canTransitionCourseLifecycle('archived', 'published')).toBe(false)
    expect(canTransitionCourseLifecycle('published', 'archived')).toBe(true)
    expect(canTransitionCourseLifecycle('published', 'in_review')).toBe(false)
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
    expect(parseCourseWorkspaceSearch(params)).toEqual({ tab: 'analytics' })
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
      { tab: 'analytics' },
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
    expect(cleaned).toBe('?tab=analytics')
    expect(parseCourseWorkspaceSearch(cleaned)).toEqual({ tab: 'analytics' })
  })

  test('builds workspace and lesson-alias hrefs', () => {
    expect(buildCourseWorkspaceHref('/courses/crs_1', { tab: 'analytics' })).toBe(
      '/courses/crs_1?tab=analytics',
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
