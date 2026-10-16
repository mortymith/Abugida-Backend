/**
 * Course Version History logic (spec 04 § S-2.22 → Publish Readiness &
 * Course Review → Version History slide-over).
 *
 * The Version History slide-over shows every published version of a
 * course with: version number, actor, timestamp, readiness snapshot, and
 * item deltas (`+2 -0 ~1`). `restoreVersionAsDraft` writes v(n+1) — it
 * never deletes prior versions, so the audit trail stays complete.
 *
 * This module owns:
 *
 * 1. **Snapshot diff computation.** Given two snapshots (the version
 *    being restored and the current version), compute the item deltas
 *    (`added`, `removed`, `modified`) for display.
 * 2. **Restore-as-v(n+1).** Restoring a version does not delete it or
 *    overwrite the current version — it writes a new version v(n+1)
 *    whose body is the restored version's body. The audit trail is
 *    append-only.
 * 3. **Version numbering.** The first publish is v1; every subsequent
 *    publish or restore increments the version.
 *
 * This module is framework-free: it owns the diff and the restore
 * semantics. The server function (`courses.lifecycle.impl.server.ts`)
 * owns the actual persistence.
 */

export interface VersionItemSnapshot {
  readonly itemId: string
  readonly title: string
  readonly kind: 'lesson' | 'quiz' | 'assignment'
  readonly bodyHash: string // stable hash of the item body for modified detection
}

export interface VersionSnapshot {
  readonly version: number
  readonly actorId: string
  readonly createdAt: number // epoch ms
  readonly items: readonly VersionItemSnapshot[]
  readonly readinessSnapshot: Readonly<Record<string, unknown>>
}

export interface ItemDelta {
  readonly itemId: string
  readonly title: string
  readonly kind: VersionItemSnapshot['kind']
  readonly change: 'added' | 'removed' | 'modified'
}

export interface VersionDiff {
  readonly added: number
  readonly removed: number
  readonly modified: number
  readonly items: readonly ItemDelta[]
}

/**
 * Compute the diff between two snapshots. Used by the Version History
 * slide-over to render `+2 -0 ~1` next to each version (the diff is
 * between that version and its predecessor).
 *
 * - `added` — item present in `next` but not in `prev`.
 * - `removed` — item present in `prev` but not in `next`.
 * - `modified` — item present in both but with a different `bodyHash`
 *   (the body changed between versions).
 */
export function computeVersionDiff(
  prev: VersionSnapshot | null,
  next: VersionSnapshot,
): VersionDiff {
  if (prev === null) {
    // First version — every item is "added".
    return {
      added: next.items.length,
      removed: 0,
      modified: 0,
      items: next.items.map((item) => ({
        itemId: item.itemId,
        title: item.title,
        kind: item.kind,
        change: 'added' as const,
      })),
    }
  }

  const prevMap = new Map(prev.items.map((i) => [i.itemId, i]))
  const nextMap = new Map(next.items.map((i) => [i.itemId, i]))

  const items: ItemDelta[] = []
  let added = 0
  let removed = 0
  let modified = 0

  // Added and modified
  for (const nextItem of next.items) {
    const prevItem = prevMap.get(nextItem.itemId)
    if (!prevItem) {
      items.push({ ...nextItem, change: 'added' })
      added += 1
    } else if (prevItem.bodyHash !== nextItem.bodyHash) {
      items.push({ ...nextItem, change: 'modified' })
      modified += 1
    }
  }

  // Removed
  for (const prevItem of prev.items) {
    if (!nextMap.has(prevItem.itemId)) {
      items.push({ ...prevItem, change: 'removed' })
      removed += 1
    }
  }

  return { added, removed, modified, items }
}

/**
 * Format the delta summary for the slide-over row: `+2 -0 ~1`.
 * The spec calls for this compact notation next to each version.
 */
export function formatDeltaSummary(diff: VersionDiff): string {
  const parts: string[] = []
  if (diff.added > 0) parts.push(`+${diff.added}`)
  if (diff.removed > 0) parts.push(`-${diff.removed}`)
  if (diff.modified > 0) parts.push(`~${diff.modified}`)
  return parts.length === 0 ? 'no changes' : parts.join(' ')
}

// ── Restore as v(n+1) ──────────────────────────────────────────────────────

export interface RestoreResult {
  readonly newVersion: number
  readonly restoredFromVersion: number
  readonly bodySnapshot: VersionSnapshot
}

/**
 * Compute the new version that `restoreVersionAsDraft` should write.
 *
 * The spec: "restoreVersionAsDraft writes v(n+1), never deletes prior
 * versions." This function takes the current max version number and the
 * snapshot being restored, and returns the new version to write.
 *
 * The restored snapshot's `version` field becomes `n+1`; its `createdAt`
 * becomes `now`; its `actorId` becomes the restoring user. The body
 * (items + readiness) is copied verbatim from the source snapshot — the
 * restore is a full copy, not a merge.
 */
export function computeRestoreVersion(
  sourceSnapshot: VersionSnapshot,
  currentMaxVersion: number,
  restoringActorId: string,
  now: number,
): RestoreResult {
  const newVersion = currentMaxVersion + 1
  return {
    newVersion,
    restoredFromVersion: sourceSnapshot.version,
    bodySnapshot: {
      ...sourceSnapshot,
      version: newVersion,
      actorId: restoringActorId,
      createdAt: now,
    },
  }
}

/**
 * Whether a restore is permitted. The spec allows restoring any prior
 * version — there is no "too old to restore" cutoff. The only guard is
 * that the source version must exist and must not be the current version
 * (restoring the current version is a no-op).
 */
export function canRestoreVersion(
  sourceVersion: number,
  currentVersion: number,
): { permitted: boolean; reason: string | null } {
  if (sourceVersion === currentVersion) {
    return {
      permitted: false,
      reason: 'This is already the current version — nothing to restore.',
    }
  }
  if (sourceVersion > currentVersion) {
    return {
      permitted: false,
      reason: `Version v${sourceVersion} does not exist (current is v${currentVersion}).`,
    }
  }
  return { permitted: true, reason: null }
}

// ── Version retention ──────────────────────────────────────────────────────

export const MAX_VERSIONS_RETAINED_PER_COURSE = 50

/**
 * Decide which versions to retain and which to archive, given the current
 * set of versions. The spec does not mandate a hard retention cap, but
 * decision D2 (full-snapshot storage) implies one to keep the table size
 * bounded. We retain the most recent 50 versions per course.
 *
 * Archived versions are not deleted — they are moved to cold storage
 * (e.g. S3) and excluded from the slide-over. The audit trail remains
 * queryable via the audit log.
 */
export function selectVersionsToArchive(versions: readonly VersionSnapshot[]): VersionSnapshot[] {
  if (versions.length <= MAX_VERSIONS_RETAINED_PER_COURSE) return []
  const sorted = [...versions].sort((a, b) => b.version - a.version)
  return sorted.slice(MAX_VERSIONS_RETAINED_PER_COURSE)
}
