import { describe, expect, test } from 'bun:test'
import {
  canRestoreVersion,
  computeRestoreVersion,
  computeVersionDiff,
  formatDeltaSummary,
  MAX_VERSIONS_RETAINED_PER_COURSE,
  selectVersionsToArchive,
} from '#/features/courses/courses.version-history'
import type { VersionSnapshot } from '#/features/courses/courses.version-history'

const NOW = Date.parse('2026-01-15T12:00:00Z')

function snapshot(
  version: number,
  items: { itemId: string; title: string; bodyHash: string }[],
): VersionSnapshot {
  return {
    version,
    actorId: 'user-1',
    createdAt: NOW,
    items: items.map((i) => ({ ...i, kind: 'lesson' as const })),
    readinessSnapshot: {},
  }
}

describe('computeVersionDiff', () => {
  test('first version (prev=null) marks all items as added', () => {
    const next = snapshot(1, [
      { itemId: 'i1', title: 'Item 1', bodyHash: 'a' },
      { itemId: 'i2', title: 'Item 2', bodyHash: 'b' },
    ])
    const diff = computeVersionDiff(null, next)
    expect(diff.added).toBe(2)
    expect(diff.removed).toBe(0)
    expect(diff.modified).toBe(0)
    expect(diff.items.every((i) => i.change === 'added')).toBe(true)
  })

  test('added items counted correctly', () => {
    const prev = snapshot(1, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const next = snapshot(2, [
      { itemId: 'i1', title: 'Item 1', bodyHash: 'a' },
      { itemId: 'i2', title: 'Item 2', bodyHash: 'b' },
    ])
    const diff = computeVersionDiff(prev, next)
    expect(diff.added).toBe(1)
    expect(diff.removed).toBe(0)
    expect(diff.modified).toBe(0)
  })

  test('removed items counted correctly', () => {
    const prev = snapshot(1, [
      { itemId: 'i1', title: 'Item 1', bodyHash: 'a' },
      { itemId: 'i2', title: 'Item 2', bodyHash: 'b' },
    ])
    const next = snapshot(2, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const diff = computeVersionDiff(prev, next)
    expect(diff.added).toBe(0)
    expect(diff.removed).toBe(1)
    expect(diff.modified).toBe(0)
  })

  test('modified items detected by bodyHash change', () => {
    const prev = snapshot(1, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const next = snapshot(2, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'c' }])
    const diff = computeVersionDiff(prev, next)
    expect(diff.modified).toBe(1)
    expect(diff.added).toBe(0)
    expect(diff.removed).toBe(0)
  })

  test('mixed diff (+2 -1 ~1)', () => {
    const prev = snapshot(1, [
      { itemId: 'i1', title: 'Item 1', bodyHash: 'a' },
      { itemId: 'i2', title: 'Item 2', bodyHash: 'b' },
    ])
    const next = snapshot(2, [
      { itemId: 'i1', title: 'Item 1', bodyHash: 'changed' },
      { itemId: 'i2', title: 'Item 2', bodyHash: 'b' },
      { itemId: 'i3', title: 'Item 3', bodyHash: 'c' },
      { itemId: 'i4', title: 'Item 4', bodyHash: 'd' },
    ])
    const diff = computeVersionDiff(prev, next)
    expect(diff.added).toBe(2)
    expect(diff.removed).toBe(0)
    expect(diff.modified).toBe(1)
  })

  test('no changes when snapshots are identical', () => {
    const prev = snapshot(1, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const next = snapshot(2, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const diff = computeVersionDiff(prev, next)
    expect(diff.added).toBe(0)
    expect(diff.removed).toBe(0)
    expect(diff.modified).toBe(0)
  })
})

describe('formatDeltaSummary', () => {
  test('renders +2 -0 ~1', () => {
    expect(formatDeltaSummary({ added: 2, removed: 0, modified: 1, items: [] })).toBe('+2 ~1')
  })
  test('renders +2 -1', () => {
    expect(formatDeltaSummary({ added: 2, removed: 1, modified: 0, items: [] })).toBe('+2 -1')
  })
  test('renders "no changes" for empty diff', () => {
    expect(formatDeltaSummary({ added: 0, removed: 0, modified: 0, items: [] })).toBe('no changes')
  })
})

describe('computeRestoreVersion (restore as v(n+1))', () => {
  test('writes v(n+1) with restored body', () => {
    const source = snapshot(3, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const result = computeRestoreVersion(source, 5, 'user-2', NOW)
    expect(result.newVersion).toBe(6)
    expect(result.restoredFromVersion).toBe(3)
    expect(result.bodySnapshot.version).toBe(6)
    expect(result.bodySnapshot.actorId).toBe('user-2')
    expect(result.bodySnapshot.items).toEqual(source.items)
  })

  test('never deletes prior versions (append-only)', () => {
    const source = snapshot(1, [{ itemId: 'i1', title: 'Item 1', bodyHash: 'a' }])
    const result = computeRestoreVersion(source, 10, 'user-2', NOW)
    expect(result.newVersion).toBe(11)
    // The source version (1) is unchanged; the new version (11) is added.
    expect(result.restoredFromVersion).toBe(1)
  })
})

describe('canRestoreVersion', () => {
  test('permitted when source < current', () => {
    const result = canRestoreVersion(2, 5)
    expect(result.permitted).toBe(true)
    expect(result.reason).toBeNull()
  })

  test('not permitted when source === current (no-op)', () => {
    const result = canRestoreVersion(5, 5)
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('already the current version')
  })

  test('not permitted when source > current (does not exist)', () => {
    const result = canRestoreVersion(10, 5)
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('does not exist')
  })
})

describe('selectVersionsToArchive (retention)', () => {
  test('returns empty when under cap', () => {
    const versions = Array.from({ length: 10 }, (_, i) => snapshot(i + 1, []))
    expect(selectVersionsToArchive(versions)).toHaveLength(0)
  })

  test('archives oldest when over cap', () => {
    const versions = Array.from({ length: MAX_VERSIONS_RETAINED_PER_COURSE + 5 }, (_, i) =>
      snapshot(i + 1, []),
    )
    const toArchive = selectVersionsToArchive(versions)
    expect(toArchive).toHaveLength(5)
  })
})
