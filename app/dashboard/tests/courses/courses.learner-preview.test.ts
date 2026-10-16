import { describe, expect, test } from 'bun:test'
import {
  buildPreviewLinkQuery,
  canJumpToEditor,
  isAnnotationMode,
  isPreviewLinkExpired,
  parsePreviewLinkQuery,
  PREVIEW_DEVICE_WIDTHS,
  PREVIEW_IDENTITIES,
  PREVIEW_IDENTITY_LABELS,
  resolvePreviewItems,
  shouldShowDraftWatermark,
  shouldShowScheduledBadge,
} from '#/features/courses/courses.learner-preview'
import type {
  PreviewContext,
  PreviewItem,
  PreviewLinkPayload,
} from '#/features/courses/courses.learner-preview'

const ITEMS: PreviewItem[] = [
  {
    itemId: 'i1',
    title: 'Published item',
    visibility: 'published',
    scheduledPublishAt: null,
    isLocked: false,
    isCompleted: false,
  },
  {
    itemId: 'i2',
    title: 'Draft item',
    visibility: 'draft',
    scheduledPublishAt: null,
    isLocked: false,
    isCompleted: false,
  },
  {
    itemId: 'i3',
    title: 'Scheduled item',
    visibility: 'scheduled',
    scheduledPublishAt: '2026-02-01T00:00:00+03:00',
    isLocked: false,
    isCompleted: false,
  },
  {
    itemId: 'i4',
    title: 'Locked item',
    visibility: 'published',
    scheduledPublishAt: null,
    isLocked: true,
    isCompleted: false,
  },
  {
    itemId: 'i5',
    title: 'Completed item',
    visibility: 'published',
    scheduledPublishAt: null,
    isLocked: false,
    isCompleted: true,
  },
]

describe('preview vocabulary', () => {
  test('five identities', () => {
    expect(PREVIEW_IDENTITIES).toEqual([
      'new_student',
      'existing_student',
      'reviewer',
      'locked_only',
      'completed_only',
    ])
  })

  test('three device widths: desktop, tablet, mobile', () => {
    expect(PREVIEW_DEVICE_WIDTHS.map((d) => d.id)).toEqual(['desktop', 'tablet', 'mobile'])
    expect(PREVIEW_DEVICE_WIDTHS.map((d) => d.width)).toEqual([1280, 768, 375])
  })

  test('every identity has a label', () => {
    for (const identity of PREVIEW_IDENTITIES) {
      expect(PREVIEW_IDENTITY_LABELS[identity]).toBeTruthy()
    }
  })
})

describe('resolvePreviewItems', () => {
  test('new student sees published items only', () => {
    const ctx: PreviewContext = {
      identity: 'new_student',
      items: ITEMS,
      existingStudentId: null,
      draftWatermark: false,
    }
    const result = resolvePreviewItems(ctx)
    expect(result.every((i) => i.visibility === 'published')).toBe(true)
    expect(result.map((i) => i.itemId)).toEqual(['i1', 'i4', 'i5'])
  })

  test('reviewer sees all items', () => {
    const ctx: PreviewContext = {
      identity: 'reviewer',
      items: ITEMS,
      existingStudentId: null,
      draftWatermark: true,
    }
    const result = resolvePreviewItems(ctx)
    expect(result).toHaveLength(5)
  })

  test('locked-only sees published + locked items', () => {
    const ctx: PreviewContext = {
      identity: 'locked_only',
      items: ITEMS,
      existingStudentId: null,
      draftWatermark: false,
    }
    const result = resolvePreviewItems(ctx)
    expect(result.map((i) => i.itemId)).toEqual(['i4'])
  })

  test('completed-only sees published items (all marked completed by frame)', () => {
    const ctx: PreviewContext = {
      identity: 'completed_only',
      items: ITEMS,
      existingStudentId: null,
      draftWatermark: false,
    }
    const result = resolvePreviewItems(ctx)
    expect(result.every((i) => i.visibility === 'published')).toBe(true)
  })
})

describe('shouldShowDraftWatermark', () => {
  test('true for reviewer + draft item', () => {
    expect(shouldShowDraftWatermark('reviewer', ITEMS[1])).toBe(true)
  })

  test('false for non-reviewer', () => {
    expect(shouldShowDraftWatermark('new_student', ITEMS[1])).toBe(false)
  })

  test('false for reviewer + published item', () => {
    expect(shouldShowDraftWatermark('reviewer', ITEMS[0])).toBe(false)
  })
})

describe('shouldShowScheduledBadge', () => {
  test('true for reviewer + scheduled item with date', () => {
    expect(shouldShowScheduledBadge('reviewer', ITEMS[2])).toBe(true)
  })

  test('false for non-reviewer', () => {
    expect(shouldShowScheduledBadge('new_student', ITEMS[2])).toBe(false)
  })

  test('false for non-scheduled item', () => {
    expect(shouldShowScheduledBadge('reviewer', ITEMS[0])).toBe(false)
  })
})

describe('annotation mode', () => {
  test('reviewer is in annotation mode', () => {
    expect(isAnnotationMode('reviewer')).toBe(true)
  })

  test('non-reviewer is not in annotation mode', () => {
    expect(isAnnotationMode('new_student')).toBe(false)
    expect(isAnnotationMode('existing_student')).toBe(false)
    expect(isAnnotationMode('locked_only')).toBe(false)
    expect(isAnnotationMode('completed_only')).toBe(false)
  })

  test('only reviewer can jump to editor', () => {
    expect(canJumpToEditor('reviewer')).toBe(true)
    expect(canJumpToEditor('new_student')).toBe(false)
  })
})

describe('signed preview link', () => {
  const payload: PreviewLinkPayload = {
    courseId: 'course-1',
    identity: 'reviewer',
    existingStudentId: null,
    expiresAt: Date.parse('2026-02-01T00:00:00Z'),
  }

  test('buildPreviewLinkQuery produces the expected params', () => {
    const params = buildPreviewLinkQuery(payload)
    expect(params.get('preview')).toBe('1')
    expect(params.get('course')).toBe('course-1')
    expect(params.get('identity')).toBe('reviewer')
    expect(params.get('expires')).toBe(String(payload.expiresAt))
    expect(params.get('student')).toBeNull()
  })

  test('parsePreviewLinkQuery round-trips', () => {
    const params = buildPreviewLinkQuery(payload)
    const parsed = parsePreviewLinkQuery(params)
    expect(parsed).toEqual(payload)
  })

  test('parsePreviewLinkQuery returns null for non-preview URL', () => {
    const params = new URLSearchParams({ tab: 'overview' })
    expect(parsePreviewLinkQuery(params)).toBeNull()
  })

  test('parsePreviewLinkQuery returns null for invalid identity', () => {
    const params = new URLSearchParams({
      preview: '1',
      course: 'course-1',
      identity: 'invalid',
      expires: String(payload.expiresAt),
    })
    expect(parsePreviewLinkQuery(params)).toBeNull()
  })

  test('isPreviewLinkExpired: false before expiry', () => {
    expect(isPreviewLinkExpired(payload, Date.parse('2026-01-15T00:00:00Z'))).toBe(false)
  })

  test('isPreviewLinkExpired: true at/after expiry', () => {
    expect(isPreviewLinkExpired(payload, payload.expiresAt)).toBe(true)
    expect(isPreviewLinkExpired(payload, payload.expiresAt + 1)).toBe(true)
  })
})
