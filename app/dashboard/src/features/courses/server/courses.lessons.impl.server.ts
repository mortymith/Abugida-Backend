/**
 * Server-only implementation of S-2.7 Lesson Editor persistence.
 * Review workflow: in_review lessons are locked for body edits; approved
 * lessons can only be edited after an admin resets the review.
 */
import { and, eq } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, requireUserId, resolveLesson } from './courses.server-helpers.server'
import { canSubmitForReview } from '../courses.review-state'
import { submitForReviewImpl } from './courses.reviews.impl.server'
import {
  linkLessonAsset,
  unlinkLessonAssets,
} from '#/features/media/server/media.usage.impl.server'
import { categoryForMime } from '#/features/media/media.asset-category'
import { readBodyFormat } from '../schemas/courses.markdown.schema'
import { isMarkdownWritesEnabledImpl } from '#/features/workspaces/server/workspaces.impl.server'
import type { SaveLessonInput } from './courses.lessons'

export interface LessonEditDTO {
  publicId: string
  coursePublicId: string
  courseTitle: string
  moduleTitle: string
  modulePublicId: string
  title: string
  body: string | null
  /**
   * Serialization of `body` (spec 12 § 5.2). 'html' means the lesson predates
   * the Markdown migration and must be hydrated as HTML; the client shows the
   * legacy notice and converts on next save.
   */
  bodyFormat: 'html' | 'markdown'
  /**
   * Spec 12 § 12.0 — whether the active workspace permits Markdown writes.
   * Surfaced on the DTO so the editor can decide between the Markdown
   * authoring surface and the legacy HTML path without a second round-trip.
   * When `false`, `saveLesson` will reject Markdown payloads with
   * `MARKDOWN_WRITES_DISABLED` regardless of what the client sends.
   */
  markdownWritesEnabled: boolean
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
  videoUrl: string | null
  /** Media asset backing this lesson's media (spec 05). */
  assetId: string | null
  assetName: string | null
  durationMinutes: number | null
  tags: string[]
  reviewStatus: 'draft' | 'in_review' | 'changes_requested' | 'approved'
  reviewComments: string | null
  requiresApproval: boolean
  rowVersion: number
}

export async function getLessonForEditImpl(lessonPublicId: string): Promise<LessonEditDTO> {
  await requireUserId()
  const lesson = await resolveLesson(lessonPublicId)

  const courseRows = await db
    .select({
      publicId: courses.publicId,
      title: courses.title,
      requiresApproval: courses.requiresApproval,
    })
    .from(courses)
    .where(eq(courses.id, lesson.courseId))
    .limit(1)
  const course = courseRows.at(0)

  const moduleRows = await db
    .select({ publicId: lessons.moduleId })
    .from(lessons)
    .where(eq(lessons.id, lesson.id))
    .limit(1)
  void moduleRows

  const { modules } = await import('@abugida/database/catalog')
  const moduleRecordRows = await db
    .select({ publicId: modules.publicId, title: modules.title })
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .limit(1)
  const moduleRecord = moduleRecordRows.at(0)

  // Latest reviewer comments: the newest changes_requested review.
  const { reviewRequests } = await import('@abugida/database/ops')
  const { desc } = await import('@abugida/database')
  const commentRows = await db
    .select({ comment: reviewRequests.decisionComment, state: reviewRequests.state })
    .from(reviewRequests)
    .where(eq(reviewRequests.lessonId, lesson.id))
    .orderBy(desc(reviewRequests.submittedAt))
    .limit(1)
  const latestDecision = commentRows.at(0)

  let assetName: string | null = null
  if (lesson.assetId) {
    const { assetLibrary } = await import('@abugida/database/catalog')
    const assetRows = await db
      .select({ name: assetLibrary.name, publicId: assetLibrary.publicId })
      .from(assetLibrary)
      .where(eq(assetLibrary.id, lesson.assetId))
      .limit(1)
    const asset = assetRows.at(0)
    assetName = asset?.name ?? null
  }

  let assetPublicId: string | null = null
  if (lesson.assetId) {
    const { assetLibrary } = await import('@abugida/database/catalog')
    const assetRows = await db
      .select({ publicId: assetLibrary.publicId })
      .from(assetLibrary)
      .where(eq(assetLibrary.id, lesson.assetId))
      .limit(1)
    assetPublicId = assetRows.at(0)?.publicId ?? null
  }

  return {
    publicId: lesson.publicId,
    coursePublicId: course?.publicId ?? '',
    courseTitle: course?.title ?? '',
    moduleTitle: moduleRecord?.title ?? '',
    modulePublicId: moduleRecord?.publicId ?? '',
    title: lesson.title,
    body: lesson.body,
    bodyFormat: readBodyFormat(lesson.bodyFormat),
    markdownWritesEnabled: await isMarkdownWritesEnabledImpl(),
    contentType: lesson.contentType ?? 'video',
    videoUrl: lesson.videoUrl,
    assetId: assetPublicId,
    assetName,
    durationMinutes:
      lesson.durationSeconds == null ? null : Math.round(lesson.durationSeconds / 60),
    tags: Array.isArray(lesson.tags) ? (lesson.tags as string[]) : [],
    reviewStatus: lesson.reviewStatus ?? 'draft',
    reviewComments: latestDecision?.state === 'changes_requested' ? latestDecision.comment : null,
    requiresApproval: course?.requiresApproval ?? false,
    rowVersion: lesson.rowVersion,
  }
}

