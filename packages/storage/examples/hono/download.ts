/**
 * Hono API — Download example.
 *
 * Demonstrates presigned URL generation for secure downloads.
 */

import { Hono } from 'hono'
import { createStorage } from '@abugida/storage'
import { createHonoClient } from '@abugida/storage/hono'

const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida-uploads',
})

const client = createHonoClient(storage)

const app = new Hono()

// Get a presigned download URL for a course video
app.get('/courses/:courseId/video/:assetId/download-url', async (c) => {
  const { courseId, assetId } = c.req.param()
  const key = storage.keys.courseVideo(courseId, assetId)

  const result = await client.getPresignedDownloadUrl(key, {
    expiresIn: 3600, // 1 hour
    responseContentDisposition: `attachment; filename="${assetId}.mp4"`,
  })

  return c.json(result)
})

// Get a presigned upload URL (client-side upload)
app.post('/courses/:courseId/video/upload-url', async (c) => {
  const courseId = c.req.param('courseId')
  const assetId = crypto.randomUUID()
  const key = storage.keys.courseVideo(courseId, assetId)

  const result = await client.getPresignedUploadUrl(key, {
    expiresIn: 3600,
    contentType: 'video/mp4',
  })

  return c.json({ ...result, key, assetId })
})

// List all videos in a course
app.get('/courses/:courseId/videos', async (c) => {
  const courseId = c.req.param('courseId')
  const prefix = storage.keys.courseVideosPrefix(courseId)

  const result = await client.list(prefix)
  return c.json(result)
})

export default app
