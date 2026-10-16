/**
 * Spec 11 § Resilience States → Conflict: three-way conflict resolver.
 * "Changed by {actor} {N} minutes ago" → Review changes / Keep mine / Take theirs.
 */

export const CONFLICT_ACTIONS = ['keep-mine', 'take-theirs', 'review'] as const
export type ConflictAction = (typeof CONFLICT_ACTIONS)[number]

export const DEFAULT_CONFLICT_ACTION: ConflictAction = 'keep-mine'

export interface ConflictFieldDiff {
  readonly field: string
  readonly mine: unknown
  readonly theirs: unknown
  readonly changed: boolean
}

export interface ConflictInfo {
  readonly actor: string
  readonly changedAt: number
  readonly fields: readonly ConflictFieldDiff[]
  readonly hasConflict: boolean
}

export function computeConflictDiff(
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): ConflictFieldDiff[] {
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

export function resolveConflict(
  conflict: ConflictInfo,
  action: ConflictAction,
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (action === 'review') return null
  if (action === 'keep-mine') return { ...theirs, ...pickChanged(conflict, mine) }
  return { ...mine, ...pickChanged(conflict, theirs) }
}

function pickChanged(
  conflict: ConflictInfo,
  source: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of conflict.fields) {
    if (field.changed) result[field.field] = source[field.field]
  }
  return result
}

export function conflictAnnouncement(actor: string, changedAt: number, now: number): string {
  const minutesAgo = Math.max(1, Math.round((now - changedAt) / (60 * 1000)))
  const noun = minutesAgo === 1 ? 'minute' : 'minutes'
  return `Changed by ${actor} ${minutesAgo} ${noun} ago`
}

export function canMergeSilently(conflict: ConflictInfo): boolean {
  // Non-overlapping edits merge silently (no field has changed on both sides)
  return !conflict.fields.some((f) => f.changed)
}
