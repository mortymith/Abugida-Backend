/**
 * TanStack Start — Download example.
 *
 * Demonstrates how to use @abugida/storage in a TanStack Start
 * server function for generating secure download links.
 */

import { createStorage } from '@abugida/storage'
import { createTanStackClient } from '@abugida/storage/tanstack'

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
 * Server function: get a presigned download URL for a course video.
 */
export async function getCourseVideoDownloadUrl(
  courseId: string,
  assetId: string,
): Promise<{ url: string; expiresAt: Date }> {
  const key = storage.keys.courseVideo(courseId, assetId)
  const result = await client.getDownloadUrl(key, { expiresIn: 3600 })
  return { url: result.url, expiresAt: result.expiresAt }
}

/**
 * Server function: get user avatar URL.
 */
export async function getUserAvatarUrl(userId: string): Promise<{ url: string; expiresAt: Date }> {
  const key = storage.keys.userAvatar(userId)
  const result = await client.getDownloadUrl(key, { expiresIn: 3600 })
  return { url: result.url, expiresAt: result.expiresAt }
}

/**
 * Server function: list all documents in a course.
 */
export async function listCourseDocuments(
  courseId: string,
): Promise<Array<{ key: string; size?: number; lastModified?: Date }>> {
  const prefix = storage.keys.courseDocumentsPrefix(courseId)
  const result = await client.list(prefix)
  return result.objects
}

/**
 * Server function: delete a course asset.
 */
export async function deleteCourseAsset(key: string): Promise<{ key: string }> {
  const result = await client.delete(key)
  return { key: result.key }
}
