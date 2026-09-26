/**
 * Server-only implementation of the Content Library asset lifecycle
 * (spec 05 S-3.1 – S-3.3). Upload completion verifies the object actually
 * landed in storage (storage.head) before any metadata is persisted;
 * deletion is soft and only removes blobs when nothing references them.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@abugida/database'
import {
  assetFolders,
  assetLibrary,
  assetUsage,
  assetVersions,
  courses,
  lessons,
} from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { storageEnv } from '#/config/app.config'
import {
  ASSET_MAX_SIZE_BYTES,
  categoryForMime,
  isLibraryObjectKey,
  isSupportedAssetMime,
} from '../library.asset-category'
import { escapeLike, requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import { LIBRARY_PAGE_SIZE } from '../schemas/library.schema'
import type { AssetDetailDTO, LibraryAssetPage, LibraryStats } from '../library.types'
import type { AssetCategory } from '@abugida/database/catalog'
import type {
  AssetDeleteInput,
  AssetDuplicateInput,
  AssetMetadataUpdateInput,
  AssetUploadCompleteInput,
  LibraryListQuery,
} from '../schemas/library.schema'

export async function resolveAsset(assetPublicId: string) {
  const rows = await db
    .select()
    .from(assetLibrary)
    .where(and(eq(assetLibrary.publicId, assetPublicId), isNull(assetLibrary.deletedAt)))
    .limit(1)
  const asset = rows.at(0)
  if (!asset) throw new Error('ASSET_NOT_FOUND')
  return asset
}

/**
 * Correlated "used in" count used for sorting and for the card's "N uses".
 *
 * Two deliberate rules keep the number identical everywhere it appears (S-3.1
 * card, S-3.3 detail + delete warning, S-3.3 "Used In" list):
 * 1. Usage rows pointing at a **soft-deleted** lesson do not count — the "Used
 *    In" list already filters them, so counting them made the card disagree
 *    with the detail view (and wrongly blocked blob cleanup on delete).
 * 2. A live course whose banner points at this object counts as a use, because
 *    the delete warning covers course banners too.
 */
const usageCountSql = sql<number>`(
  (SELECT COUNT(*)::int FROM ${assetUsage}
     INNER JOIN ${lessons} ON ${lessons.id} = ${assetUsage.lessonId}
    WHERE ${assetUsage.assetId} = ${assetLibrary.id} AND ${lessons.deletedAt} IS NULL)
  + (SELECT COUNT(*)::int FROM ${courses}
    WHERE ${courses.thumbnailObjectKey} = ${assetLibrary.objectKey} AND ${courses.deletedAt} IS NULL)
)`

export async function getLibraryAssetsImpl(query: LibraryListQuery): Promise<LibraryAssetPage> {
  await requireUserId()

  const filters = [isNull(assetLibrary.deletedAt)]
  if (query.category && query.category !== 'all') {
    filters.push(eq(assetLibrary.category, query.category))
  }
  if (query.folder === 'root') {
    filters.push(isNull(assetLibrary.folderId))
  } else if (query.folder && query.folder !== 'all') {
    const folderRows = await db
      .select({ id: assetFolders.id })
      .from(assetFolders)
      .where(and(eq(assetFolders.publicId, query.folder), isNull(assetFolders.deletedAt)))
      .limit(1)
    const folder = folderRows.at(0)
    if (!folder) throw new Error('FOLDER_NOT_FOUND')
    filters.push(eq(assetLibrary.folderId, folder.id))
  }
  if (query.q && query.q.trim()) {
    const pattern = `%${escapeLike(query.q.trim())}%`
    filters.push(
      or(
        ilike(assetLibrary.name, pattern),
        ilike(assetLibrary.description, pattern),
        // Tags live in a jsonb array; a text cast keeps search pragmatic.
        sql`${assetLibrary.tags}::text ILIKE ${pattern}`,
      ) ?? isNull(assetLibrary.id),
    )
  }

  const orderBy =
    query.sort === 'oldest'
      ? asc(assetLibrary.createdAt)
      : query.sort === 'name'
        ? asc(assetLibrary.name)
        : query.sort === 'size'
          ? desc(sql`COALESCE(${assetLibrary.fileSizeBytes}, 0)`)
          : query.sort === 'uses'
            ? desc(usageCountSql)
            : desc(assetLibrary.createdAt)

  const page = query.page ?? 1
  const rows = await db
    .select({
      publicId: assetLibrary.publicId,
      name: assetLibrary.name,
      category: assetLibrary.category,
      mimeType: assetLibrary.mimeType,
      fileSizeBytes: assetLibrary.fileSizeBytes,
      durationSeconds: assetLibrary.durationSeconds,
      folderId: sql<string | null>`(${assetFolders.publicId})::text`,
      folderName: assetFolders.name,
      tags: assetLibrary.tags,
      currentVersion: assetLibrary.currentVersion,
      createdAt: assetLibrary.createdAt,
      usageCount: usageCountSql,
      objectKey: assetLibrary.objectKey,
    })
    .from(assetLibrary)
    .leftJoin(assetFolders, eq(assetFolders.id, assetLibrary.folderId))
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(LIBRARY_PAGE_SIZE + 1)
    .offset((page - 1) * LIBRARY_PAGE_SIZE)

  const countRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(assetLibrary)
    .where(and(...filters))
  const totalRows = countRows.at(0)?.count ?? 0

  // Image cards get a real thumbnail via a short-lived presigned GET.
  // Signing is local HMAC work (no storage round-trip), so it is done inline.
  const { hasEnvConfig, configFromEnv, createStorage } = await import('@abugida/storage')
  const imagePreviewUrls = new Map<string, string>()
  if (hasEnvConfig(storageEnv)) {
    const storage = createStorage(configFromEnv(storageEnv))
    await Promise.all(
      rows
        .filter(
          (row) =>
            row.category === ('image' as AssetCategory) && row.mimeType?.startsWith('image/'),
        )
        .map(async (row) => {
          try {
            const presigned = await storage.presignedDownload(row.objectKey, { expiresIn: 3600 })
            imagePreviewUrls.set(row.publicId, presigned.url)
          } catch {
            // Thumbnail is decorative; a missing URL degrades to the icon.
          }
        }),
    )
  }

  return {
    rows: rows.slice(0, LIBRARY_PAGE_SIZE).map((row) => ({
      ...row,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      createdAt: row.createdAt.toISOString(),
      previewUrl: imagePreviewUrls.get(row.publicId) ?? null,
    })),
    page,
    pageSize: LIBRARY_PAGE_SIZE,
    totalRows,
    hasNextPage: rows.length > LIBRARY_PAGE_SIZE,
  }
}