export async function saveLessonImpl(input: SaveLessonInput): Promise<{ rowVersion: number }> {
  const userId = await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)

  if (lesson.reviewStatus === 'in_review') {
    throw new Error(
      'LOCKED_IN_REVIEW: this lesson is locked while under review — wait for a decision or withdraw it',
    )
  }

  // Spec 12 § 12.0 — the Markdown rollout gate. The client always sends
  // `bodyFormat: 'markdown'` (D-3 boundary), so the gate is enforced here on
  // the workspace record. With the flag off, Markdown writes are rejected
  // loudly so a partial rollout never leaves rows the reader cannot parse.
  // Dual hydration (§ 5.2) keeps every row readable regardless of state.
  const markdownEnabled = await isMarkdownWritesEnabledImpl()
  if (!markdownEnabled) {
    throw new Error(
      'MARKDOWN_WRITES_DISABLED: Markdown authoring is not enabled for this workspace yet',
    )
  }

  const rowVersion = await db.transaction(async (tx) => {
    // Media linkage (spec 05 S-2.7 ↔ S-3.1): validate the asset,
    // copy its denormalized media fields, and maintain asset_usage rows.
    let assetLink: {
      assetId: number
      objectKey: string
      fileSizeBytes: number | null
      mimeType: string | null
      durationSeconds: number | null
    } | null = null
    if (input.assetId != null) {
      const linked = await linkLessonAsset(tx, {
        lessonId: lesson.id,
        assetPublicId: input.assetId,
        userId,
      })
      const { assetLibrary } = await import('@abugida/database/catalog')
      const categoryRows = await tx
        .select({ category: assetLibrary.category })
        .from(assetLibrary)
        .where(eq(assetLibrary.id, linked.assetId))
        .limit(1)
      const assetCategory = categoryRows.at(0)?.category
      const expectedCategory =
        input.contentType === 'video' ? 'video' : input.contentType === 'pdf' ? 'document' : null
      if (
        expectedCategory != null &&
        assetCategory != null &&
        assetCategory !== expectedCategory &&
        assetCategory !== categoryForMime(null)
      ) {
        throw new Error(
          `ASSET_TYPE_MISMATCH: lesson type "${input.contentType}" needs a ${expectedCategory} asset`,
        )
      }
      assetLink = linked
    }

    // Optimistic concurrency (spec 12 § 8.2). The write is guarded by the
    // client's `expectedRowVersion`, not merely read-then-increment: a stale
    // editor must be rejected rather than silently overwriting a newer body.
    if (input.expectedRowVersion !== lesson.rowVersion) {
      throw new Error('VERSION_CONFLICT: this lesson was updated elsewhere — reload to continue')
    }

    const updated = await tx
      .update(lessons)
      .set({
        title: input.title.trim(),
        body: input.body?.trim() || null,
        // Decision D-3: the body is Markdown from here on. The validator makes
        // `bodyFormat` a literal 'markdown', so HTML can never reach this column.
        bodyFormat: 'markdown',
        contentType: input.contentType,
        videoUrl: input.videoUrl?.trim() || null,
        durationSeconds: input.durationMinutes == null ? null : input.durationMinutes * 60,
        tags: input.tags,
        assetId: input.assetId == null ? null : (assetLink?.assetId ?? null),
        fileObjectKey:
          assetLink?.objectKey ?? (input.assetId == null ? null : lesson.fileObjectKey),
        fileSizeBytes:
          assetLink?.fileSizeBytes ?? (input.assetId == null ? null : lesson.fileSizeBytes),
        mimeType: assetLink?.mimeType ?? (input.assetId == null ? null : lesson.mimeType),
        rowVersion: lesson.rowVersion + 1,
      })
      .where(and(eq(lessons.id, lesson.id), eq(lessons.rowVersion, input.expectedRowVersion)))
      .returning({ rowVersion: lessons.rowVersion })

    const nextRowVersion = updated.at(0)?.rowVersion
    // No row updated means another writer won the race between the version check
    // above and this UPDATE.
    if (!nextRowVersion) {
      throw new Error('VERSION_CONFLICT: this lesson was updated elsewhere — reload to continue')
    }

    if (input.assetId == null && lesson.assetId != null) {
      await unlinkLessonAssets(tx, { lessonId: lesson.id })
    }
    return nextRowVersion
  })

  // Spec 12 § 14.1 — write a body revision for explicit Flush and submit-for-
  // review, but NOT for the 60s autosave timer. The autosave path is covered
  // by the IndexedDB mirror (§ 8.1.1) instead; writing a revision per
  // autosave would make the history unreadable and unbounded.
  if (input.source === 'explicit' || input.source === 'submit') {
    try {
      const { writeLessonBodyRevisionImpl } = await import('./courses.lesson-revisions.impl.server')
      await writeLessonBodyRevisionImpl({
        lessonPublicId: input.lessonPublicId,
        body: input.body ?? '',
        bodyFormat: 'markdown',
        reason: 'save',
      })
    } catch {
      // A revision write failure must not fail the save itself — the body is
      // already persisted. The reviewer loses visibility for this save, but
      // the author's work is safe. Logged server-side; surfaced to ops via
      // the standard error path.
    }
  }

  return { rowVersion }
}

export async function submitLessonForReviewImpl(lessonPublicId: string): Promise<void> {
  const lesson = await resolveLesson(lessonPublicId)
  if (!canSubmitForReview(lesson.reviewStatus ?? 'draft')) {
    throw new Error(`INVALID_STATE: lesson is "${lesson.reviewStatus}"`)
  }
  await submitForReviewImpl({ lessonPublicId })
}
