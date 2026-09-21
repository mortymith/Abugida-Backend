/**
 * Server-only implementation of S-2.7 Lesson Editor persistence.
 * Review workflow: in_review lessons are locked for body edits; approved
 * lessons can only be edited after an admin resets the review.
 */
import { eq } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, requireUserId, resolveLesson } from './courses.server-helpers.server'
import { canSubmitForReview } from '../courses.review-state'
import { submitForReviewImpl } from './courses.reviews.impl.server'
import {
  linkLessonAsset,
  unlinkLessonAssets,
} from '#/features/library/server/library.usage.impl.server'
import { categoryForMime } from '#/features/library/library.asset-category'
import type { SaveLessonInput } from './courses.lessons'

export interface LessonEditDTO {
  publicId: string
  coursePublicId: string
  courseTitle: string
  moduleTitle: string
  modulePublicId: string
  title: string
  body: string | null
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
  videoUrl: string | null
  /** Content Library asset backing this lesson's media (spec 05). */
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

  const rowVersion = await db.transaction(async (tx) => {
    // Content Library linkage (spec 05 S-2.7 ↔ S-3.1): validate the asset,
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

    const updated = await tx
      .update(lessons)
      .set({
        title: input.title.trim(),
        body: input.body?.trim() || null,
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
      .where(eq(lessons.id, lesson.id))
      .returning({ rowVersion: lessons.rowVersion })

    const nextRowVersion = updated.at(0)?.rowVersion
    if (!nextRowVersion) throw new Error('LESSON_SAVE_FAILED')

    if (input.assetId == null && lesson.assetId != null) {
      await unlinkLessonAssets(tx, { lessonId: lesson.id })
    }
    return nextRowVersion
  })

  return { rowVersion }
}

export async function submitLessonForReviewImpl(lessonPublicId: string): Promise<void> {
  const lesson = await resolveLesson(lessonPublicId)
  if (!canSubmitForReview(lesson.reviewStatus ?? 'draft')) {
    throw new Error(`INVALID_STATE: lesson is "${lesson.reviewStatus}"`)
  }
  await submitForReviewImpl({ lessonPublicId })
}
