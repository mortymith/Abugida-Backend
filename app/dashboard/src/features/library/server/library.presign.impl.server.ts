/**
 * Server-only storage bridge for the Content Library via @abugida/storage.
 * Presigned PUT (browser → MinIO/S3) and short-lived read URLs. Degrades
 * with STORAGE_NOT_CONFIGURED when env is absent so the UI can explain.
 */
import { createStorage, configFromEnv, hasEnvConfig } from '@abugida/storage'
import { requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import { extensionOf, sanitizeFileName } from '../library.asset-category'
import type { z } from 'zod'
import type { AssetUploadInitInput, readUrlSchema } from '../schemas/library.schema'

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
  try {
    const storage = createStorage(configFromEnv())
    const disposition = input.disposition
    const contentDisposition =
      disposition === 'attachment'
        ? `attachment; filename="${(input.downloadName ?? 'asset').replace(/["\\]/g, '')}"`
        : undefined
    const presigned = await storage.presignedDownload(input.objectKey, {
      expiresIn: READ_TTL_SECONDS,
      responseContentDisposition: contentDisposition,
    })
    return { url: presigned.url }
  } catch {
    return { url: null }
  }
}
