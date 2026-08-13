/**
 * Hono storage routes — ready-to-mount route definitions.
 *
 * Import and mount these routes on your Hono app to get a RESTful
 * storage API out of the box.
 *
 * Usage:
 * ```ts
 * import { Hono } from "hono";
 * import { createStorageRoutes } from "@abugida/storage/hono";
 * import { createStorage } from "@abugida/storage";
 *
 * const app = new Hono();
 * const storage = createStorage(config);
 * app.route("/storage", createStorageRoutes(storage));
 * ```
 */

import { Hono } from 'hono'
import type { Storage } from '../../core/storage.ts'

/**
 * Create a set of Hono routes for common storage operations.
 */
export function createStorageRoutes(storage: Storage): Hono {
  const app = new Hono()

  // Upload
  app.post('/upload', async (c) => {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const key = formData.get('key') as string | null

    if (!file || !key) {
      return c.json({ error: 'Missing file or key' }, 400)
    }

    const result = await storage.put(key, file, {
      contentType: file.type,
    })

    return c.json(result, 201)
  })

  // Presigned upload URL
  app.post('/presigned/upload', async (c) => {
    const body = await c.req.json<{ key: string; expiresIn?: number; contentType?: string }>()
    const result = await storage.presignedUpload(body.key, {
      expiresIn: body.expiresIn,
      contentType: body.contentType,
    })
    return c.json(result)
  })

  // Presigned download URL
  app.post('/presigned/download', async (c) => {
    const body = await c.req.json<{ key: string; expiresIn?: number }>()
    const result = await storage.presignedDownload(body.key, {
      expiresIn: body.expiresIn,
    })
    return c.json(result)
  })

  // Get metadata
  app.get('/head/:key{.+}', async (c) => {
    const key = c.req.param('key')
    try {
      const metadata = await storage.head(key)
      return c.json(metadata)
    } catch {
      return c.json({ error: 'Object not found' }, 404)
    }
  })

  // Check existence
  app.get('/exists/:key{.+}', async (c) => {
    const key = c.req.param('key')
    const result = await storage.exists(key)
    return c.json(result)
  })

  // Delete
  app.delete('/:key{.+}', async (c) => {
    const key = c.req.param('key')
    const result = await storage.delete(key)
    return c.json(result)
  })

  // List
  app.get('/list', async (c) => {
    const prefix = c.req.query('prefix') ?? ''
    const maxKeys = c.req.query('maxKeys') ? Number(c.req.query('maxKeys')) : undefined
    const result = await storage.list(prefix, { maxKeys })
    return c.json(result)
  })

  return app
}
