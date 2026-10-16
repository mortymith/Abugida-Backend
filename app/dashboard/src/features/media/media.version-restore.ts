/**
 * Asset version restore logic (spec 05 § S-3.3 — Version History).
 *
 * Uploading a new version is a resumable upload (S-3.2) and never
 * replaces the current version until the bytes are complete. Each version
 * is restorable as the current version, and restoring is itself
 * versioned — restoring v2 writes a new v(n+1) pointing at v2's bytes,
 * never deleting v3.
 *
 * This mirrors the spec 04 `course_versions` restore-as-v(n+1) semantics
 * (append-only, never deletes). This module is framework-free.
 */

export interface AssetVersionSummary {
  readonly versionNumber: number
  readonly objectKey: string
  readonly fileSizeBytes: number | null
  readonly mimeType: string | null
  readonly uploadedBy: string | null
  readonly uploadedAt: number
  readonly note: string | null
}

export interface RestoreVersionResult {
  readonly newVersionNumber: number
  readonly restoredFromVersion: number
  readonly objectKey: string
  readonly fileSizeBytes: number | null
  readonly mimeType: string | null
}

/**
 * Compute the new version that `restoreVersion` should write. The spec:
 * "restoring is itself versioned" — restoring v2 when the current is v5
 * writes v6 pointing at v2's bytes. The audit trail is append-only.
 */
export function computeRestoreVersion(
  sourceVersion: AssetVersionSummary,
  currentMaxVersion: number,
): RestoreVersionResult {
  return {
    newVersionNumber: currentMaxVersion + 1,
    restoredFromVersion: sourceVersion.versionNumber,
    objectKey: sourceVersion.objectKey,
    fileSizeBytes: sourceVersion.fileSizeBytes,
    mimeType: sourceVersion.mimeType,
  }
}

/**
 * Whether a restore is permitted. The spec allows restoring any prior
 * version. The only guard is that the source version must exist and must
 * not be the current version (restoring the current version is a no-op).
 */
export function canRestoreVersion(
  sourceVersionNumber: number,
  currentVersionNumber: number,
): { permitted: boolean; reason: string | null } {
  if (sourceVersionNumber === currentVersionNumber) {
    return {
      permitted: false,
      reason: 'This is already the current version — nothing to restore.',
    }
  }
  if (sourceVersionNumber > currentVersionNumber) {
    return {
      permitted: false,
      reason: `Version v${sourceVersionNumber} does not exist (current is v${currentVersionNumber}).`,
    }
  }
  return { permitted: true, reason: null }
}

/**
 * The version-history display label for a version row. The spec shows:
 * "Version History: v3 (current) · v2 · v1"
 */
export function versionLabel(version: AssetVersionSummary, isCurrent: boolean): string {
  const tag = isCurrent ? ' (current)' : ''
  return `v${version.versionNumber}${tag}`
}

/**
 * The version-history diff summary between two adjacent versions. The
 * spec doesn't mandate a byte-diff; the display shows the version
 * number, uploader, timestamp, and file-size delta.
 */
export function versionDiffSummary(
  prev: AssetVersionSummary | null,
  next: AssetVersionSummary,
): { sizeDelta: number | null; sizeDeltaLabel: string } {
  if (prev === null || prev.fileSizeBytes === null || next.fileSizeBytes === null) {
    return { sizeDelta: null, sizeDeltaLabel: '' }
  }
  const delta = next.fileSizeBytes - prev.fileSizeBytes
  const sign = delta > 0 ? '+' : ''
  return {
    sizeDelta: delta,
    sizeDeltaLabel: `${sign}${formatBytes(Math.abs(delta))}${delta === 0 ? '' : delta > 0 ? ' larger' : ' smaller'}`,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
