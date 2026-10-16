import { describe, expect, test } from 'bun:test'
import {
  countGraphemes,
  FIELD_LOCK_FIELDS,
  fieldLockReason,
  isFieldAutosavable,
  isFieldDisabled,
  isFieldPresent,
  isSurfaceLocked,
  resolveFieldLock,
  validateCourseTitle,
} from '#/features/courses/courses.field-lock'
import type { CourseLifecycleState } from '#/features/courses/courses.workspace'
import { COURSE_LIFECYCLE_STATES } from '#/features/courses/courses.workspace'

const ALL_STATES: CourseLifecycleState[] = [...COURSE_LIFECYCLE_STATES]

describe('the table is total — every field × every state', () => {
  test('has a cell for every combination', () => {
    for (const field of FIELD_LOCK_FIELDS) {
      for (const state of ALL_STATES) {
        const rule = resolveFieldLock(field, state)
        // A missing cell must never resolve to a silent "editable".
        expect(['absent', 'disabled', 'confirm', 'editable']).toContain(rule.mode)
      }
    }
  })

  test('covers every course and item field the spec names', () => {
    expect([...FIELD_LOCK_FIELDS]).toEqual([
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
    ])
  })

  test('Archived is read-only across the board, except the way out', () => {
    // Everything is locked, but the Restore transition itself is not: "Only
    // Restore and Duplicate remain actionable." Locking that too would leave an
    // archived course with no route back to Draft.
    for (const field of FIELD_LOCK_FIELDS) {
      if (field === 'course.lifecycle') continue
      expect(resolveFieldLock(field, 'archived').mode).toBe('disabled')
    }
    expect(isSurfaceLocked('archived')).toBe(true)
    // An archived course is the one place "read-only" is correct, because the
    // entire surface is locked.
    expect(isFieldAutosavable('item.body', 'archived')).toBe(false)
    expect(isFieldAutosavable('course.pricing', 'archived')).toBe(false)
  })

  test('the lifecycle transition itself stays open in every state it can fire from', () => {
    // Archived → Draft (Restore) and Published → Draft (Unpublish) are the two
    // exits that must never be disabled by the table.
    for (const state of ALL_STATES) {
      expect(resolveFieldLock('course.lifecycle', state).mode).toBe('editable')
    }
  })

  test('an unknown value never resolves to writable', () => {
    // A lock that silently opens because a caller passed a value this module
    // does not recognise is the failure mode the spec is written against.
    expect(resolveFieldLock('nope' as never, 'draft').mode).toBe('absent')
    expect(isFieldPresent('nope' as never, 'draft')).toBe(false)
    // An unrecognised state fails closed, and says so rather than going silent.
    const unknownState = resolveFieldLock('course.title', 'nope' as never)
    expect(unknownState.mode).toBe('disabled')
    expect(fieldLockReason('course.title', 'nope' as never)).toContain('not recognised')
    expect(isFieldAutosavable('course.title', 'nope' as never)).toBe(false)
  })
})

describe('the three cases are not interchangeable', () => {
  test('case 2 — blocked by state renders disabled *with a reason*', () => {
    const rule = resolveFieldLock('item.title', 'in_review')
    expect(rule.mode).toBe('disabled')
    expect(fieldLockReason('item.title', 'in_review')).toBe('In review — withdraw to edit')

    const approved = resolveFieldLock('item.title', 'approved')
    expect(approved.mode).toBe('disabled')
    expect(fieldLockReason('item.title', 'approved')).toBe('Approved — editing clears the approval')
  })

  test('a disabled field carries no silent no-op: the reason is always stated', () => {
    for (const field of FIELD_LOCK_FIELDS) {
      for (const state of ALL_STATES) {
        if (isFieldDisabled(field, state)) {
          expect(fieldLockReason(field, state)).toBeTruthy()
        }
      }
    }
  })

  test('`item.visibility` is absent in review, not disabled', () => {
    // "the lifecycle owns it" — the control does not render at all.
    expect(resolveFieldLock('item.visibility', 'in_review').mode).toBe('absent')
    expect(isFieldPresent('item.visibility', 'in_review')).toBe(false)
    // ...and it is editable in every other live state.
    expect(resolveFieldLock('item.visibility', 'draft').mode).toBe('editable')
    expect(resolveFieldLock('item.visibility', 'approved').mode).toBe('editable')
  })

  test('case 3 — editable-with-confirm states the student-visible effect', () => {
    const published = resolveFieldLock('course.pricing', 'published')
    expect(published.mode).toBe('confirm')
    expect(published.reason).toBe('Students who already paid keep their access')

    const liveItem = resolveFieldLock('item.body', 'published')
    expect(liveItem.mode).toBe('confirm')
    expect(liveItem.reason).toBe('This changes a live lesson')

    const liveTitle = resolveFieldLock('course.title', 'published')
    expect(liveTitle.mode).toBe('confirm')
    expect(liveTitle.confirmTitle).toBe('Rename a live course?')
  })

  test('a confirm field autosaves but a disabled one must not spin the timer', () => {
    expect(isFieldAutosavable('course.pricing', 'published')).toBe(true)
    expect(isFieldAutosavable('item.body', 'draft')).toBe(true)
    expect(isFieldAutosavable('item.body', 'in_review')).toBe(false)
    expect(isFieldAutosavable('course.title', 'approved')).toBe(false)
  })
})

