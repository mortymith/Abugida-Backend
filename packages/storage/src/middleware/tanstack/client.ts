/**
 * TanStack Start storage client — convenience wrapper for use in
 * TanStack Start dashboard and React-based internal tools.
 */

import type { Storage } from '../../core/storage.ts'
import type { BodyInput } from '../../core/types.ts'

/**
 * TanStack Start storage client.
 *
 * Designed for use in server functions and React components that need
 * to interact with the storage layer. All methods return serialisable
 * results that can be sent over the wire.
 */
export class TanStackStorageClient {
  constructor(private readonly storage: Storage) {}

  /** Underlying storage instance for direct access. */
  get raw(): Storage {
    return this.storage
  }

  /** Upload a file. */
  async upload(
    key: string,
    body: BodyInput,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ) {
    return this.storage.put(key, body, options)
  }

  /** Generate a presigned upload URL. */
  async getUploadUrl(key: string, options?: { expiresIn?: number; contentType?: string }) {
    return this.storage.presignedUpload(key, options)
  }

  /** Generate a presigned download URL. */
  async getDownloadUrl(key: string, options?: { expiresIn?: number }) {
    return this.storage.presignedDownload(key, options)
  }

  /** Get object metadata. */
  async getMetadata(key: string) {
    return this.storage.head(key)
  }

  /** Check if an object exists. */
  async exists(key: string) {
    return this.storage.exists(key)
  }

  /** Delete an object. */
  async delete(key: string) {
    return this.storage.delete(key)
  }

  /** List objects under a prefix. */
  async list(prefix: string, options?: { maxKeys?: number }) {
    return this.storage.list(prefix, options)
  }

  /** Copy an object. */
  async copy(sourceKey: string, destinationKey: string) {
    return this.storage.copy(sourceKey, destinationKey)
  }

  /** Move an object. */
  async move(sourceKey: string, destinationKey: string) {
    return this.storage.move(sourceKey, destinationKey)
  }
}

/**
 * Create a TanStack Start storage client from a Storage instance.
 */
export function createTanStackClient(storage: Storage): TanStackStorageClient {
  return new TanStackStorageClient(storage)
}
