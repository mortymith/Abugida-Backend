/**
 * Students conflict resolution (spec 06 § S-4.2 Conflict, spec 11 §
 * Resilience States → Conflict).
 *
 * The spec: "Two Admins editing the same student is the most contended
 * surface in the product." Resolution offers **Review changes / Keep mine
 * / Take theirs** on the changed fields — never Reload-only.
 *
 * This module owns the field-level conflict model for:
 * 1. **Student profile** (name, telegram, phone, notes, cohort).
 * 2. **Badge definition** (trigger config, scope, notify flags).
 * 3. **Rule definition** (trigger, conditions, target).
 *
 * Cohort membership and message threads are append-only (no overwrite
 * conflict), so they don't need this model.
 */

export const STUDENTS_CONFLICT_ACTIONS = ['keep-mine', 'take-theirs', 'review'] as const

export type StudentsConflictAction = (typeof STUDENTS_CONFLICT_ACTIONS)[number]

export const STUDENTS_CONFLICT_ACTION_LABELS: Record<StudentsConflictAction, string> = {
  'keep-mine': 'Keep mine',
  'take-theirs': 'Take theirs',
  review: 'Review changes',
}

export const DEFAULT_STUDENTS_CONFLICT_ACTION: StudentsConflictAction = 'keep-mine'

export interface StudentsConflictFieldDiff {
  readonly field: string
  readonly mine: unknown
  readonly theirs: unknown
  readonly changed: boolean
}

export interface StudentsConflict {
  readonly entity: 'student' | 'badge' | 'rule'
  readonly entityId: string
  readonly actor: string
  readonly changedAt: number
  readonly fields: readonly StudentsConflictFieldDiff[]
  readonly hasConflict: boolean
}

/**
 * Compute a field-level diff between `mine` and `theirs`. Returns one
 * `StudentsConflictFieldDiff` per field, with `changed` indicating
 * whether the values differ.
 */
export function computeStudentsFieldDiff(
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): StudentsConflictFieldDiff[] {
  return fields.map((field) => {
    const mineValue = mine[field]
    const theirsValue = theirs[field]
    return {
      field,
      mine: mineValue,
      theirs: theirsValue,
      changed: !valuesEqual(mineValue, theirsValue),
    }
  })
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, i) => valuesEqual(item, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      (key, i) =>
        key === bKeys[i] &&
        valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  }
  return false
}

/**
 * Resolve a conflict by applying the chosen action. Returns the merged
 * values for the conflicting fields, or `null` for `review` (the
 * component opens the field-level diff).
 */
export function resolveStudentsConflict(
  conflict: StudentsConflict,
  action: StudentsConflictAction,
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (action === 'review') return null
  if (action === 'keep-mine') {
    return { ...theirs, ...pickChanged(conflict, mine) }
  }
  return { ...mine, ...pickChanged(conflict, theirs) }
}

function pickChanged(
  conflict: StudentsConflict,
  source: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of conflict.fields) {
    if (field.changed) {
      result[field.field] = source[field.field]
    }
  }
  return result
}

/**
 * Per-field resolution for the `review` action. The author picks
 * `keep-mine` or `take-theirs` for each conflicting field individually.
 */
export function resolveStudentsFieldByField(
  conflict: StudentsConflict,
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
  choices: Readonly<Record<string, 'mine' | 'theirs'>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...mine }
  for (const field of conflict.fields) {
    if (!field.changed) continue
    const choice = choices[field.field]
    if (choice === 'theirs') {
      result[field.field] = theirs[field.field]
    }
  }
  return result
}

/**
 * Whether two non-overlapping edits can merge silently. The spec: "A
 * non-overlapping edit merges silently." If Admin A edited `name` and
 * Admin B edited `notes`, both changes apply without a conflict dialog.
 */
export function canMergeSilently(conflict: StudentsConflict): boolean {
  // Silently mergeable only when there are no conflicting fields — but
  // if there are no conflicts, there's nothing to merge. This function
  // is for the case where the local buffer has edits to fields the
  // server didn't touch, and the server has edits to fields the local
  // buffer didn't touch. In that case, `changed` is false for the
  // non-overlapping fields, and the merge is automatic.
  // The conflict dialog opens only when both sides edited the SAME field.
  return !conflict.fields.some((f) => f.changed)
}
