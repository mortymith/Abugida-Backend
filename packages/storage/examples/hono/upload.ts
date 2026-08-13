/**
 * Hono API — Upload example.
 *
 * Demonstrates how to use @abugida/storage with a Hono API server
 * for handling file uploads via multipart/form-data.
 */

import { Hono } from 'hono'
import { createStorage } from '@abugida/storage'
import { createHonoClient } from '@abugida/storage/hono'

// Initialize storage
const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida-uploads',
})

// Create Hono-friendly client
const client = createHonoClient(storage)

const app = new Hono()

// Upload a course video
app.post('/courses/:courseId/video', async (c) => {
  const courseId = c.req.param('courseId')
  const formData = await c.req.formData()
  const file = formData.get('video') as File

  if (!file) {
    return c.json({ error: 'No video file provided' }, 400)
  }

  // Generate storage key
  const assetId = crypto.randomUUID()
  const key = storage.keys.courseVideo(courseId, assetId)

  // Upload
  const result = await client.uploadFromRequest(key, file, {
    contentType: file.type,
    metadata: { courseId, assetId, originalName: file.name },
  })

  return c.json({ key: result.key, etag: result.etag, assetId }, 201)
})

// Upload a course thumbnail
app.post('/courses/:courseId/thumbnail', async (c) => {
  const courseId = c.req.param('courseId')
  const formData = await c.req.formData()
  const file = formData.get('thumbnail') as File

  if (!file) {
    return c.json({ error: 'No thumbnail provided' }, 400)
  }

  const assetId = crypto.randomUUID()
  const key = storage.keys.courseThumbnail(courseId, assetId)

  const result = await client.uploadFromRequest(key, file)
  return c.json({ key: result.key, etag: result.etag, assetId }, 201)
})

// Upload user avatar
app.post('/users/:userId/avatar', async (c) => {
  const userId = c.req.param('userId')
  const formData = await c.req.formData()
  const file = formData.get('avatar') as File

  if (!file) {
    return c.json({ error: 'No avatar provided' }, 400)
  }

  const key = storage.keys.userAvatar(userId)
  const result = await client.uploadFromRequest(key, file)
  return c.json({ key: result.key, etag: result.etag }, 201)
})

export default app
