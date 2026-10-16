/**
 * Lesson Editor instrumentation — spec 12 § 12.2.
 *
 * Every property is an ID, a count, or an enum. **No body content, no prompt
 * text, no PII** — including no URLs and no filenames.
 *
 * The events:
 *
 *  - `lesson_editor_mode_switched` — `{ courseId, lessonId, bodyFormat, mode }`
 *  - `lesson_editor_sync_failed` — `{ courseId, lessonId, bodyFormat,
 *    direction, code }` (direction ∈ `rich→source` | `source→rich`; code is
 *    the audit code, never the text)
 *  - `lesson_editor_construct_audit_failed` — `{ courseId, lessonId,
 *    bodyFormat, code, count }`
 *  - `lesson_editor_paste_sanitized` — `{ courseId, lessonId, bodyFormat,
 *    rule, count }` (rule names which § 7.8 rule fired)
 *  - `lesson_editor_conflict_shown` — `{ courseId, lessonId, bodyFormat,
 *    resolution }` (resolution ∈ `compare` | `keep_mine` | `take_theirs`)
 *  - `lesson_editor_ai_block_accepted` — `{ courseId, lessonId, bodyFormat,
 *    scope, characters }` (scope ∈ `block` | `selection` | `all`)
 *  - `lesson_editor_export` — `{ courseId, lessonId, bodyFormat, format }`
 *  - `lesson_editor_draft_restored` — `{ courseId, lessonId, bodyFormat,
 *    source }` (source ∈ `idb` | `undo`; no draft content)
 *
 * Reconciled with Part 04 S-2.7's event set:
 *  - `lesson_editor_draft_restored` vs `item_draft_mirrored` — two different
 *    facts. `item_draft_mirrored` is the 1000ms write; `lesson_editor_
 *    draft_restored` is the author choosing Restore. Keep both.
 *  - `lesson_editor_conflict_shown` vs `item_conflict_shown` — one event.
 *    The Part 04 name wins; `{ itemId, strategy }` is extended with
 *    `{ courseId, bodyFormat }`. `lesson_editor_conflict_shown` is NOT
 *    emitted.
 *  - `lesson_editor_mode_switched` vs `workspace_tab_changed` — unrelated
 *    surfaces. Both stand.
 *
 * The emitter is deliberately minimal: a typed `trackLessonEditorEvent`
 * function that pushes to an in-memory sink. A downstream consumer (analytics,
 * observability) can subscribe. There is no batching, no network call, no
 * persistence — those are the analytics layer's job, not the editor's.
 */

/** The view mode the author switched to (spec 12 § 7.1). */
export type LessonEditorMode = 'rich' | 'split' | 'preview'

/** The direction of a Split-mode sync failure (spec 12 § 7.1). */
export type LessonEditorSyncDirection = 'rich→source' | 'source→rich'

/** The author's conflict-resolution choice (spec 12 § 8.2). */
export type LessonEditorConflictResolution = 'compare' | 'keep_mine' | 'take_theirs'

/** The scope of an AI Accept action (spec 12 § 11.1). */
export type LessonEditorAiScope = 'block' | 'selection' | 'all'

/** The source of a draft restore (spec 12 § 8.1.1). */
export type LessonEditorDraftRestoreSource = 'idb' | 'undo'

/** The § 7.8 paste rule that fired. */
export type LessonEditorPasteRule =
  | 'strip_style_class_id'
  | 'strip_mso_attributes'
  | 'remove_office_namespace'
  | 'unwrap_empty_bold_italic'
  | 'unwrap_div_span'
  | 'collapse_empty_paragraphs'
  | 'spreadsheet_to_gfm_table'
  | 'image_to_media_picker'

/** The format of a lesson export. */
export type LessonEditorExportFormat = 'markdown' | 'html'

/** The union of all Lesson Editor event payloads. */
export type LessonEditorEvent =
  | {
      event: 'lesson_editor_mode_switched'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      mode: LessonEditorMode
    }
  | {
      event: 'lesson_editor_sync_failed'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      direction: LessonEditorSyncDirection
      code: string
    }
  | {
      event: 'lesson_editor_construct_audit_failed'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      code: string
      count: number
    }
  | {
      event: 'lesson_editor_paste_sanitized'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      rule: LessonEditorPasteRule
      count: number
    }
  | {
      event: 'lesson_editor_ai_block_accepted'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      scope: LessonEditorAiScope
      characters: number
    }
  | {
      event: 'lesson_editor_export'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      format: LessonEditorExportFormat
    }
  | {
      event: 'lesson_editor_draft_restored'
      courseId: string
      lessonId: string
      bodyFormat: 'html' | 'markdown'
      source: LessonEditorDraftRestoreSource
    }