export async function getLibraryStatsImpl(): Promise<LibraryStats> {
  await requireUserId()
  const rows = await db
    .select({
      category: assetLibrary.category,
      count: sql<number>`COUNT(*)::int`,
      bytes: sql<number>`COALESCE(SUM(${assetLibrary.fileSizeBytes}), 0)::bigint`,
    })
    .from(assetLibrary)
    .where(isNull(assetLibrary.deletedAt))
    .groupBy(assetLibrary.category)

  const empty = { count: 0, bytes: 0 }
  const byCategory = (category: AssetCategory) =>
    rows.find((row) => row.category === category) ?? empty
  const video = byCategory('video')
  const document = byCategory('document')
  const image = byCategory('image')
  const audio = byCategory('audio')
  const total = {
    count: video.count + document.count + image.count + audio.count + byCategory('other').count,
    bytes: video.bytes + document.bytes + image.bytes + audio.bytes + byCategory('other').bytes,
  }
  return { total, video, document, image, audio }
}

export async function getAssetDetailImpl(assetPublicId: string): Promise<AssetDetailDTO> {
  await requireUserId()
  const asset = await resolveAsset(assetPublicId)

  const folderRows = asset.folderId
    ? await db
        .select({ publicId: assetFolders.publicId, name: assetFolders.name })
        .from(assetFolders)
        .where(eq(assetFolders.id, asset.folderId))
        .limit(1)
    : []
  const folder = folderRows.at(0)

  const uploaderRows = asset.uploadedBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, asset.uploadedBy))
        .limit(1)
    : []

  const usageRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(assetUsage)
    .innerJoin(lessons, eq(lessons.id, assetUsage.lessonId))
    .where(and(eq(assetUsage.assetId, asset.id), isNull(lessons.deletedAt)))
  const lessonUses = usageRows.at(0)?.count ?? 0

  const thumbnailRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(and(eq(courses.thumbnailObjectKey, asset.objectKey), isNull(courses.deletedAt)))
  const thumbnailUses = thumbnailRows.at(0)?.count ?? 0

  return {
    publicId: asset.publicId,
    name: asset.name,
    description: asset.description,
    tags: Array.isArray(asset.tags) ? (asset.tags as string[]) : [],
    category: asset.category,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes,
    durationSeconds: asset.durationSeconds,
    objectKey: asset.objectKey,
    currentVersion: asset.currentVersion,
    folderId: folder?.publicId ?? null,
    folderName: folder?.name ?? null,
    uploadedByName: uploaderRows.at(0)?.name ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    usageCount: lessonUses + thumbnailUses,
  }
}

