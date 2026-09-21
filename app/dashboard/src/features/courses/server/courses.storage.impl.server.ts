/**
 * Server-only storage bridge: presigned upload/read URLs via @abugida/storage.
 * Falls back with STORAGE_NOT_CONFIGURED so the UI can degrade honestly
 * (thumbnail/signature are optional per spec).
 */
import { createStorage, configFromEnv, hasEnvConfig } from '@abugida/storage'
import { requireAuthoringRole, requireUserId } from './courses.server-helpers.server'

const randomUUID = () => globalThis.crypto.randomUUID()

const UPLOAD_TTL_SECONDS = 900
const READ_TTL_SECONDS = 3600

const KIND_PREFIX = {
  course_thumbnail: 'course-thumbnails',
  certificate_signature: 'certificate-signatures',
} as const

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg'])

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName.trim())
  return match ? match[1].toLowerCase() : 'bin'
}

function getStorage() {
  if (!hasEnvConfig()) {
    throw new Error(
      'STORAGE_NOT_CONFIGURED: set STORAGE_* env vars to enable image uploads (see .env.example)',
    )
  }
  return createStorage(configFromEnv())
}

export async function getImageUploadUrlImpl(input: {
  kind: 'course_thumbnail' | 'certificate_signature'
  fileName: string
  contentType: string
}): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  await requireAuthoringRole()

  if (!ALLOWED_MIME.has(input.contentType)) {
    throw new Error('UNSUPPORTED_MEDIA_TYPE: PNG or JPG only')
  }

  const objectKey = `${KIND_PREFIX[input.kind]}/${randomUUID()}.${extensionOf(input.fileName)}`
  const storage = getStorage()
  const presigned = await storage.presignedUpload(objectKey, {
    expiresIn: UPLOAD_TTL_SECONDS,
    contentType: input.contentType,
  })
  return { objectKey, uploadUrl: presigned.url, expiresIn: UPLOAD_TTL_SECONDS }
}

export async function getImageReadUrlImpl(objectKey: string): Promise<{ url: string | null }> {
  await requireUserId()
  if (!hasEnvConfig()) return { url: null }
  try {
    const storage = createStorage(configFromEnv())
    const presigned = await storage.presignedDownload(objectKey, {
      expiresIn: READ_TTL_SECONDS,
    })
    return { url: presigned.url }
  } catch {
    return { url: null }
  }
}
