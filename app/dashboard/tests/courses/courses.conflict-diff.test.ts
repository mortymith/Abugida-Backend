import { describe, expect, test } from 'bun:test'
import {
  applyConflictAction,
  computeConflictDiff,
  CONFLICT_ACTIONS,
  CONFLICT_ACTION_LABELS,
  DEFAULT_CONFLICT_ACTION,
  isValidConflictActionSet,
} from '#/features/courses/courses.conflict-diff'

describe('conflict action vocabulary', () => {
  test('the three actions are Keep mine / Take theirs / Compare', () => {
    expect(CONFLICT_ACTIONS).toEqual(['keep-mine', 'take-theirs', 'compare'])
    expect(CONFLICT_ACTION_LABELS).toEqual({
      'keep-mine': 'Keep mine',
      'take-theirs': 'Take theirs',
      compare: 'Compare',
    })
  })

  test('default is Keep mine (never silent replacement)', () => {
    expect(DEFAULT_CONFLICT_ACTION).toBe('keep-mine')
  })

  test('isValidConflictActionSet rejects Reload-only (missing keep-mine)', () => {
    expect(isValidConflictActionSet(['take-theirs', 'compare'])).toBe(false)
    expect(isValidConflictActionSet(['take-theirs'])).toBe(false)
  })

  test('isValidConflictActionSet requires all three actions', () => {
    expect(isValidConflictActionSet(['keep-mine', 'take-theirs', 'compare'])).toBe(true)
  })
})

describe('computeConflictDiff', () => {
  test('identical bodies produce no conflict', () => {
    const diff = computeConflictDiff('hello\nworld', 'hello\nworld')
    expect(diff.hasConflict).toBe(false)
    expect(diff.lines).toHaveLength(2)
    expect(diff.lines.every((l) => l.type === 'unchanged')).toBe(true)
  })

  test('a modified line is marked modified', () => {
    const diff = computeConflictDiff('hello\nworld', 'hello\nearth')
    expect(diff.hasConflict).toBe(true)
    const modified = diff.lines.find((l) => l.type === 'modified')
    expect(modified).toBeDefined()
    expect(modified?.mine).toBe('world')
    expect(modified?.theirs).toBe('earth')
  })

  test('an added line is marked added', () => {
    const diff = computeConflictDiff('hello', 'hello\nworld')
    expect(diff.hasConflict).toBe(true)
    const added = diff.lines.find((l) => l.type === 'added')
    expect(added).toBeDefined()
    expect(added?.theirs).toBe('world')
    expect(added?.mine).toBeNull()
  })

  test('a removed line is marked removed', () => {
    const diff = computeConflictDiff('hello\nworld', 'hello')
    expect(diff.hasConflict).toBe(true)
    const removed = diff.lines.find((l) => l.type === 'removed')
    expect(removed).toBeDefined()
    expect(removed?.mine).toBe('world')
    expect(removed?.theirs).toBeNull()
  })

  test('empty bodies produce no conflict', () => {
    const diff = computeConflictDiff('', '')
    expect(diff.hasConflict).toBe(false)
    expect(diff.lines).toHaveLength(0)
  })

  test('line counts are reported', () => {
    const diff = computeConflictDiff('a\nb\nc', 'a\nb')
    expect(diff.mineLines).toBe(3)
    expect(diff.theirsLines).toBe(2)
  })
})

describe('applyConflictAction', () => {
  test('keep-mine returns the author buffer', () => {
    const result = applyConflictAction('keep-mine', 'mine', 'theirs')
    expect(result).toBe('mine')
  })

  test('take-theirs returns the server version (renamed Reload)', () => {
    const result = applyConflictAction('take-theirs', 'mine', 'theirs')
    expect(result).toBe('theirs')
  })

  test('compare returns null (component opens overlay)', () => {
    const result = applyConflictAction('compare', 'mine', 'theirs')
    expect(result).toBeNull()
  })
})
