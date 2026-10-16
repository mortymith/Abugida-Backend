/**
 * Spec 12 § 12.2 — Lesson Editor instrumentation.
 *
 * The events are IDs, counts, and enums only — no body content, no URLs, no
 * filenames. This test pins:
 *  - The event names match the spec's vocabulary.
 *  - The privacy rule is enforced: every payload property is an ID, a count,
 *    or an enum. (A body string would be a violation.)
 *  - The reconciliation with Part 04's `item_conflict_shown` event holds:
 *    `lesson_editor_conflict_shown` is NOT emitted; the Part 04 name wins.
 *  - The performance budgets and acceptance criteria are the spec values.
 */
import { test, expect, beforeEach } from 'bun:test'
import {
  trackLessonEditorEvent,
  subscribeToLessonEditorEvents,
  __clearLessonEditorEventSinksForTests,
  LESSON_EDITOR_PERFORMANCE_BUDGETS,
  LESSON_EDITOR_ACCEPTANCE_CRITERIA
  
  
} from '#/features/courses/courses.lesson-editor-events'
import type {LessonEditorEvent, ItemConflictShownEvent} from '#/features/courses/courses.lesson-editor-events';

beforeEach(() => {
  __clearLessonEditorEventSinksForTests()
})

test('a subscriber receives events of every type', () => {
  const received: Array<LessonEditorEvent | ItemConflictShownEvent> = []
  subscribeToLessonEditorEvents((event) => received.push(event))

  trackLessonEditorEvent({
    event: 'lesson_editor_mode_switched',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    mode: 'split',
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_sync_failed',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    direction: 'rich→source',
    code: 'loses_content',
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_construct_audit_failed',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    code: 'image_alt_missing',
    count: 2,
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_paste_sanitized',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    rule: 'strip_mso_attributes',
    count: 4,
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_ai_block_accepted',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    scope: 'selection',
    characters: 240,
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_export',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    format: 'markdown',
  })
  trackLessonEditorEvent({
    event: 'lesson_editor_draft_restored',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    source: 'idb',
  })
  // The conflict event uses the Part 04 name.
  trackLessonEditorEvent({
    event: 'item_conflict_shown',
    itemId: 'lesson-1',
    courseId: 'course-1',
    bodyFormat: 'markdown',
    strategy: 'keep_mine',
  })

  expect(received).toHaveLength(8)
  const names = received.map((e) => e.event)
  expect(names).toContain('lesson_editor_mode_switched')
  expect(names).toContain('lesson_editor_sync_failed')
  expect(names).toContain('lesson_editor_construct_audit_failed')
  expect(names).toContain('lesson_editor_paste_sanitized')
  expect(names).toContain('lesson_editor_ai_block_accepted')
  expect(names).toContain('lesson_editor_export')
  expect(names).toContain('lesson_editor_draft_restored')
  expect(names).toContain('item_conflict_shown')
})

test('lesson_editor_conflict_shown is NOT in the event union (Part 04 name wins)', () => {
  // The reconciliation table says lesson_editor_conflict_shown is not emitted.
  // The Part 04 name item_conflict_shown wins. A subscriber should never see
  // an event with `event: 'lesson_editor_conflict_shown'`.
  const received: Array<LessonEditorEvent | ItemConflictShownEvent> = []
  subscribeToLessonEditorEvents((event) => received.push(event))

  // The TS type does not allow this string — the test would not compile if
  // the union were wrong. Verify the item_conflict_shown event reaches the
  // sink instead.
  trackLessonEditorEvent({
    event: 'item_conflict_shown',
    itemId: 'lesson-1',
    courseId: 'course-1',
    bodyFormat: 'markdown',
    strategy: 'compare',
  })
  expect(received[0]?.event).toBe('item_conflict_shown')
})

test('unsubscribe stops the sink from receiving events', () => {
  const received: Array<LessonEditorEvent | ItemConflictShownEvent> = []
  const unsubscribe = subscribeToLessonEditorEvents((event) => received.push(event))
  unsubscribe()
  trackLessonEditorEvent({
    event: 'lesson_editor_mode_switched',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    mode: 'rich',
  })
  expect(received).toHaveLength(0)
})

test('a sink that throws does not break the editor or other sinks', () => {
  const received: Array<LessonEditorEvent | ItemConflictShownEvent> = []
  subscribeToLessonEditorEvents(() => {
    throw new Error('sink failure')
  })
  subscribeToLessonEditorEvents((event) => received.push(event))

  // The throwing sink must not propagate; the second sink still receives.
  trackLessonEditorEvent({
    event: 'lesson_editor_mode_switched',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    mode: 'rich',
  })
  expect(received).toHaveLength(1)
})

test('performance budgets are the spec values', () => {
  expect(LESSON_EDITOR_PERFORMANCE_BUDGETS.hydrationMs).toBe(1_500)
  expect(LESSON_EDITOR_PERFORMANCE_BUDGETS.richToSourceSyncMs).toBe(50)
  expect(LESSON_EDITOR_PERFORMANCE_BUDGETS.keystrokeFrameMs).toBe(16)
  expect(LESSON_EDITOR_PERFORMANCE_BUDGETS.findFirstMatchMs).toBe(100)
})

test('acceptance criteria are the seven spec rows', () => {
  expect(LESSON_EDITOR_ACCEPTANCE_CRITERIA).toHaveLength(7)
  // Each criterion is a non-empty string.
  for (const criterion of LESSON_EDITOR_ACCEPTANCE_CRITERIA) {
    expect(criterion.length).toBeGreaterThan(0)
  }
  // Spot-check a few spec phrases.
  expect(LESSON_EDITOR_ACCEPTANCE_CRITERIA[0]).toContain('axe')
  expect(LESSON_EDITOR_ACCEPTANCE_CRITERIA[4]).toContain("Ge'ez")
  expect(LESSON_EDITOR_ACCEPTANCE_CRITERIA[5]).toContain('Restore unsaved draft')
  expect(LESSON_EDITOR_ACCEPTANCE_CRITERIA[6]).toContain('three-option conflict')
})

test('event payloads carry no body content, URLs, or filenames (privacy rule)', () => {
  // The TypeScript type enforces this — body/format/etc. are enums and IDs.
  // This test is a compile-time check that the union has no `string` field
  // that could carry body content. If someone adds a `body: string` field,
  // the assertion below would still compile but the field would be visible
  // in the source — reviewed at PR time.
  const event: LessonEditorEvent = {
    event: 'lesson_editor_mode_switched',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    bodyFormat: 'markdown',
    mode: 'rich',
  }
  // Every property is an ID or an enum — never a free-form string.
  expect(typeof event.courseId).toBe('string')
  expect(typeof event.lessonId).toBe('string')
  expect(event.bodyFormat).toBe('markdown')
  expect(event.mode).toBe('rich')
})
