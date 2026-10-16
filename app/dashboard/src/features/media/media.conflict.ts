/**
 * Media conflict resolution (spec 05 § S-3.1/S-3.3/S-3.4/S-3.6 Conflict,
 * spec 11 § Resilience States → Conflict).
 *
 * The spec mandates: every concurrent-edit surface offers
 * **Review changes / Keep mine / Take theirs** — never Reload-only. This
 * module owns the conflict detection and resolution logic for the four
 * media entities that support concurrent editing:
 *
 * 1. **Asset metadata** (name / tags / description / folder) — field-level
 *    diff, resolved per field.
 * 2. **Folder rename / move** — whole-entity conflict.
 * 3. **Transcript track metadata** (status / caption style) — field-level.
 * 4. **Transcript segment** (text / timing) — per segment, not per track
 *    (decision D10).
 *
 * This module is framework-free: it owns the conflict model and the
 * resolution actions. The React component renders the two-column diff.
 */

export const MEDIA_CONFLICT_ACTIONS = ['keep-mine', 'take-theirs', 'review'] as const

export type MediaConflictAction = (typeof MEDIA_CONFLICT_ACTIONS)[number]

export const MEDIA_CONFLICT_ACTION_LABELS: Record<MediaConflictAction, string> = {
  'keep-mine': 'Keep mine',
  'take-theirs': 'Take theirs',
  review: 'Review changes',
}

/**
 * Default action. The spec mandates `Keep mine` is the default — the
 * author's unsaved buffer is never silently replaced.
 */
export const DEFAULT_MEDIA_CONFLICT_ACTION: MediaConflictAction = 'keep-mine'

export interface ConflictFieldDiff {
  readonly field: string
  readonly mine: unknown
  readonly theirs: unknown
  readonly changed: boolean
}

export interface MediaConflict {
  readonly entity: 'asset' | 'folder' | 'transcript' | 'segment'
  readonly entityId: string
  readonly actor: string
  readonly changedAt: number // epoch ms
  readonly fields: readonly ConflictFieldDiff[]
  readonly hasConflict: boolean
}

/**
 * Compute a field-level diff between `mine` and `theirs` for the given
 * field set. Returns one `ConflictFieldDiff` per field, with `changed`
 * indicating whether the values differ.
 *
 * Used by asset metadata (name/tags/description/folder) and transcript
 * track metadata (status/captionStyle/showByDefault).
 */
export function computeFieldDiff(
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

/**
 * Deep equality for conflict detection. Handles primitives, arrays (tags),
 * and plain objects (captionStyle). Uses JSON serialization as a fallback
 * for complex values — sufficient for conflict detection since the values
 * come from typed schemas.
 */
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
 * values for the conflicting fields.
 *
 * - `keep-mine` → the author's values win for all conflicting fields.
 * - `take-theirs` → the server's values win for all conflicting fields.
 * - `review` → returns null; the component opens the field-level diff and
 *   the author makes per-field choices.
 */
export function resolveMediaConflict(
  conflict: MediaConflict,
  action: MediaConflictAction,
  mine: Readonly<Record<string, unknown>>,
  theirs: Readonly<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (action === 'review') return null
  if (action === 'keep-mine') {
    return { ...theirs, ...pickChanged(conflict, mine) }
  }
  // take-theirs
  return { ...mine, ...pickChanged(conflict, theirs) }
}

function pickChanged(
  conflict: MediaConflict,
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
export function resolveFieldByField(
  conflict: MediaConflict,
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
    // 'mine' → keep the value already in `result`
  }
  return result
}

// ── Per-segment transcript conflict (decision D10) ─────────────────────────

export interface SegmentConflict {
  readonly segmentId: string
  readonly segmentIndex: number
  readonly actor: string
  readonly changedAt: number
  readonly mineText: string
  readonly theirsText: string
  readonly mineStartMs: number
  readonly theirsStartMs: number
  readonly mineEndMs: number
  readonly theirsEndMs: number
}

export type SegmentConflictResolution = 'keep-mine' | 'take-theirs' | 'review'

/**
 * Batch resolution for transcript segment conflicts. The spec allows a
 * batch "Keep all mine / Keep all theirs" but it must be an explicit,
 * confirmed bulk action — never silent.
 */
export interface BatchSegmentResolution {
  readonly scope: 'segment' | 'track'
  readonly resolution: 'keep-mine' | 'take-theirs'
}

export function resolveSegmentConflict(
  conflict: SegmentConflict,
  resolution: SegmentConflictResolution,
): { text: string; startMs: number; endMs: number } | null {
  if (resolution === 'review') return null
  if (resolution === 'keep-mine') {
    return {
      text: conflict.mineText,
      startMs: conflict.mineStartMs,
      endMs: conflict.mineEndMs,
    }
  }
  return {
    text: conflict.theirsText,
    startMs: conflict.theirsStartMs,
    endMs: conflict.theirsEndMs,
  }
}

/**
 * Whether a batch "Keep all" action requires confirmation. The spec
 * mandates that taking theirs for the whole track is available only as an
 * explicit, confirmed bulk action — transcription corrections are exactly
 * where a silent overwrite destroys work.
 */
export function requiresBatchConfirmation(resolution: BatchSegmentResolution): boolean {
  return resolution.scope === 'track'
}