/**
 * The conflict event is emitted under the Part 04 name `item_conflict_shown`,
 * not `lesson_editor_conflict_shown` (spec 12 § 12.2 reconciliation table).
 * Its payload is `{ itemId, strategy }` extended with `{ courseId, bodyFormat }`.
 */
export interface ItemConflictShownEvent {
  event: 'item_conflict_shown'
  itemId: string
  courseId: string
  bodyFormat: 'html' | 'markdown'
  strategy: LessonEditorConflictResolution
}

/** A subscriber that receives every Lesson Editor event. */
export type LessonEditorEventSink = (event: LessonEditorEvent | ItemConflictShownEvent) => void

const sinks: Set<LessonEditorEventSink> = new Set()

/**
 * Subscribe to Lesson Editor events. Returns an unsubscribe function.
 *
 * The sink is called synchronously from `trackLessonEditorEvent`; the editor
 * does not batch or queue. A downstream analytics layer that needs batching
 * can do so inside its sink.
 */
export function subscribeToLessonEditorEvents(sink: LessonEditorEventSink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

/**
 * Emit a Lesson Editor event. Every property has been verified to be an ID, a
 * count, or an enum — no body content, no URLs, no filenames (spec 12 § 12.2).
 */
export function trackLessonEditorEvent(event: LessonEditorEvent | ItemConflictShownEvent): void {
  for (const sink of sinks) {
    try {
      sink(event)
    } catch {
      // A sink failure must not break the editor. The sink is responsible for
      // its own error handling; this guard is the editor's last line of
      // defence against a misbehaving subscriber.
    }
  }
}

/** Test-only: clear all subscribers. */
export function __clearLessonEditorEventSinksForTests(): void {
  sinks.clear()
}

/**
 * Spec 12 § 12.2 — performance budgets.
 *
 * These are the implementation-side budgets. Part 04 S-2.7 states the same
 * three figures as the screen budget; they are one set of numbers recorded in
 * two places, not two targets.
 */
export const LESSON_EDITOR_PERFORMANCE_BUDGETS = {
  /** Hydration of a 200k-character lesson: parse → doc → first paint < 1.5s. */
  hydrationMs: 1_500,
  /** Rich → Source sync ≤ 50ms at 50k characters. */
  richToSourceSyncMs: 50,
  /** A single keystroke must never block the main thread > 16ms (one frame). */
  keystrokeFrameMs: 16,
  /** Find/replace over a 200k body: first match in < 100ms after the 300ms announce debounce. */
  findFirstMatchMs: 100,
} as const

/**
 * Spec 12 § 12.2 — acceptance criteria. Binary; a tester can fail each one.
 *
 * The numbers are reproduced here so a test runner can assert against them,
 * and so a reviewer can see them in one place. Each criterion maps to a
 * manual or E2E test — they are not unit-testable.
 */
export const LESSON_EDITOR_ACCEPTANCE_CRITERIA = [
  'axe reports zero violations on Rich, Split, and Source, including at 200% zoom.',
  'A complete keyboard path — tree → item pane → type → Ctrl/⌘+S → switch mode → back to the tree — completes with no mouse, and the tree\'s selection and scroll position are intact on return.',
  'NVDA and VoiceOver pass on all three modes: the toolbar reports group and pressed state, the source textarea is labelled, find reports "n of N matches", and a conflict is announced assertive.',
  'At 200% zoom and at a 320px viewport, the editor reflows with no horizontal page scroll; a table wider than the pane scrolls inside its own labelled region.',
  'A 10-minute Ge\'ez lesson renders with zero fixed-height truncation — no line-clamp, no clipped glyph at line-height: 1.6, and no truncation on the source pane.',
  'Closing the tab with unsaved changes, then reopening the same lesson, presents the "Restore unsaved draft from {time}?" prompt with a working Discard (§ 8.1.1).',
  'Going offline, editing, and reconnecting with a server-side change in between resolves to the three-option conflict dialog — never a silent overwrite (§ 8.2).',
] as const
