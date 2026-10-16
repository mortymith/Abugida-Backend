/**
 * Media instrumentation event vocabulary (spec 05 § Instrumentation &
 * acceptance, spec 11 § Observability).
 *
 * Every screen in Part 05 ships an `Instrumentation & acceptance` block.
 * The spec is explicit about two hard invariants:
 *
 * 1. **No PII.** Event payloads never include filenames, user names,
 *    emails, or any personally identifiable information.
 * 2. **No content.** Event payloads never include transcript text, asset
 *    descriptions, tag values, or any content that could leak student or
 *    author work. Only IDs, counts, and reason codes.
 *
 * The `{ id, count }` shape is the universal payload — `id` is the entity
 * public ID (opaque), `count` is a numeric metric relevant to the event.
 */

export const MEDIA_INSTRUMENTATION_EVENTS = [
  // S-3.1 Asset Repository
  'library_viewed',
  'library_bulk_action',
  'asset_delete_confirmed',
  // S-3.2 Asset Upload Modal
  'upload_modal_opened',
  'upload_files_added',
  'upload_started',
  'upload_progress',
  'upload_completed',
  'upload_failed',
  'upload_resumed',
  'upload_cancelled',
  'upload_queued_offline',
  // S-3.3 Asset Detail View
  'asset_detail_viewed',
  'asset_metadata_saved',
  'asset_version_uploaded',
  'asset_version_restored',
  'asset_archived',
  'asset_detached_all',
  'asset_delete_permanently_confirmed',
  // S-3.4 Folders & Collections
  'folder_opened',
  'folder_created',
  'folder_renamed',
  'folder_deleted',
  'asset_moved',
  'folder_search',
  // S-3.5 File Preview Modal
  'preview_opened',
  'preview_closed',
  'preview_failed',
  'captions_toggled',
  'transcript_opened',
  'preview_nav',
  // S-3.6 Transcription & Subtitle Editor
  'transcription_started',
  'transcription_segment_edited',
  'transcription_applied',
  'transcription_conflict_resolved',
  'transcription_exported',
] as const

export type MediaInstrumentationEvent = (typeof MEDIA_INSTRUMENTATION_EVENTS)[number]

export interface MediaInstrumentationPayload {
  readonly id: string // entity public ID (opaque, no PII)
  readonly count?: number // optional numeric metric
  readonly [key: string]: unknown
}

/**
 * Keys that are forbidden in any instrumentation payload because they
 * carry PII or content. The spec is explicit: no filenames, no transcript
 * text, no tag values, no descriptions.
 */
const FORBIDDEN_KEYS = new Set([
  'filename',
  'fileName',
  'name',
  'title',
  'displayName',
  'email',
  'body',
  'text',
  'comment',
  'content',
  'description',
  'question',
  'answer',
  'password',
  'token',
  'secret',
  'tags',
  'tag',
  'transcript',
  'segmentText',
])

/**
 * Validate that a media instrumentation payload conforms to the spec:
 * - `id` is a non-empty string (the entity public ID).
 * - No PII keys (filename, name, email, body, text, comment, tags, etc.).
 * - No content keys that would leak transcript or asset content.
 * - `count` is a number when present.
 *
 * Returns `null` when valid, or an error message describing the violation.
 */
export function validateMediaPayload(payload: MediaInstrumentationPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string' || payload.id.length === 0) {
    return 'Media instrumentation payload must have a non-empty string `id`'
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `Media instrumentation payload must not include key "${key}" (PII or content leak)`
    }
  }
  if (payload.count !== undefined && typeof payload.count !== 'number') {
    return 'Media instrumentation payload `count` must be a number'
  }
  return null
}

/**
 * Track a media instrumentation event. Validates the payload and delegates
 * to the `send` callback. A validation failure is logged but does not throw
 * — instrumentation must never break the user flow (spec 11 § Observability).
 *
 * The caller passes a `send` function that the observability singleton owns;
 * this keeps the module framework-free.
 */
export function trackMediaEvent(
  event: MediaInstrumentationEvent,
  payload: MediaInstrumentationPayload,
  send: (event: string, payload: MediaInstrumentationPayload) => void,
): void {
  const error = validateMediaPayload(payload)
  if (error !== null) {
    console.warn(`[media-instrumentation] ${event}: ${error}`)
    return
  }
  send(event, payload)
}

// ── Performance budgets ────────────────────────────────────────────────────
//
// The spec pins performance budgets for each screen. These are the
// thresholds the instrumentation layer measures against; a breach is logged
// as a warning so the team can investigate without paging.

export const MEDIA_PERFORMANCE_BUDGETS: Readonly<Record<string, number>> = {
  // S-3.1 Asset Repository
  library_first_paint_25_cards: 1500,
  library_filter_sort_requery: 400,
  // S-3.2 Asset Upload Modal
  upload_progress_starts: 1000,
  upload_chunk_checkpoint: 10_000, // 10s or 8MB, whichever first
  upload_resume_handshake: 1000,
  upload_cancel: 500,
  // S-3.3 Asset Detail View
  asset_detail_preview_first_paint: 1500,
  // S-3.4 Folders & Collections
  folder_tree_interactive: 500,
  folder_move_apply: 200,
  folder_search_return: 400,
  // S-3.5 File Preview Modal
  preview_modal_shell_paint: 300,
  preview_first_video_frame_warm: 1500,
  preview_pdf_first_page: 1000,
  preview_focus_into_dialog: 100,
  // S-3.6 Transcription
  transcription_segment_list_interactive: 500,
  transcription_seek: 200,
  transcription_autosave_flush: 1000,
} as const

/**
 * Whether a measured duration breaches the budget for `metric`.
 */
export function breachesMediaBudget(metric: string, durationMs: number): boolean {
  const budget = (MEDIA_PERFORMANCE_BUDGETS as Record<string, number>)[metric]
  if (!budget) return false
  return durationMs > budget
}
