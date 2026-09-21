/**
 * Server-only implementation of asset usage.
 *
 * - `getAssetUsageImpl` powers the S-3.3 "Used In" list: lesson chains
 *   (course → module → lesson) from asset_usage plus courses whose
 *   thumbnail_object_key points at the asset.
 * - `linkLessonAsset` / `unlinkLessonAssets` are consumed by the courses
 *   lesson-save flow INSIDE its transaction, keeping lesson→asset links
 *   consistent with `lessons.asset_id` (single writer, no drift).
 */
import { and, asc, eq, isNull, ne } from '@abugida/database'
import { assetLibrary, assetUsage, courses, lessons, modules } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { resolveAsset } from './library.assets.impl.server'
import { requireUserId } from './library.server-helpers.server'
import type { AssetUsageDTO } from '../library.types'

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function getAssetUsageImpl(assetPublicId: string): Promise<AssetUsageDTO> {
  await requireUserId()
  const asset = await resolveAsset(assetPublicId)

  const lessonRows = await db
    .select({
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      modulePublicId: modules.publicId,
      moduleTitle: modules.title,
      lessonPublicId: lessons.publicId,
      lessonTitle: lessons.title,
      lessonContentType: lessons.contentType,
    })
    .from(assetUsage)
    .innerJoin(lessons, eq(lessons.id, assetUsage.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(eq(assetUsage.assetId, asset.id), isNull(lessons.deletedAt)))
    .orderBy(asc(courses.title), asc(lessons.sortOrder))

  const thumbnailRows = await db
    .select({ coursePublicId: courses.publicId, courseTitle: courses.title })
    .from(courses)
    .where(and(eq(courses.thumbnailObjectKey, asset.objectKey), isNull(courses.deletedAt)))

  return {
    lessonUses: lessonRows.map((row) => ({
      ...row,
      lessonContentType: row.lessonContentType ?? null,
    })),
    thumbnailCourses: thumbnailRows,
  }
}

/**
 * Links a lesson to a library asset and copies the denormalized media
 * fields onto the lesson row. Runs inside the caller's transaction.
 * `categoryCheck` lets the lesson flow enforce video↔video, pdf↔pdf.
 */
export async function linkLessonAsset(
  tx: DbClient,
  input: { lessonId: number; assetPublicId: string; userId: string },
): Promise<{
  assetId: number
  objectKey: string
  fileSizeBytes: number | null
  mimeType: string | null
  durationSeconds: number | null
}> {
  const rows = await tx
    .select()
    .from(assetLibrary)
    .where(and(eq(assetLibrary.publicId, input.assetPublicId), isNull(assetLibrary.deletedAt)))
    .limit(1)
  const asset = rows.at(0)
  if (!asset) throw new Error('ASSET_NOT_FOUND')

  await tx
    .insert(assetUsage)
    .values({ assetId: asset.id, lessonId: input.lessonId, createdBy: input.userId })
    .onConflictDoNothing({ target: [assetUsage.assetId, assetUsage.lessonId] })

  return {
    assetId: asset.id,
    objectKey: asset.objectKey,
    fileSizeBytes: asset.fileSizeBytes,
    mimeType: asset.mimeType,
    durationSeconds: asset.durationSeconds,
  }
}

/** Removes this lesson's usage row (all links or all but the kept asset). */
export async function unlinkLessonAssets(
  tx: DbClient,
  input: { lessonId: number; keepAssetPublicId?: string },
): Promise<void> {
  if (input.keepAssetPublicId) {
    const keepRows = await tx
      .select({ id: assetLibrary.id })
      .from(assetLibrary)
      .where(eq(assetLibrary.publicId, input.keepAssetPublicId))
      .limit(1)
    const keepId = keepRows.at(0)?.id
    if (keepId) {
      await tx
        .delete(assetUsage)
        .where(and(eq(assetUsage.lessonId, input.lessonId), ne(assetUsage.assetId, keepId)))
      return
    }
  }
  await tx.delete(assetUsage).where(eq(assetUsage.lessonId, input.lessonId))
}