/**
 * Finalizes an upload: verifies the object exists in storage (the browser
 * PUT may have failed or been truncated), then either creates the asset or,
 * with `replaceExisting`, records a new version on the same-named asset.
 */
export async function completeAssetUploadImpl(
  input: AssetUploadCompleteInput,
): Promise<{ assetPublicId: string; replaced: boolean }> {
  const userId = await requireLibraryWriteRole()

  const { getStorage } = await import('./library.presign.impl.server')
  const storage = getStorage()
  // The browser only ever receives a server-minted key under `asset-library/`.
  // Anything else would let a caller adopt an unrelated object in the bucket.
  if (!isLibraryObjectKey(input.objectKey)) {
    throw new Error('INVALID_OBJECT_KEY: upload must be completed with a library-issued key')
  }
  let head
  try {
    head = await storage.head(input.objectKey)
  } catch {
    throw new Error('UPLOAD_NOT_FOUND: the file did not finish uploading — try again')
  }
  if (head.contentLength != null && head.contentLength > ASSET_MAX_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE: assets are limited to 500MB')
  }
  const storedMime = head.contentType ?? null
  const ALLOWED_STORED = [
    'video/mp4',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'audio/mpeg',
    'application/octet-stream',
  ]
  if (storedMime && !ALLOWED_STORED.includes(storedMime)) {
    throw new Error('UNSUPPORTED_MEDIA_TYPE: MP4, PDF, PNG, JPG or MP3 only')
  }
  const mimeType = storedMime && isSupportedAssetMime(storedMime) ? storedMime : null
  const category = categoryForMime(mimeType ?? storedMime)

  if (input.replaceExisting) {
    const existingRows = await db
      .select()
      .from(assetLibrary)
      .where(
        and(
          isNull(assetLibrary.deletedAt),
          sql`LOWER(${assetLibrary.name}) = LOWER(${input.name})`,
        ),
      )
      .limit(1)
    const existing = existingRows.at(0)
    if (existing) {
      const nextVersion = existing.currentVersion + 1
      await db.transaction(async (tx) => {
        await tx.insert(assetVersions).values({
          assetId: existing.id,
          versionNumber: nextVersion,
          objectKey: input.objectKey,
          fileSizeBytes: head.contentLength ?? null,
          mimeType: mimeType ?? storedMime,
          durationSeconds: input.durationSeconds,
          uploadedBy: userId,
          note: 'Replaced via upload (same-name match)',
        })
        await tx
          .update(assetLibrary)
          .set({
            objectKey: input.objectKey,
            fileSizeBytes: head.contentLength ?? existing.fileSizeBytes,
            mimeType: mimeType ?? storedMime ?? existing.mimeType,
            category: category === 'other' ? existing.category : category,
            durationSeconds: input.durationSeconds ?? existing.durationSeconds,
            currentVersion: nextVersion,
          })
          .where(eq(assetLibrary.id, existing.id))
        // Lessons linked to this asset must keep pointing at the latest file.
        // `null` duration means "unknown" (the browser never measures it), so
        // fall back to the asset's value instead of blanking every lesson.
        await tx
          .update(lessons)
          .set({
            fileObjectKey: input.objectKey,
            fileSizeBytes: head.contentLength ?? null,
            mimeType: mimeType ?? storedMime,
            durationSeconds: input.durationSeconds ?? existing.durationSeconds,
            rowVersion: sql`${lessons.rowVersion} + 1`,
          })
          .where(and(eq(lessons.assetId, existing.id), isNull(lessons.deletedAt)))
      })
      return { assetPublicId: existing.publicId, replaced: true }
    }
  }

  const assetPublicId = await db.transaction(async (tx) => {
    let folderNumericId: number | null = null
    if (input.folderId) {
      const folderRows = await tx
        .select({ id: assetFolders.id })
        .from(assetFolders)
        .where(and(eq(assetFolders.publicId, input.folderId), isNull(assetFolders.deletedAt)))
        .limit(1)
      folderNumericId = folderRows.at(0)?.id ?? null
      if (folderNumericId == null) throw new Error('FOLDER_NOT_FOUND')
    }
    const inserted = await tx
      .insert(assetLibrary)
      .values({
        name: input.name,
        description: input.description,
        tags: input.tags,
        category: category,
        folderId: folderNumericId,
        objectKey: input.objectKey,
        fileSizeBytes: head.contentLength ?? null,
        mimeType: mimeType ?? storedMime,
        durationSeconds: input.durationSeconds,
        uploadedBy: userId,
        currentVersion: 1,
      })
      .returning({ publicId: assetLibrary.publicId, id: assetLibrary.id })
    const created = inserted.at(0)
    if (!created) throw new Error('ASSET_CREATE_FAILED')
    await tx.insert(assetVersions).values({
      assetId: created.id,
      versionNumber: 1,
      objectKey: input.objectKey,
      fileSizeBytes: head.contentLength ?? null,
      mimeType: mimeType ?? storedMime,
      durationSeconds: input.durationSeconds,
      uploadedBy: userId,
    })
    return created.publicId
  })

  return { assetPublicId, replaced: false }
}

