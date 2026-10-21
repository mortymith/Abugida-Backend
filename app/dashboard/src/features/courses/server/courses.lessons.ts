import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { MarkdownValidation as LessonMarkdownValidation } from '../schemas/courses.markdown.schema'

const lessonInputSchema = z.object({ lessonPublicId: z.string().uuid() })

/** S-2.7 editor payload for one lesson (content + settings). */
export const getLessonForEdit = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { getLessonForEditImpl } = await import('./courses.lessons.impl.server')
    return getLessonForEditImpl(data.lessonPublicId)
  })

const VIDEO_URL = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === '' ||
      /^(https?:\/\/)?(www\.)?(youtube\.com\/\S+|youtu\.be\/\S+|vimeo\.com\/\S+)/i.test(value),
    'Video URL must be a YouTube or Vimeo link',
  )

export const saveLessonSchema = z.object({
  lessonPublicId: z.string().uuid(),
  title: z.string().trim().min(3, 'At least 3 characters').max(300),
  body: z.string().max(200_000).nullable(),
  /**
   * Decision D-3 (spec 12 § 5.4): the client must state the serialization
   * format it produced. Accepting only 'markdown' means a client that forgets
   * to call `getMarkdown()` fails loudly here instead of silently writing HTML
   * into a column that is supposed to hold Markdown.
   *
   * The § 12.0 rollout gate is enforced server-side in `saveLessonImpl`: when
   * the workspace has `markdownWritesEnabled = false`, the impl rejects a
   * Markdown payload with `MARKDOWN_WRITES_DISABLED` so a partial rollout
   * never leaves rows the reader cannot parse. The schema does not relax the
   * literal — the gate is a workspace policy, not a per-call format choice.
   */
  bodyFormat: z.literal('markdown'),
  contentType: z.enum(['pdf', 'video', 'quiz', 'exercise', 'link']),
  videoUrl: VIDEO_URL.nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  /** Media provenance (spec 05): null clears any linked asset. */
  assetId: z.string().uuid().nullable().optional(),
  /** Optimistic concurrency: reject stale saves (concurrent edits). */
  expectedRowVersion: z.number().int().positive(),
  /**
   * Spec 12 § 14.1 — what triggered the save. Only `explicit` (Ctrl/⌘+S,
   * context-switch flush) and `submit` (submit for review) write a body
   * revision. `autosave` (the 60s idle timer) does not — the autosave path
   * is covered by the IndexedDB mirror (§ 8.1.1) instead, and writing a
   * revision per autosave would make the history unreadable and unbounded.
   *
   * Defaults to `explicit` so a caller that forgets to set it writes a
   * revision (the safe default — a missing revision loses reviewer
   * visibility, while an extra revision is just noise).
   */
  source: z.enum(['explicit', 'autosave', 'submit']).default('explicit'),
})

export type SaveLessonInput = z.infer<typeof saveLessonSchema>

export const saveLesson = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveLessonSchema.parse(input))
  .handler(async ({ data }): Promise<{ rowVersion: number }> => {
    const { saveLessonImpl } = await import('./courses.lessons.impl.server')
    return saveLessonImpl(data)
  })

/** Submit for review / re-submit (S-2.7 ↔ S-2.14). */
export const submitLessonForReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { submitForReviewImpl } = await import('./courses.reviews.impl.server')
    return submitForReviewImpl({ lessonPublicId: data.lessonPublicId })
  })

/**
 * Server-side Markdown lint (spec 12 § 9.3).
 *
 * `MarkdownManager` is DOM-free, so this is a real server-side check rather than
 * a client-only courtesy. Runs on every save — including lessons hydrated from
 * legacy HTML — so a body is never silently rewritten into a lossy shape.
 */
export const validateLessonMarkdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ markdown: z.string().max(200_000) }).parse(input))
  .handler(async ({ data }): Promise<LessonMarkdownValidation> => {
    const { validateLessonMarkdownImpl } = await import('./courses.markdown-validate.impl.server')
    return validateLessonMarkdownImpl(data.markdown)
  })

/** Raw Markdown export for one lesson (Copy / Download). */
export const exportLessonMarkdown = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ markdown: string; bodyFormat: string }> => {
    const { exportLessonMarkdownImpl } = await import('./courses.markdown-validate.impl.server')
    return exportLessonMarkdownImpl(data.lessonPublicId)
  })

/**
 * Convert one lesson's body from legacy HTML to Markdown (spec 12 § 5.3).
 *
 * Idempotent: a row already marked 'markdown' is a no-op, so the migration is
 * safe to re-run. A row whose HTML contains markup outside the legacy schema is
 * reported as unconvertible and left as HTML rather than being guessed at.
 */
export const migrateLessonBodyToMarkdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { migrateLessonBodyImpl } = await import('./courses.markdown-validate.impl.server')
    return migrateLessonBodyImpl(data.lessonPublicId)
  })