describe('the slug is frozen from the first publish', () => {
  test('editable as a draft, locked in review, read-only once live', () => {
    expect(resolveFieldLock('course.slug', 'draft').mode).toBe('editable')
    expect(resolveFieldLock('course.slug', 'in_review').mode).toBe('disabled')
    expect(fieldLockReason('course.slug', 'in_review')).toBe('Slugs are frozen while in review')
    expect(resolveFieldLock('course.slug', 'published').mode).toBe('disabled')
    expect(fieldLockReason('course.slug', 'published')).toContain('Frozen at first publish')
  })

  test('the title stays editable in review but the slug does not', () => {
    // Per the Field Lock table: the title is editable while In Review; the slug
    // is frozen. A screen that says otherwise is wrong.
    expect(resolveFieldLock('course.title', 'in_review').mode).toBe('editable')
    expect(isFieldDisabled('course.slug', 'in_review')).toBe(true)
  })
})

describe('descriptive fields keep editing in every non-archived state', () => {
  test('description, exam, level, tags and thumbnail are editable throughout', () => {
    for (const state of ['draft', 'in_review', 'approved', 'published'] as const) {
      expect(resolveFieldLock('course.details', state).mode).toBe('editable')
      expect(resolveFieldLock('section.metadata', state).mode).toBe('editable')
    }
  })
})

describe('a mixed screen never collapses to read-only', () => {
  test('Approved keeps authoring fields open while locking the reviewed ones', () => {
    // "A mixed screen does not collapse to read-only: it drops case-1 controls
    // and keeps case-2 controls visible but disabled-with-a-reason."
    expect(resolveFieldLock('course.details', 'approved').mode).toBe('editable')
    expect(isFieldDisabled('item.title', 'approved')).toBe(true)
    expect(isSurfaceLocked('approved')).toBe(false)
  })
})

describe('title length in grapheme clusters (S-2.6 validation)', () => {
  test('counts graphemes, not code units — Ethiopic composes', () => {
    // U+1200 (ሀ) + U+135F (gemination mark) is ONE syllable a reader counts as
    // one, but two code points. A code-unit count would call it 2 and reject a
    // title that is in fact short.
    const composed = '\u1200\u135F'
    expect([...composed].length).toBe(2)
    expect(countGraphemes(composed)).toBe(1)
  })

  test('two plain Ethiopic syllables are two graphemes', () => {
    // U+1200 + U+1208 are two independent syllables, not a base + mark — the
    // segmenter must not merge them.
    expect(countGraphemes('\u1200\u1208')).toBe(2)
  })

  test('an ASCII title counts one per character', () => {
    expect(countGraphemes('TOEFL Complete Course')).toBe('TOEFL Complete Course'.length)
    expect(countGraphemes('')).toBe(0)
  })

  test('the 3–300 bounds are enforced on the trimmed value', () => {
    expect(validateCourseTitle('ab')).toContain('at least')
    expect(validateCourseTitle('abc')).toBeNull()
    expect(validateCourseTitle('  abc  ')).toBeNull()
    expect(validateCourseTitle('a'.repeat(300))).toBeNull()
    expect(validateCourseTitle('a'.repeat(301))).toContain('at most')
  })

  test('a long composed Ethiopic title is valid, which a code-unit count would reject', () => {
    // The spec's "~3 lines" Amharic title case: 250 syllables, each a base plus
    // a combining mark = 500 code units. Counting code units would refuse it as
    // overlong; counting graphemes accepts it, which is the whole point.
    const amharic = '\u1200\u135F'.repeat(250)
    expect([...amharic].length).toBe(500)
    expect(countGraphemes(amharic)).toBe(250)
    expect(validateCourseTitle(amharic)).toBeNull()
  })
})
