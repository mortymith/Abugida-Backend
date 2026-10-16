import { describe, expect, test } from 'bun:test'
import {
  canMergeSilently,
  computeStudentsFieldDiff,
  DEFAULT_STUDENTS_CONFLICT_ACTION,
  resolveStudentsConflict,
  resolveStudentsFieldByField,
  STUDENTS_CONFLICT_ACTIONS,
} from '#/features/students/students.conflict'
import type { StudentsConflict } from '#/features/students/students.conflict'

describe('STUDENTS_CONFLICT_ACTIONS', () => {
  test('three actions: keep-mine, take-theirs, review', () => {
    expect(STUDENTS_CONFLICT_ACTIONS).toEqual(['keep-mine', 'take-theirs', 'review'])
  })
  test('default is keep-mine', () => {
    expect(DEFAULT_STUDENTS_CONFLICT_ACTION).toBe('keep-mine')
  })
})

describe('computeStudentsFieldDiff', () => {
  test('detects changed fields', () => {
    const mine = { name: 'My Name', notes: 'same', cohort: 'c1' }
    const theirs = { name: 'Their Name', notes: 'same', cohort: 'c2' }
    const diff = computeStudentsFieldDiff(mine, theirs, ['name', 'notes', 'cohort'])
    expect(diff.find((d) => d.field === 'name')?.changed).toBe(true)
    expect(diff.find((d) => d.field === 'notes')?.changed).toBe(false)
    expect(diff.find((d) => d.field === 'cohort')?.changed).toBe(true)
  })
})

describe('resolveStudentsConflict', () => {
  const conflict: StudentsConflict = {
    entity: 'student',
    entityId: 's1',
    actor: 'admin-2',
    changedAt: 0,
    hasConflict: true,
    fields: [
      { field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true },
      { field: 'notes', mine: 'Same', theirs: 'Same', changed: false },
    ],
  }

  test('keep-mine uses mine for changed fields', () => {
    const result = resolveStudentsConflict(
      conflict,
      'keep-mine',
      { name: 'Mine', notes: 'Same' },
      { name: 'Theirs', notes: 'Same' },
    )
    expect(result?.name).toBe('Mine')
  })

  test('take-theirs uses theirs for changed fields', () => {
    const result = resolveStudentsConflict(
      conflict,
      'take-theirs',
      { name: 'Mine', notes: 'Same' },
      { name: 'Theirs', notes: 'Same' },
    )
    expect(result?.name).toBe('Theirs')
  })

  test('review returns null', () => {
    expect(resolveStudentsConflict(conflict, 'review', {}, {})).toBeNull()
  })
})

describe('resolveStudentsFieldByField', () => {
  const conflict: StudentsConflict = {
    entity: 'student',
    entityId: 's1',
    actor: 'admin-2',
    changedAt: 0,
    hasConflict: true,
    fields: [
      { field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true },
      { field: 'notes', mine: 'My notes', theirs: 'Their notes', changed: true },
    ],
  }

  test('per-field: mine for name, theirs for notes', () => {
    const result = resolveStudentsFieldByField(
      conflict,
      { name: 'Mine', notes: 'My notes' },
      { name: 'Theirs', notes: 'Their notes' },
      { name: 'mine', notes: 'theirs' },
    )
    expect(result.name).toBe('Mine')
    expect(result.notes).toBe('Their notes')
  })
})

describe('canMergeSilently', () => {
  test('true when no conflicting fields (non-overlapping edits)', () => {
    const conflict: StudentsConflict = {
      entity: 'student',
      entityId: 's1',
      actor: 'admin-2',
      changedAt: 0,
      hasConflict: false,
      fields: [{ field: 'name', mine: 'Same', theirs: 'Same', changed: false }],
    }
    expect(canMergeSilently(conflict)).toBe(true)
  })

  test('false when there are conflicting fields', () => {
    const conflict: StudentsConflict = {
      entity: 'student',
      entityId: 's1',
      actor: 'admin-2',
      changedAt: 0,
      hasConflict: true,
      fields: [{ field: 'name', mine: 'Mine', theirs: 'Theirs', changed: true }],
    }
    expect(canMergeSilently(conflict)).toBe(false)
  })
})
