import { describe, expect, test } from 'bun:test'
import {
  detectSegmentConflicts,
  resolveAllSegmentConflicts,
  resolveSegment,
  segmentConflictAnnouncement,
  shouldRegenerateRaiseConflict,
} from '#/features/media/media.transcript-conflict'
import type { SegmentWithVersion } from '#/features/media/media.transcript-conflict'

function serverSegment(
  segmentId: string,
  rowVersion: number,
  editedBy: string | null,
  text: string,
): SegmentWithVersion {
  return {
    segmentId,
    segmentIndex: 0,
    text,
    startMs: 0,
    endMs: 1000,
    rowVersion,
    editedBy,
    editedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
  }
}

describe('detectSegmentConflicts', () => {
  test('detects conflict when server rowVersion > local and local is dirty', () => {
    const local = [
      { segmentId: 's1', text: 'my edit', startMs: 0, endMs: 1000, rowVersion: 1, isDirty: true },
    ]
    const server = new Map([['s1', serverSegment('s1', 2, 'user-2', 'their edit')]])
    const conflicts = detectSegmentConflicts(local, server, 'user-1')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].mineText).toBe('my edit')
    expect(conflicts[0].theirsText).toBe('their edit')
  })

  test('no conflict when local is not dirty (server version silently adopted)', () => {
    const local = [
      { segmentId: 's1', text: 'original', startMs: 0, endMs: 1000, rowVersion: 1, isDirty: false },
    ]
    const server = new Map([['s1', serverSegment('s1', 2, 'user-2', 'their edit')]])
    expect(detectSegmentConflicts(local, server, 'user-1')).toHaveLength(0)
  })

  test('no conflict when server rowVersion <= local', () => {
    const local = [
      { segmentId: 's1', text: 'my edit', startMs: 0, endMs: 1000, rowVersion: 2, isDirty: true },
    ]
    const server = new Map([['s1', serverSegment('s1', 2, 'user-2', 'their edit')]])
    expect(detectSegmentConflicts(local, server, 'user-1')).toHaveLength(0)
  })

  test('no conflict with yourself', () => {
    const local = [
      { segmentId: 's1', text: 'my edit', startMs: 0, endMs: 1000, rowVersion: 1, isDirty: true },
    ]
    const server = new Map([['s1', serverSegment('s1', 2, 'user-1', 'my earlier edit')]])
    expect(detectSegmentConflicts(local, server, 'user-1')).toHaveLength(0)
  })
})

describe('resolveSegment', () => {
  const conflict = {
    segmentId: 's1',
    segmentIndex: 0,
    actor: 'user-2',
    changedAt: Date.now() - 5 * 60 * 1000,
    mineText: 'mine',
    theirsText: 'theirs',
    mineStartMs: 0,
    theirsStartMs: 0,
    mineEndMs: 1000,
    theirsEndMs: 1000,
  }

  test('keep-mine returns mine values', () => {
    const result = resolveSegment(conflict, 'keep-mine')
    expect(result?.text).toBe('mine')
  })
  test('take-theirs returns theirs values', () => {
    const result = resolveSegment(conflict, 'take-theirs')
    expect(result?.text).toBe('theirs')
  })
  test('review returns null', () => {
    expect(resolveSegment(conflict, 'review')).toBeNull()
  })
})

describe('resolveAllSegmentConflicts', () => {
  const conflicts = [
    {
      segmentId: 's1',
      segmentIndex: 0,
      actor: 'u2',
      changedAt: 0,
      mineText: 'mine1',
      theirsText: 'theirs1',
      mineStartMs: 0,
      theirsStartMs: 0,
      mineEndMs: 1000,
      theirsEndMs: 1000,
    },
    {
      segmentId: 's2',
      segmentIndex: 1,
      actor: 'u2',
      changedAt: 0,
      mineText: 'mine2',
      theirsText: 'theirs2',
      mineStartMs: 1000,
      theirsStartMs: 1000,
      mineEndMs: 2000,
      theirsEndMs: 2000,
    },
  ]

  test('segment scope does not require confirmation', () => {
    const result = resolveAllSegmentConflicts(conflicts, {
      scope: 'segment',
      resolution: 'keep-mine',
    })
    expect(result.requiresConfirmation).toBe(false)
    expect(result.resolved).toHaveLength(2)
    expect(result.resolved[0].text).toBe('mine1')
  })

  test('track scope requires confirmation (never silent)', () => {
    const result = resolveAllSegmentConflicts(conflicts, {
      scope: 'track',
      resolution: 'take-theirs',
    })
    expect(result.requiresConfirmation).toBe(true)
    expect(result.resolved[0].text).toBe('theirs1')
  })
})

describe('shouldRegenerateRaiseConflict', () => {
  test('true when segment was edited by someone else after local load', () => {
    const segment = serverSegment('s1', 3, 'user-2', 'edited')
    expect(shouldRegenerateRaiseConflict(segment, 1, 'user-1')).toBe(true)
  })
  test('false when segment was edited by the same user', () => {
    const segment = serverSegment('s1', 3, 'user-1', 'my edit')
    expect(shouldRegenerateRaiseConflict(segment, 1, 'user-1')).toBe(false)
  })
  test('false when rowVersion has not advanced', () => {
    const segment = serverSegment('s1', 1, null, 'original')
    expect(shouldRegenerateRaiseConflict(segment, 1, 'user-1')).toBe(false)
  })
})

describe('segmentConflictAnnouncement', () => {
  test('names the actor and minutes ago', () => {
    const conflict = {
      segmentId: 's1',
      segmentIndex: 0,
      actor: 'user-2',
      changedAt: Date.now() - 5 * 60 * 1000,
      mineText: '',
      theirsText: '',
      mineStartMs: 0,
      theirsStartMs: 0,
      mineEndMs: 0,
      theirsEndMs: 0,
    }
    const msg = segmentConflictAnnouncement(conflict, Date.now())
    expect(msg).toContain('user-2')
    expect(msg).toContain('minutes ago')
  })
  test('singular "minute" for 1 minute ago', () => {
    const conflict = {
      segmentId: 's1',
      segmentIndex: 0,
      actor: 'u2',
      changedAt: Date.now() - 60 * 1000,
      mineText: '',
      theirsText: '',
      mineStartMs: 0,
      theirsStartMs: 0,
      mineEndMs: 0,
      theirsEndMs: 0,
    }
    const msg = segmentConflictAnnouncement(conflict, Date.now())
    expect(msg).toContain('1 minute ago')
  })
})
