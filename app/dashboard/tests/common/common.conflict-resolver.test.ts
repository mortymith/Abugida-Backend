import { describe, expect, test } from 'bun:test'
import {
  canMergeSilently,
  computeConflictDiff,
  conflictAnnouncement,
  resolveConflict,
} from '#/components/common/common.conflict-resolver'
import type { ConflictInfo } from '#/components/common/common.conflict-resolver'

describe('computeConflictDiff', () => {
  test('detects changed fields', () => {
    const diff = computeConflictDiff(
      { name: 'Mine', tags: ['a'] },
      { name: 'Theirs', tags: ['a'] },
      ['name', 'tags'],
    )
    expect(diff.find((d) => d.field === 'name')?.changed).toBe(true)
    expect(diff.find((d) => d.field === 'tags')?.changed).toBe(false)
  })
})
describe('resolveConflict', () => {
  const conflict: ConflictInfo = {
    actor: 'admin-2',
    changedAt: 0,
    hasConflict: true,
    fields: [{ field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true }],
  }
  test('keep-mine', () => {
    expect(resolveConflict(conflict, 'keep-mine', { name: 'Mine' }, { name: 'Theirs' })?.name).toBe(
      'Mine',
    )
  })
  test('take-theirs', () => {
    expect(
      resolveConflict(conflict, 'take-theirs', { name: 'Mine' }, { name: 'Theirs' })?.name,
    ).toBe('Theirs')
  })
  test('review → null', () => {
    expect(resolveConflict(conflict, 'review', {}, {})).toBeNull()
  })
})
describe('conflictAnnouncement', () => {
  test('names actor + minutes ago', () => {
    const now = 100000
    const msg = conflictAnnouncement('Jane', now - 5 * 60 * 1000, now)
    expect(msg).toContain('Jane')
    expect(msg).toContain('5 minutes')
  })
  test('singular for 1 minute', () => {
    expect(conflictAnnouncement('Jane', 0, 60000)).toContain('1 minute')
  })
})
describe('canMergeSilently', () => {
  test('true when no conflicting fields', () => {
    const conflict: ConflictInfo = {
      actor: 'a',
      changedAt: 0,
      hasConflict: false,
      fields: [{ field: 'name', mine: 'Same', theirs: 'Same', changed: false }],
    }
    expect(canMergeSilently(conflict)).toBe(true)
  })
  test('false when there are conflicts', () => {
    const conflict: ConflictInfo = {
      actor: 'a',
      changedAt: 0,
      hasConflict: true,
      fields: [{ field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true }],
    }
    expect(canMergeSilently(conflict)).toBe(false)
  })
})
