/**
 * Hono API storage client — convenience wrapper for use in Hono routes.
 */

import type { Storage } from '../../core/storage.ts'

/**
 * Create a Hono-compatible storage client.
 *
 * This wraps the main `Storage` instance and provides request-scoped
 * methods that integrate with Hono's context (e.g. streaming bodies
 * directly from Hono requests to S3).
 */
export class HonoStorageClient {
  constructor(private readonly storage: Storage) {}

  /** Underlying storage instance for direct access. */
  get raw(): Storage {
    return this.storage
  }

  /**
   * Upload a file from a Hono `Request` (e.g. FormData entry).
   */
  async uploadFromRequest(
    key: string,
    file: File,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ) {
    return this.storage.put(key, file, {
      contentType: options?.contentType ?? file.type,
      metadata: options?.metadata,
    })
  }

  /**
   * Generate a presigned upload URL and return it as a JSON response body.
   */
  async getPresignedUploadUrl(key: string, options?: { expiresIn?: number; contentType?: string }) {
    return this.storage.presignedUpload(key, {
      expiresIn: options?.expiresIn,
      contentType: options?.contentType,
    })
  }

  /**
   * Generate a presigned download URL.
   */
  async getPresignedDownloadUrl(
    key: string,
    options?: { expiresIn?: number; responseContentDisposition?: string },
  ) {
    return this.storage.presignedDownload(key, {
      expiresIn: options?.expiresIn,
      responseContentDisposition: options?.responseContentDisposition,
    })
  }

  /**
   * Delete an object.
   */
  async delete(key: string) {
    return this.storage.delete(key)
  }

  /**
   * Get object metadata.
   */
  async head(key: string) {
    return this.storage.head(key)
  }

  /**
   * Check if an object exists.
   */
  async exists(key: string) {
    return this.storage.exists(key)
  }

  /**
   * List objects under a prefix.
   */
  async list(prefix: string, options?: { maxKeys?: number }) {
    return this.storage.list(prefix, options)
  }
}

/**
 * Create a Hono storage client from a Storage instance.
 */
export function createHonoClient(storage: Storage): HonoStorageClient {
  return new HonoStorageClient(storage)
}
