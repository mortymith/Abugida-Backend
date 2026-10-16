/**
 * Chunked uploader logic (spec 05 § S-3.2 — uploads are resumable).
 *
 * The spec mandates chunked, resumable uploads with:
 * - 8 MB chunks (decision D2)
 * - Checkpoint every 8 MB or 10 s, whichever is first
 * - Resume from the last confirmed byte after a network drop or tab reload
 * - Per-file Cancel, Retry, Resume from start
 * - Offline queue (IndexedDB-persisted)
 * - Specific failure-reason table (never "Upload failed")
 *
 * This module is framework-free: it owns the chunk math, the resume
 * offset computation, the failure-reason classification, and the
 * checkpoint state machine. The React hook (`useChunkedUpload`) owns the
 * XHR/fetch calls and the IndexedDB persistence.
 */

export const CHUNK_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB (spec explicit)
export const CHECKPOINT_INTERVAL_MS = 10_000 // 10s (spec: 8MB or 10s, whichever first)

export type UploadStatus =
  'queued' | 'uploading' | 'paused' | 'completing' | 'completed' | 'failed' | 'cancelled'

export type UploadFailureReason =
  | 'format_unsupported'
  | 'oversize'
  | 'network_lost'
  | 'malware_scan_failed'
  | 'storage_full'
  | 'quota_exceeded'
  | 'server_error'
  | 'unknown'

export const UPLOAD_FAILURE_MESSAGES: Record<
  UploadFailureReason,
  (context?: {
    fileSize?: number
    limit?: number
    atPercent?: number
    freeSpace?: number
  }) => string
> = {
  format_unsupported: (ctx) =>
    `Format not supported: ${ctx?.fileSize ? `.${ctx.fileSize}` : 'this file type'}`,
  oversize: (ctx) =>
    `File is ${ctx?.fileSize ? formatBytes(ctx.fileSize) : 'too large'} — the limit is ${ctx?.limit ? formatBytes(ctx.limit) : '500 MB'}`,
  network_lost: (ctx) => `Network lost at ${ctx?.atPercent ?? 0}% — retry or resume`,
  malware_scan_failed: () => 'Upload rejected: the file failed our malware scan',
  storage_full: (ctx) =>
    `Storage full${ctx?.freeSpace ? ` — ${formatBytes(ctx.freeSpace)} free` : ''}${ctx?.fileSize ? `, file is ${formatBytes(ctx.fileSize)}` : ''}`,
  quota_exceeded: () => 'Workspace storage quota exceeded — contact an Admin',
  server_error: () => 'Server error during upload — retry',
  unknown: () => 'Upload failed for an unknown reason — retry',
}

/**
 * Actions offered for each failure reason. The spec table:
 * | Reason | Action |
 * | format_unsupported | Remove, or convert |
 * | oversize | Remove |
 * | network_lost | Resume, Retry from start |
 * | malware_scan_failed | Remove |
 * | storage_full | Remove, or free space |
 * | quota_exceeded | Remove, or contact Admin |
 * | server_error | Retry |
 * | unknown | Retry |
 */
export const UPLOAD_FAILURE_ACTIONS: Record<UploadFailureReason, readonly string[]> = {
  format_unsupported: ['remove', 'convert'],
  oversize: ['remove'],
  network_lost: ['resume', 'retry_from_start'],
  malware_scan_failed: ['remove'],
  storage_full: ['remove', 'free_space'],
  quota_exceeded: ['remove', 'contact_admin'],
  server_error: ['retry'],
  unknown: ['retry'],
}

/**
 * Classify an upload failure into a spec reason. The caller passes the
 * raw error (HTTP status, network error, validation error) and this
 * function returns the spec reason + message + actions.
 */
export function classifyUploadFailure(
  error:
    | { kind: 'http'; status: number }
    | { kind: 'network' }
    | { kind: 'validation'; reason: UploadFailureReason }
    | { kind: 'unknown'; message?: string },
  context?: { fileSize?: number; limit?: number; atPercent?: number; freeSpace?: number },
): { reason: UploadFailureReason; message: string; actions: readonly string[] } {
  let reason: UploadFailureReason
  if (error.kind === 'validation') {
    reason = error.reason
  } else if (error.kind === 'network') {
    reason = 'network_lost'
  } else if (error.kind === 'http') {
    if (error.status === 413) reason = 'oversize'
    else if (error.status === 415) reason = 'format_unsupported'
    else if (error.status === 507) reason = 'storage_full'
    else if (error.status === 429) reason = 'quota_exceeded'
    else if (error.status >= 500) reason = 'server_error'
    else if (error.status === 403) reason = 'malware_scan_failed'
    else reason = 'unknown'
  } else {
    reason = 'unknown'
  }
  return {
    reason,
    message: UPLOAD_FAILURE_MESSAGES[reason](context),
    actions: UPLOAD_FAILURE_ACTIONS[reason],
  }
}

