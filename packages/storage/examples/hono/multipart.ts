/**
 * Hono API — Multipart upload example.
 *
 * Demonstrates how to upload large files using the S3 multipart protocol.
 */

import { Hono } from 'hono'
import { createStorage } from '@abugida/storage'
import { MIN_PART_SIZE } from '@abugida/storage'

const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida-uploads',
})

const app = new Hono()

// Initiate a multipart upload
app.post('/multipart/init', async (c) => {
  const { key, contentType } = await c.req.json<{ key: string; contentType?: string }>()

  const result = await storage.multipartCreate(key, { contentType })
  return c.json(result)
})

// Upload a part
app.post('/multipart/part', async (c) => {
  const formData = await c.req.formData()
  const key = formData.get('key') as string
  const uploadId = formData.get('uploadId') as string
  const partNumber = Number(formData.get('partNumber'))
  const file = formData.get('part') as File

  const result = await storage.multipartUploadPart(key, uploadId, partNumber, file)

  return c.json(result)
})

// Complete a multipart upload
app.post('/multipart/complete', async (c) => {
  const { key, uploadId, parts } = await c.req.json<{
    key: string
    uploadId: string
    parts: Array<{ partNumber: number; etag: string }>
  }>()

  const result = await storage.multipartComplete(key, uploadId, parts)
  return c.json(result)
})

// Abort a multipart upload
app.post('/multipart/abort', async (c) => {
  const { key, uploadId } = await c.req.json<{ key: string; uploadId: string }>()
  await storage.multipartAbort(key, uploadId)
  return c.json({ ok: true })
})

export default app
