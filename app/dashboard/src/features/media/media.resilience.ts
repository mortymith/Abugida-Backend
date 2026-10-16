/**
 * Media resilience helpers (spec 05 § Resilience, spec 11 § Resilience
 * States).
 *
 * Every media screen ships 8 resilience states. This module owns the
 * per-screen resolvers that map media-specific conditions to the universal
 * resilience state machine.
 *
 * The 8 states (from spec 11):
 * 1. `ok` — normal state.
 * 2. `forbidden` (403) — no access to the resource.
 * 3. `not_found` (404) — resource deleted or never existed.
 * 4. `offline` — network down; persistent banner; reads from cache.
 * 5. `reconnected` — network back; queue flushes.
 * 6. `session_expired` — auth expired; 2-min warning.
 * 7. `conflict` — rowVersion mismatch; two-column diff.
 * 8. `partial_failure` — bulk action had mixed results.
 * 9. `server_error` (5xx) — retry with backoff.
 */

export const MEDIA_RESILIENCE_STATES = [
  'ok',
  'forbidden',
  'not_found',
  'offline',
  'reconnected',
  'session_expired',
  'conflict',
  'partial_failure',
  'server_error',
] as const

export type MediaResilienceState = (typeof MEDIA_RESILIENCE_STATES)[number]

export interface MediaResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
  readonly hasData: boolean
}

/**
 * Resolve the resilience state from the underlying conditions. Priority
 * order matters — a higher-priority state masks a lower one.
 *
 * Priority (highest first):
 * 1. `session_expired` — without a session, nothing else matters.
 * 2. `offline` — without a network, server states are stale.
 * 3. `forbidden` (403) — permission checked before existence.
 * 4. `not_found` (404) — existence checked before rendering.
 * 5. `conflict` — a conflict blocks the save path.
 * 6. `partial_failure` — a bulk action had mixed results.
 * 7. `server_error` (5xx) — retry with backoff.
 * 8. `reconnected` — transient confirmation after offline.
 * 9. `ok` — the normal state.
 */
export function resolveMediaResilienceState(
  conditions: MediaResilienceConditions,
): MediaResilienceState {
  if (conditions.sessionExpired) return 'session_expired'
  if (conditions.isOffline) return 'offline'
  if (conditions.httpStatus === 403) return 'forbidden'
  if (conditions.httpStatus === 404) return 'not_found'
  if (conditions.conflictDetected) return 'conflict'
  if (conditions.partialFailure) return 'partial_failure'
  if (conditions.httpStatus !== null && conditions.httpStatus >= 500) return 'server_error'
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (conditions.wasOffline && !conditions.isOffline) return 'reconnected'
  return 'ok'
}

// ── Per-screen resolvers ───────────────────────────────────────────────────
//
// Each screen has slightly different conditions. The per-screen resolvers
// add screen-specific signals (e.g. "upload in flight", "offline queue
// non-empty") to the universal conditions.

export interface UploadModalConditions extends MediaResilienceConditions {
  readonly uploadsInFlight: boolean
  readonly offlineQueueCount: number
}

/**
 * S-3.2 Upload Modal resolver. The modal has special offline handling:
 * dropping a file while offline does not fail — it queues. The modal
 * footer shows "N uploads waiting to sync." and the queue flushes on
 * reconnect.
 */
export function resolveUploadModalResilience(
  conditions: UploadModalConditions,
): MediaResilienceState {
  // Session expiry names the in-flight uploads specifically.
  if (conditions.sessionExpired && conditions.uploadsInFlight) return 'session_expired'
  // Offline with a queued upload is still "offline" — the queue is the
  // recovery path, not an error.
  return resolveMediaResilienceState(conditions)
}

export interface PreviewModalConditions extends MediaResilienceConditions {
  readonly mediaBytesFailed: boolean
  readonly unsupportedFormat: boolean
  readonly previewFailed: boolean
}

/**
 * S-3.5 Preview Modal resolver. Distinguishes Unsupported Format (a
 * decision made before trying) from Preview Failed (a failure that
 * actually happened). Both render inside the modal — never as an empty
 * black player.
 */
export function resolvePreviewModalResilience(
  conditions: PreviewModalConditions,
): MediaResilienceState | 'unsupported_format' | 'preview_failed' {
  if (conditions.sessionExpired) return 'session_expired'
  if (conditions.isOffline) return 'offline'
  if (conditions.unsupportedFormat) return 'unsupported_format'
  if (conditions.previewFailed || conditions.mediaBytesFailed) return 'preview_failed'
  if (conditions.httpStatus === 403) return 'forbidden'
  if (conditions.httpStatus === 404) return 'not_found'
  if (conditions.httpStatus !== null && conditions.httpStatus >= 500) return 'server_error'
  return 'ok'
}

export interface TranscriptEditorConditions extends MediaResilienceConditions {
  readonly generating: boolean
  readonly queuedEditsCount: number
}

/**
 * S-3.6 Transcript Editor resolver. The editor has a "Generating" lock
 * state that is distinct from the resilience states — it blocks edits
 * while STT is running but is not an error.
 */
export function resolveTranscriptEditorResilience(
  conditions: TranscriptEditorConditions,
): MediaResilienceState | 'generating' {
  // Offline beats generating — without a network, the STT job can't run.
  if (conditions.sessionExpired) return 'session_expired'
  if (conditions.isOffline) return 'offline'
  if (conditions.httpStatus === 403) return 'forbidden'
  if (conditions.httpStatus === 404) return 'not_found'
  if (conditions.generating) return 'generating'
  if (conditions.conflictDetected) return 'conflict'
  if (conditions.partialFailure) return 'partial_failure'
  if (conditions.httpStatus !== null && conditions.httpStatus >= 500) return 'server_error'
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (conditions.wasOffline && !conditions.isOffline) return 'reconnected'
  return 'ok'
}

// ── Retry strategy ─────────────────────────────────────────────────────────

export type MediaRetryStrategy = 'none' | 'auto' | 'manual'

export function mediaRetryStrategy(state: MediaResilienceState): MediaRetryStrategy {
  if (state === 'offline') return 'auto'
  if (state === 'server_error') return 'auto'
  if (state === 'partial_failure') return 'manual'
  if (state === 'conflict') return 'manual'
  return 'none'
}

/**
 * Exponential backoff for auto-retry states. 1s → 2s → 4s → 8s → 16s cap.
 */
export function mediaBackoffDelayMs(attempt: number): number {
  const base = 1000
  const max = 16_000
  return Math.min(base * 2 ** attempt, max)
}