export async function updateAssetMetadataImpl(input: AssetMetadataUpdateInput) {
  await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)
  await db
    .update(assetLibrary)
    .set({
      name: input.name,
      description: input.description,
      tags: input.tags,
    })
    .where(eq(assetLibrary.id, asset.id))
  return { ok: true as const }
}

/**
 * Soft-deletes an asset. Blobs are removed only when nothing references
 * the asset (no lesson usage, no course thumbnail); otherwise the object
 * stays in storage so linked lessons keep working (documented trade-off).
 */
export async function deleteAssetImpl(input: AssetDeleteInput): Promise<{ ok: true }> {
  await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)

  const usageRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(assetUsage)
    .innerJoin(lessons, eq(lessons.id, assetUsage.lessonId))
    .where(and(eq(assetUsage.assetId, asset.id), isNull(lessons.deletedAt)))
  const lessonUses = usageRows.at(0)?.count ?? 0

  const thumbnailRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(and(eq(courses.thumbnailObjectKey, asset.objectKey), isNull(courses.deletedAt)))
  const thumbnailUses = thumbnailRows.at(0)?.count ?? 0

  // Spec S-3.1/S-3.3: an in-use asset may only be deleted once the author has
  // acknowledged the S-7.1 warning. The count is re-derived server-side, so a
  // client cannot pass `acknowledgedUsage: true` to skip the check silently —
  // it just has to have actually seen the prompt.
  if ((lessonUses > 0 || thumbnailUses > 0) && !input.acknowledgedUsage) {
    throw new Error(
      'USAGE_NOT_ACKNOWLEDGED: this asset is still in use — confirm the deletion warning first',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(assetLibrary)
      .set({ deletedAt: new Date() })
      .where(eq(assetLibrary.id, asset.id))
    if (lessonUses === 0) {
      await tx.delete(assetUsage).where(eq(assetUsage.assetId, asset.id))
    }
  })

  if (lessonUses === 0 && thumbnailUses === 0) {
    try {
      const versionRows = await db
        .select({ objectKey: assetVersions.objectKey })
        .from(assetVersions)
        .where(eq(assetVersions.assetId, asset.id))
      const { getStorage } = await import('./library.presign.impl.server')
      const storage = getStorage()
      await storage.deleteMany(versionRows.map((row) => row.objectKey))
    } catch {
      // Blob cleanup is best-effort (e.g. storage unconfigured); the asset is
      // already soft-deleted so the UI stays consistent.
    }
  }

  return { ok: true }
}

/** Copy-on-metadata duplicate (S-3.4 context menu): both rows share the
 * immutable object until one of them gets a new version. */
export async function duplicateAssetImpl(input: AssetDuplicateInput): Promise<{
  assetPublicId: string
}> {
  const userId = await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)

  const duplicated = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(assetLibrary)
      .values({
        name: `${asset.name} (copy)`.slice(0, 300),
        description: asset.description,
        tags: Array.isArray(asset.tags) ? (asset.tags as string[]) : [],
        category: asset.category,
        folderId: input.folderId ? await folderIdFromPublicId(tx, input.folderId) : null,
        objectKey: asset.objectKey,
        fileSizeBytes: asset.fileSizeBytes,
        mimeType: asset.mimeType,
        durationSeconds: asset.durationSeconds,
        currentVersion: 1,
        uploadedBy: userId,
      })
      .returning({ publicId: assetLibrary.publicId, id: assetLibrary.id })
    const created = inserted.at(0)
    if (!created) throw new Error('ASSET_CREATE_FAILED')
    await tx.insert(assetVersions).values({
      assetId: created.id,
      versionNumber: 1,
      objectKey: asset.objectKey,
      fileSizeBytes: asset.fileSizeBytes,
      mimeType: asset.mimeType,
      durationSeconds: asset.durationSeconds,
      note: 'Duplicated from source asset',
      uploadedBy: userId,
    })
    return created.publicId
  })

  return { assetPublicId: duplicated }
}

async function folderIdFromPublicId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  folderPublicId: string,
): Promise<number | null> {
  const rows = await tx
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(and(eq(assetFolders.publicId, folderPublicId), isNull(assetFolders.deletedAt)))
    .limit(1)
  return rows.at(0)?.id ?? null
}
