/**
 * TanStack Start — Upload example.
 *
 * Demonstrates how to use @abugida/storage in a TanStack Start
 * server function for handling file uploads from the dashboard.
 */

import { createStorage } from '@abugida/storage'
import { createTanStackClient } from '@abugida/storage/tanstack'

// Initialize storage (typically in a shared module)
const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida-uploads',
})

const client = createTanStackClient(storage)

/**
 * Server function: upload a course document.
 */
export async function uploadCourseDocument(
  courseId: string,
  file: File,
): Promise<{ key: string; etag?: string }> {
  const assetId = crypto.randomUUID()
  const key = storage.keys.courseDocument(courseId, assetId)

  const result = await client.upload(key, file, {
    contentType: file.type,
    metadata: { courseId, assetId, originalName: file.name },
  })

  return { key: result.key, etag: result.etag }
}

/**
 * Server function: upload a user avatar.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
): Promise<{ key: string; etag?: string }> {
  const key = storage.keys.userAvatar(userId)

  const result = await client.upload(key, file, {
    contentType: file.type,
  })

  return { key: result.key, etag: result.etag }
}

/**
 * Server function: get a presigned upload URL for client-side upload.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType?: string,
): Promise<{ url: string; expiresIn: number; expiresAt: Date }> {
  return client.getUploadUrl(key, { expiresIn: 3600, contentType })
}
