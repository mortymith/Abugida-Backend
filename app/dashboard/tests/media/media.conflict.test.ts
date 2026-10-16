import { describe, expect, test } from 'bun:test'
import {
  computeFieldDiff,
  DEFAULT_MEDIA_CONFLICT_ACTION,
  MEDIA_CONFLICT_ACTIONS,
  MEDIA_CONFLICT_ACTION_LABELS,
  resolveFieldByField,
  resolveMediaConflict,
  requiresBatchConfirmation,
  resolveSegmentConflict,
} from '#/features/media/media.conflict'
import type { MediaConflict } from '#/features/media/media.conflict'

describe('MEDIA_CONFLICT_ACTIONS', () => {
  test('three actions: keep-mine, take-theirs, review', () => {
    expect(MEDIA_CONFLICT_ACTIONS).toEqual(['keep-mine', 'take-theirs', 'review'])
    expect(MEDIA_CONFLICT_ACTION_LABELS).toEqual({
      'keep-mine': 'Keep mine',
      'take-theirs': 'Take theirs',
      review: 'Review changes',
    })
  })
  test('default is keep-mine (never silent replacement)', () => {
    expect(DEFAULT_MEDIA_CONFLICT_ACTION).toBe('keep-mine')
  })
})

describe('computeFieldDiff', () => {
  test('detects changed fields', () => {
    const mine = { name: 'My Name', tags: ['a', 'b'], description: 'same' }
    const theirs = { name: 'Their Name', tags: ['a', 'b'], description: 'same' }
    const diff = computeFieldDiff(mine, theirs, ['name', 'tags', 'description'])
    expect(diff.find((d) => d.field === 'name')?.changed).toBe(true)
    expect(diff.find((d) => d.field === 'tags')?.changed).toBe(false)
    expect(diff.find((d) => d.field === 'description')?.changed).toBe(false)
  })
  test('detects array changes', () => {
    const mine = { tags: ['a', 'b'] }
    const theirs = { tags: ['a', 'c'] }
    const diff = computeFieldDiff(mine, theirs, ['tags'])
    expect(diff[0].changed).toBe(true)
  })
  test('no changes when values are equal', () => {
    const mine = { name: 'Same' }
    const theirs = { name: 'Same' }
    const diff = computeFieldDiff(mine, theirs, ['name'])
    expect(diff[0].changed).toBe(false)
  })
})

describe('resolveMediaConflict', () => {
  const conflict: MediaConflict = {
    entity: 'asset',
    entityId: 'a1',
    actor: 'user-2',
    changedAt: 0,
    hasConflict: true,
    fields: [
      { field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true },
      { field: 'description', mine: 'Same', theirs: 'Same', changed: false },
    ],
  }

  test('keep-mine uses mine for changed fields', () => {
    const mine = { name: 'Mine', description: 'Same' }
    const theirs = { name: 'Theirs', description: 'Same' }
    const result = resolveMediaConflict(conflict, 'keep-mine', mine, theirs)
    expect(result?.name).toBe('Mine')
  })
  test('take-theirs uses theirs for changed fields', () => {
    const mine = { name: 'Mine', description: 'Same' }
    const theirs = { name: 'Theirs', description: 'Same' }
    const result = resolveMediaConflict(conflict, 'take-theirs', mine, theirs)
    expect(result?.name).toBe('Theirs')
  })
  test('review returns null (component opens diff)', () => {
    const result = resolveMediaConflict(conflict, 'review', {}, {})
    expect(result).toBeNull()
  })
})

describe('resolveFieldByField', () => {
  const conflict: MediaConflict = {
    entity: 'asset',
    entityId: 'a1',
    actor: 'u2',
    changedAt: 0,
    hasConflict: true,
    fields: [
      { field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true },
      { field: 'tags', mine: ['a'], theirs: ['b'], changed: true },
      { field: 'description', mine: 'Same', theirs: 'Same', changed: false },
    ],
  }

  test('per-field choices: mine for name, theirs for tags', () => {
    const mine = { name: 'Mine', tags: ['a'], description: 'Same' }
    const theirs = { name: 'Theirs', tags: ['b'], description: 'Same' }
    const choices = { name: 'mine' as const, tags: 'theirs' as const }
    const result = resolveFieldByField(conflict, mine, theirs, choices)
    expect(result.name).toBe('Mine')
    expect(result.tags).toEqual(['b'])
    expect(result.description).toBe('Same') // unchanged
  })
})

describe('resolveSegmentConflict', () => {
  const conflict = {
    segmentId: 's1',
    segmentIndex: 0,
    actor: 'u2',
    changedAt: 0,
    mineText: 'mine',
    theirsText: 'theirs',
    mineStartMs: 0,
    theirsStartMs: 0,
    mineEndMs: 1000,
    theirsEndMs: 1000,
  }

  test('keep-mine returns mine values', () => {
    const result = resolveSegmentConflict(conflict, 'keep-mine')
    expect(result?.text).toBe('mine')
  })
  test('take-theirs returns theirs values', () => {
    const result = resolveSegmentConflict(conflict, 'take-theirs')
    expect(result?.text).toBe('theirs')
  })
  test('review returns null', () => {
    expect(resolveSegmentConflict(conflict, 'review')).toBeNull()
  })
})

describe('requiresBatchConfirmation', () => {
  test('true for track scope (never silent)', () => {
    expect(requiresBatchConfirmation({ scope: 'track', resolution: 'keep-mine' })).toBe(true)
    expect(requiresBatchConfirmation({ scope: 'track', resolution: 'take-theirs' })).toBe(true)
  })
  test('false for segment scope', () => {
    expect(requiresBatchConfirmation({ scope: 'segment', resolution: 'keep-mine' })).toBe(false)
  })
})