// ── Chunk math ─────────────────────────────────────────────────────────────

/**
 * Compute the number of chunks for a file of `totalBytes`. S3 multipart
 * requires at least 5 MB per part (except the last), and allows at most
 * 10,000 parts. Our 8 MB chunk size stays well within both bounds for
 * files up to ~80 GB (well above the 500 MB cap).
 */
export function computeChunkCount(totalBytes: number): number {
  return Math.ceil(totalBytes / CHUNK_SIZE_BYTES)
}

/**
 * Compute the byte range `[start, end)` for chunk `partNumber` (1-indexed,
 * per S3 multipart convention). The last chunk may be smaller than
 * `CHUNK_SIZE_BYTES`.
 */
export function computeChunkRange(
  totalBytes: number,
  partNumber: number,
): { start: number; end: number; size: number } {
  const start = (partNumber - 1) * CHUNK_SIZE_BYTES
  const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes)
  return { start, end, size: end - start }
}

/**
 * Compute the resume offset after a network drop. Given the list of
 * already-uploaded parts (from `listUploadedParts`), return the byte
 * offset to resume from. The spec mandates: resuming continues from the
 * last confirmed byte, never from zero.
 */
export function computeResumeOffset(
  uploadedParts: ReadonlyArray<{ partNumber: number; size: number }>,
): number {
  return uploadedParts.reduce((sum, part) => sum + part.size, 0)
}

/**
 * Compute the next part number to upload after a resume. Parts are
 * 1-indexed; if 3 parts are already uploaded, the next is part 4.
 */
export function computeNextPartNumber(
  uploadedParts: ReadonlyArray<{ partNumber: number; size: number }>,
): number {
  if (uploadedParts.length === 0) return 1
  return Math.max(...uploadedParts.map((p) => p.partNumber)) + 1
}

/**
 * Compute the upload progress percentage given `uploadedBytes` and
 * `totalBytes`. Rounded to the nearest integer, 0–100.
 */
export function computeUploadProgress(uploadedBytes: number, totalBytes: number): number {
  if (totalBytes === 0) return 0
  return Math.min(100, Math.round((uploadedBytes / totalBytes) * 100))
}

// ── Checkpoint state machine ───────────────────────────────────────────────

export interface UploadCheckpoint {
  readonly assetDraftId: string
  readonly objectKey: string
  readonly multipartUploadId: string | null
  readonly totalBytes: number
  readonly uploadedBytes: number
  readonly lastChunkAt: number
  readonly status: UploadStatus
}

/**
 * Whether a checkpoint should be persisted. The spec mandates checkpoint
 * every 8 MB or 10 s, whichever is first. This function returns true when
 * either threshold is crossed since the last checkpoint.
 */
export function shouldCheckpoint(
  lastCheckpoint: { uploadedBytes: number; at: number } | null,
  currentUploadedBytes: number,
  now: number,
): boolean {
  if (!lastCheckpoint) return true
  const bytesSinceLast = currentUploadedBytes - lastCheckpoint.uploadedBytes
  const timeSinceLast = now - lastCheckpoint.at
  return bytesSinceLast >= CHUNK_SIZE_BYTES || timeSinceLast >= CHECKPOINT_INTERVAL_MS
}

/**
 * Whether a checkpoint is stale (past the 7-day retention, decision D4).
 * The purge worker uses this to find rows to delete.
 */
export function isCheckpointStale(checkpoint: UploadCheckpoint, now: number): boolean {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  return now - checkpoint.lastChunkAt > SEVEN_DAYS_MS
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format bytes for human-readable display. Used in failure messages
 * ("File is 620 MB — the limit is 500 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Size bucket for instrumentation. The spec's `upload_started` event
 * carries `sizeBucket` (not the actual byte count) so analytics can
 * group uploads by size range without storing PII.
 */
export function sizeBucket(totalBytes: number): string {
  if (totalBytes < 1024 * 1024) return '<1MB'
  if (totalBytes < 10 * 1024 * 1024) return '1-10MB'
  if (totalBytes < 100 * 1024 * 1024) return '10-100MB'
  if (totalBytes < 500 * 1024 * 1024) return '100-500MB'
  return '>500MB'
}
