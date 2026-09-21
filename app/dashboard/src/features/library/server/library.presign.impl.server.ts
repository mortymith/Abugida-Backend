/**
 * Server-only storage bridge for the Content Library via @abugida/storage.
 * Presigned PUT (browser → MinIO/S3) and short-lived read URLs. Read URLs
 * resolve the object key from the asset row server-side, so authorization
 * always passes through the library's own data (never raw bucket keys).
 */
import { createStorage, configFromEnv, hasEnvConfig } from '@abugida/storage'
import { and, eq } from '@abugida/database'
import { assetVersions } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import { extensionOf, sanitizeFileName } from '../library.asset-category'
import { resolveAsset } from './library.assets.impl.server'
import type { AssetUploadInitInput, readUrlSchema } from '../schemas/library.schema'
import type { z } from 'zod'

const UPLOAD_TTL_SECONDS = 900
const READ_TTL_SECONDS = 3600

export function getStorage() {
  if (!hasEnvConfig()) {
    throw new Error(
      'STORAGE_NOT_CONFIGURED: set STORAGE_* env vars to enable Content Library uploads (see .env.example)',
    )
  }
  return createStorage(configFromEnv())
}

export async function getAssetUploadUrlImpl(input: AssetUploadInitInput): Promise<{
  objectKey: string
  uploadUrl: string
  expiresIn: number
}> {
  await requireLibraryWriteRole()

  const cleanName = sanitizeFileName(input.fileName)
  const extension = extensionOf(cleanName) || 'bin'
  const objectKey = `asset-library/${globalThis.crypto.randomUUID()}.${extension}`

  const storage = getStorage()
  const presigned = await storage.presignedUpload(objectKey, {
    expiresIn: UPLOAD_TTL_SECONDS,
    contentType: input.contentType,
  })
  return { objectKey, uploadUrl: presigned.url, expiresIn: UPLOAD_TTL_SECONDS }
}

export async function getAssetReadUrlImpl(
  input: z.infer<typeof readUrlSchema>,
): Promise<{ url: string | null }> {
  await requireUserId()
  if (!hasEnvConfig()) return { url: null }

  let objectKey: string
  try {
    const asset = await resolveAsset(input.assetPublicId)
    if (input.versionNumber != null) {
      const versionRows = await db
        .select({ objectKey: assetVersions.objectKey })
        .from(assetVersions)
        .where(
          and(
            eq(assetVersions.assetId, asset.id),
            eq(assetVersions.versionNumber, input.versionNumber),
          ),
        )
        .limit(1)
      const versionKey = versionRows.at(0)?.objectKey
      if (!versionKey) throw new Error('VERSION_NOT_FOUND')
      objectKey = versionKey
    } else {
      objectKey = asset.objectKey
    }
  } catch {
    return { url: null }
  }

  try {
    const storage = createStorage(configFromEnv())
    const disposition = input.disposition
    const contentDisposition =
      disposition === 'attachment'
        ? `attachment; filename="${(input.downloadName ?? 'asset').replace(/["\\]/g, '')}"`
        : undefined
    const presigned = await storage.presignedDownload(objectKey, {
      expiresIn: READ_TTL_SECONDS,
      responseContentDisposition: contentDisposition,
    })
    return { url: presigned.url }
  } catch {
    return { url: null }
  }
}
