/**
 * Transcript conflict resolution (spec 05 § S-3.6 — per-segment conflict).
 *
 * The spec: "Two people correcting the same transcript is ordinary.
 * Resolution is **per segment**, not per track: 'Changed by {actor} {N}
 * minutes ago' with Review changes / Keep mine / Take theirs on the
 * specific segment, and a batch action Keep all of mine / Keep all of
 * theirs for the rest."
 *
 * "Taking theirs for the whole track is available only as an explicit,
 * confirmed bulk action, because transcription corrections are exactly
 * where a silent overwrite destroys work."
 *
 * "An AI Regenerate that lands on a segment someone has just hand-edited
 * raises the same conflict rather than replacing the text."
 *
 * This module is framework-free.
 */

import type {
  SegmentConflict,
  SegmentConflictResolution,
  BatchSegmentResolution,
} from './media.conflict'
import { requiresBatchConfirmation } from './media.conflict'

export interface SegmentWithVersion {
  readonly segmentId: string
  readonly segmentIndex: number
  readonly text: string
  readonly startMs: number
  readonly endMs: number
  readonly rowVersion: number
  readonly editedBy: string | null
  readonly editedAt: number | null
}

/**
 * Detect conflicts between the local buffer and the server's segments.
 * A segment is in conflict when the server's `rowVersion` is higher than
 * the local buffer's AND the local buffer has unsaved edits (i.e., the
 * local text differs from the server text).
 *
 * Segments where the local buffer matches the server (no local edits)
 * are NOT conflicts — the server version is silently adopted.
 */
export function detectSegmentConflicts(
  localSegments: ReadonlyArray<{
    segmentId: string
    text: string
    startMs: number
    endMs: number
    rowVersion: number
    isDirty: boolean
  }>,
  serverSegments: ReadonlyMap<string, SegmentWithVersion>,
  currentUserId: string,
): SegmentConflict[] {
  const conflicts: SegmentConflict[] = []
  for (const local of localSegments) {
    const server = serverSegments.get(local.segmentId)
    if (!server) continue
    // Conflict only when the server moved on AND the local buffer has
    // unsaved edits.
    if (server.rowVersion > local.rowVersion && local.isDirty) {
      // Don't conflict with yourself.
      if (server.editedBy === currentUserId) continue
      conflicts.push({
        segmentId: local.segmentId,
        segmentIndex: server.segmentIndex,
        actor: server.editedBy ?? 'another editor',
        changedAt: server.editedAt ?? Date.now(),
        mineText: local.text,
        theirsText: server.text,
        mineStartMs: local.startMs,
        theirsStartMs: server.startMs,
        mineEndMs: local.endMs,
        theirsEndMs: server.endMs,
      })
    }
  }
  return conflicts
}

/**
 * Resolve a single segment conflict. Returns the resolved values, or
 * `null` when the author chose `review` (the component opens the
 * field-level diff).
 */
export function resolveSegment(
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
  // take-theirs
  return {
    text: conflict.theirsText,
    startMs: conflict.theirsStartMs,
    endMs: conflict.theirsEndMs,
  }
}

/**
 * Resolve all segment conflicts in a batch. The spec allows "Keep all
 * mine / Keep all theirs" but it must be an explicit, confirmed bulk
 * action — never silent.
 *
 * This function returns the resolved segments AND a flag indicating
 * whether the caller must show a confirmation dialog before applying.
 */
export function resolveAllSegmentConflicts(
  conflicts: readonly SegmentConflict[],
  resolution: BatchSegmentResolution,
): {
  resolved: ReadonlyArray<{ segmentId: string; text: string; startMs: number; endMs: number }>
  requiresConfirmation: boolean
} {
  const requiresConfirmation = requiresBatchConfirmation(resolution)
  const resolved = conflicts.map((conflict) => {
    const r =
      resolution.resolution === 'keep-mine'
        ? {
            text: conflict.mineText,
            startMs: conflict.mineStartMs,
            endMs: conflict.mineEndMs,
          }
        : {
            text: conflict.theirsText,
            startMs: conflict.theirsStartMs,
            endMs: conflict.theirsEndMs,
          }
    return { segmentId: conflict.segmentId, ...r }
  })
  return { resolved, requiresConfirmation }
}

/**
 * Whether an AI Regenerate on a segment should raise a conflict. The
 * spec: "An AI Regenerate that lands on a segment someone has just
 * hand-edited raises the same conflict rather than replacing the text."
 */
export function shouldRegenerateRaiseConflict(
  segment: SegmentWithVersion,
  localRowVersion: number,
  currentUserId: string,
): boolean {
  // Raise conflict when the segment was edited by someone else after the
  // local buffer was loaded. A same-user edit is not a conflict.
  if (segment.editedBy && segment.editedBy !== currentUserId) return true
  // If rowVersion advanced but we don't know who edited (editedBy is null),
  // raise conflict conservatively.
  if (segment.rowVersion > localRowVersion && segment.editedBy === null) return true
  return false
}

/**
 * The conflict announcement for a segment. The spec: "Changed by {actor}
 * {N} minutes ago."
 */
export function segmentConflictAnnouncement(conflict: SegmentConflict, now: number): string {
  const minutesAgo = Math.max(1, Math.round((now - conflict.changedAt) / (60 * 1000)))
  const noun = minutesAgo === 1 ? 'minute' : 'minutes'
  return `Changed by ${conflict.actor} ${minutesAgo} ${noun} ago.`
}
