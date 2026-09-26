/**
 * Server-only implementation of asset versioning (S-3.3). Completing a
 * version runs in one transaction: version row + asset pointer swap +
 * re-sync of every lesson that links the asset (its denormalized file
 * fields follow the latest version and row_version bumps so stale editors
 * fail loudly instead of overwriting).
 */
import { and, desc, eq, isNull, sql } from '@abugida/database'
import { assetLibrary, assetVersions, lessons } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  ASSET_MAX_SIZE_BYTES,
  categoryForMime,
  extensionOf,
  isLibraryObjectKey,
  sanitizeFileName,
} from '../library.asset-category'
import { resolveAsset } from './library.assets.impl.server'
import { getStorage } from './library.presign.impl.server'
import { requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import type { AssetVersionDTO } from '../library.types'
import type { AssetVersionCompleteInput, AssetVersionInitInput } from '../schemas/library.schema'

export async function getAssetVersionsImpl(assetPublicId: string): Promise<AssetVersionDTO[]> {
  // Version history is part of the read-only S-3.3 screen (Admin/Editor/Viewer),
  // so this needs a session but not the write role. Gating it behind
  // requireLibraryWriteRole left Reviewer/Viewer with a silently empty history
  // (the route loader's allSettled swallowed the FORBIDDEN).
  await requireUserId()
  const asset = await resolveAsset(assetPublicId)

  const rows = await db
    .select({
      versionNumber: assetVersions.versionNumber,
      objectKey: assetVersions.objectKey,
      fileSizeBytes: assetVersions.fileSizeBytes,
      mimeType: assetVersions.mimeType,
      uploadedByName: users.name,
      createdAt: assetVersions.createdAt,
    })
    .from(assetVersions)
    .leftJoin(users, eq(users.id, assetVersions.uploadedBy))
    .where(eq(assetVersions.assetId, asset.id))
    .orderBy(desc(assetVersions.versionNumber))

  return rows.map((row) => ({
    ...row,
    uploadedByName: row.uploadedByName ?? null,
    createdAt: row.createdAt.toISOString(),
    isCurrent: row.versionNumber === asset.currentVersion,
  }))
}

export async function uploadAssetVersionImpl(input: AssetVersionInitInput): Promise<{
  objectKey: string
  uploadUrl: string
  versionNumber: number
  expiresIn: number
}> {
  await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)

  const cleanName = sanitizeFileName(input.fileName)
  const extension = extensionOf(cleanName) || 'bin'
  const objectKey = `asset-library/versions/${asset.publicId}/${asset.currentVersion + 1}-${globalThis.crypto.randomUUID()}.${extension}`

  const storage = getStorage()
  const presigned = await storage.presignedUpload(objectKey, {
    expiresIn: 900,
    contentType: input.contentType,
  })
  return {
    objectKey,
    uploadUrl: presigned.url,
    versionNumber: asset.currentVersion + 1,
    expiresIn: 900,
  }
}

export async function completeAssetVersionImpl(input: AssetVersionCompleteInput): Promise<{
  versionNumber: number
}> {
  const userId = await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)

  const storage = getStorage()
  // Same namespace guard as the initial upload: the key must be one this
  // version-upload flow minted under `asset-library/versions/`.
  if (!isLibraryObjectKey(input.objectKey)) {
    throw new Error('INVALID_OBJECT_KEY: upload must be completed with a library-issued key')
  }
  let head
  try {
    head = await storage.head(input.objectKey)
  } catch {
    throw new Error('UPLOAD_NOT_FOUND: the new version did not finish uploading — try again')
  }
  if (head.contentLength != null && head.contentLength > ASSET_MAX_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE: assets are limited to 500MB')
  }

  const storedMime = head.contentType ?? null
  const versionNumber = asset.currentVersion + 1
  const category = categoryForMime(storedMime)

  await db.transaction(async (tx) => {
    await tx.insert(assetVersions).values({
      assetId: asset.id,
      versionNumber,
      objectKey: input.objectKey,
      fileSizeBytes: head.contentLength ?? null,
      mimeType: storedMime,
      durationSeconds: input.durationSeconds,
      uploadedBy: userId,
      note: 'Uploaded new version',
    })
    await tx
      .update(assetLibrary)
      .set({
        objectKey: input.objectKey,
        fileSizeBytes: head.contentLength ?? asset.fileSizeBytes,
        mimeType: storedMime ?? asset.mimeType,
        category: category === 'other' ? asset.category : category,
        durationSeconds: input.durationSeconds ?? asset.durationSeconds,
        currentVersion: versionNumber,
      })
      .where(eq(assetLibrary.id, asset.id))
    await tx
      .update(lessons)
      .set({
        fileObjectKey: input.objectKey,
        fileSizeBytes: head.contentLength ?? null,
        mimeType: storedMime,
        // The browser never measures duration, so `null` means "unknown" —
        // keep the previous value rather than blanking every linked lesson.
        durationSeconds: input.durationSeconds ?? asset.durationSeconds,
        rowVersion: sql`${lessons.rowVersion} + 1`,
      })
      .where(and(eq(lessons.assetId, asset.id), isNull(lessons.deletedAt)))
  })

  return { versionNumber }
}