/**
 * Spec 12 § 8.2 — conflict-resolution helpers.
 *
 * These three server fns back the three-option conflict dialog. The editor
 * calls them as the author picks Keep mine / Take theirs / Compare:
 *  - `getLessonServerRowVersion` re-stamps `expectedRowVersion` for the
 *    Keep-mine retry.
 *  - `recordLessonConflictOverride` writes the audit log entry that makes
 *    a Keep-mine override reviewable after the fact.
 *  - `confirmServerBody` is the Take-theirs guard: confirms the server body
 *    the author is about to hydrate is the one the server currently holds
 *    before the local buffer is discarded.
 */
const conflictInputSchema = z.object({
  lessonPublicId: z.string().uuid(),
  localRowVersion: z.number().int().positive(),
  serverRowVersion: z.number().int().positive(),
  resolution: z.enum(['keep_mine', 'take_theirs']),
})

export const getLessonServerRowVersion = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { getLessonServerRowVersionImpl } =
      await import('./courses.markdown-conflict.impl.server')
    return getLessonServerRowVersionImpl(data.lessonPublicId)
  })

export const recordLessonConflictOverride = createServerFn({ method: 'POST' })
  .validator((input: unknown) => conflictInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { recordLessonConflictOverrideImpl } =
      await import('./courses.markdown-conflict.impl.server')
    await recordLessonConflictOverrideImpl(data)
    return { ok: true as const }
  })

const confirmServerBodySchema = z.object({
  lessonPublicId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
})

export const confirmServerBody = createServerFn({ method: 'GET' })
  .validator((input: unknown) => confirmServerBodySchema.parse(input))
  .handler(async ({ data }) => {
    const { confirmServerBodyImpl } = await import('./courses.markdown-conflict.impl.server')
    return confirmServerBodyImpl(data.lessonPublicId, data.expectedRowVersion)
  })

/**
 * Spec 12 § 9.4 — reference audit. Returns advisory findings for images whose
 * media asset is missing/archived (ASSET_MISSING) and links whose host fails a
 * HEAD check (LINK_UNREACHABLE). Both are advisory: they never block autosave
 * (§ 8.1.2) and never produce a 409. They DO block publish readiness, because
 * a broken image in a Published lesson is a student-facing defect.
 *
 * The audit runs on flush (Ctrl/⌘+S, context switch, 60s idle timer) and on
 * publish-readiness re-check — never per keystroke. The 24h link cache is
 * what makes this affordable.
 */
const referenceAuditSchema = z.object({ markdown: z.string().max(200_000) })

export const auditLessonReferences = createServerFn({ method: 'POST' })
  .validator((input: unknown) => referenceAuditSchema.parse(input))
  .handler(async ({ data }) => {
    const { auditReferencesImpl } = await import('./courses.reference-audit.impl.server')
    return auditReferencesImpl(data.markdown)
  })

/**
 * Spec 12 § 14.1 — minimal version history (not Git).
 *
 * Spec 12 § 14 deferred revision history entirely, which breaks the
 * reviewer's job: S-2.14 asks a reviewer to judge a change, and with no prior
 * version there is nothing to change *from*. These three server fns are the
 * minimum that satisfies DESIGN.md § 5.10:
 *
 *  - `writeLessonBodyRevision` — called by saveLesson (reason `save`),
 *    submitLessonForReview (reason `save`), the AI Accept action
 *    (reason `ai_accept`), and the migration runner (reason `migration`).
 *  - `listLessonBodyRevisions` — the S-2.14 review panel reads newest-first.
 *  - `restoreLessonBodyRevision` — Restore appends a new `restore` revision;
 *    it never deletes or truncates history.
 *
 * The 60s autosave timer and the context-switch / unmount flush do NOT write a
 * revision (§ 14.1's table). Retention is 30 revisions per lesson with a
 * documented prune job.
 */
const writeRevisionSchema = z.object({
  lessonPublicId: z.string().uuid(),
  body: z.string().max(200_000),
  bodyFormat: z.enum(['html', 'markdown']),
  reason: z.enum(['save', 'ai_accept', 'restore', 'migration']),
})

export const writeLessonBodyRevision = createServerFn({ method: 'POST' })
  .validator((input: unknown) => writeRevisionSchema.parse(input))
  .handler(async ({ data }) => {
    const { writeLessonBodyRevisionImpl } = await import('./courses.lesson-revisions.impl.server')
    return writeLessonBodyRevisionImpl(data)
  })

export const listLessonBodyRevisions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { listLessonBodyRevisionsImpl } = await import('./courses.lesson-revisions.impl.server')
    return listLessonBodyRevisionsImpl(data.lessonPublicId)
  })

const restoreRevisionSchema = z.object({
  lessonPublicId: z.string().uuid(),
  revisionPublicId: z.string().uuid(),
})

export const restoreLessonBodyRevision = createServerFn({ method: 'POST' })
  .validator((input: unknown) => restoreRevisionSchema.parse(input))
  .handler(async ({ data }) => {
    const { restoreLessonBodyRevisionImpl } = await import('./courses.lesson-revisions.impl.server')
    return restoreLessonBodyRevisionImpl(data)
  })
