/**
 * Main Storage class — the central orchestrator for all operations.
 *
 * This class wires together the S3 client, all operation modules,
 * the key management system, and the presigned/multipart subsystems
 * behind a single unified API.
 */

import type { S3Client } from '@aws-sdk/client-s3'
import type {
  StorageConfig,
  PutOptions,
  PutResult,
  PutManyItem,
  PutManyOptions,
  PutManyResult,
  BodyInput,
  GetOptions,
  GetResult,
  HeadOptions,
  ObjectMetadata,
  ExistsResult,
  DeleteOptions,
  DeleteResult,
  DeleteManyResult,
  CopyOptions,
  CopyResult,
  MoveOptions,
  MoveResult,
  ListOptions,
  ListResult,
  ListedObject,
  TagSet,
} from './types.ts'

import { getOrCreateClient } from './client.ts'
import { checkHealth, CircuitBreaker } from './connection.ts'
import type { HealthCheckResult, CircuitBreakerConfig } from './connection.ts'

// Operations
import { put, putMany, putManyParallel } from '../operations/put.ts'
import { get, getAsBuffer, getAsString } from '../operations/get.ts'
import { head, exists } from '../operations/head.ts'
import { deleteObject, deleteMany } from '../operations/delete.ts'
import { copy } from '../operations/copy.ts'
import { move } from '../operations/move.ts'
import { list, listAll } from '../operations/list.ts'

// Presigned
import { presignedUpload, presignedPut } from '../presigned/upload.ts'
import { presignedDownload, presignedGet } from '../presigned/download.ts'
import { presignedDelete } from '../presigned/delete.ts'
import type { PresignedUrlOptions, PresignedUrlResult } from '../presigned/types.ts'

// Multipart
import { multipartCreate } from '../multipart/create.ts'
import { multipartUploadPart } from '../multipart/upload-part.ts'
import { multipartComplete } from '../multipart/complete.ts'
import { multipartAbort } from '../multipart/abort.ts'
import { multipartListParts } from '../multipart/list-parts.ts'
import type {
  MultipartCreateResult,
  MultipartUploadPartResult,
  MultipartCompleteResult,
  CompletedPart,
  MultipartListedPart,
  MultipartUploadPartOptions,
} from '../multipart/types.ts'

// Keys
import * as courseKeys from '../keys/courses.ts'
import * as userKeys from '../keys/users.ts'
import * as orgKeys from '../keys/organizations.ts'
import * as exportKeys from '../keys/exports.ts'
import * as tempKeys from '../keys/temp.ts'

// Metadata / Tags (via S3 commands)
import { GetObjectTaggingCommand, PutObjectTaggingCommand } from '@aws-sdk/client-s3'

// Config
import { validateConfig } from '../config/schema.ts'

// Retry
import { withRetry } from '../utils/retry.ts'

// ---------------------------------------------------------------------------
// Key managers unified under one namespace
// ---------------------------------------------------------------------------

export const storageKeys = {
  course: courseKeys.course,
  courseThumbnail: courseKeys.courseThumbnail,
  courseVideo: courseKeys.courseVideo,
  courseDocument: courseKeys.courseDocument,
  courseAudio: courseKeys.courseAudio,
  courseSubtitle: courseKeys.courseSubtitle,
  courseThumbnailsPrefix: courseKeys.courseThumbnailsPrefix,
  courseVideosPrefix: courseKeys.courseVideosPrefix,
  courseDocumentsPrefix: courseKeys.courseDocumentsPrefix,
  courseAudioPrefix: courseKeys.courseAudioPrefix,
  courseSubtitlesPrefix: courseKeys.courseSubtitlesPrefix,

  user: userKeys.user,
  userAvatar: userKeys.userAvatar,
  userProfile: userKeys.userProfile,
  userProfilePrefix: userKeys.userProfilePrefix,

  organization: orgKeys.organization,
  organizationLogo: orgKeys.organizationLogo,
  organizationBanner: orgKeys.organizationBanner,
  organizationBannersPrefix: orgKeys.organizationBannersPrefix,

  export: exportKeys.exportKey,
  exportData: exportKeys.exportData,

  temp: tempKeys.temp,
  tempFile: tempKeys.tempFile,
  tempPrefix: tempKeys.tempPrefix,
}

// ---------------------------------------------------------------------------
// Storage class
// ---------------------------------------------------------------------------

export class Storage {
  private readonly client: S3Client
  private readonly config: StorageConfig
  private readonly circuit: CircuitBreaker

  /** Normalised configuration (after defaults applied). */
  get storageConfig(): StorageConfig {
    return this.config
  }

  /** Raw S3 client — escape hatch for advanced use cases. */
  get s3Client(): S3Client {
    return this.client
  }

  /** Storage key generators. */
  get keys(): typeof storageKeys {
    return storageKeys
  }

  /** Circuit breaker state. */
  get circuitState() {
    return this.circuit.getState()
  }

  constructor(config: StorageConfig, options?: { circuitBreaker?: Partial<CircuitBreakerConfig> }) {
    this.config = validateConfig(config)
    this.client = getOrCreateClient(config)
    this.circuit = new CircuitBreaker(options?.circuitBreaker)
  }

  // -----------------------------------------------------------------------
  // Basic operations
  // -----------------------------------------------------------------------

  /** Upload an object. */
  async put(key: string, body: BodyInput, options?: PutOptions): Promise<PutResult> {
    return this.withCircuit(() =>
      withRetry(() => put(this.client, this.config.bucket, key, body, options), {
        maxAttempts: this.config.retryStrategy?.maxAttempts ?? 3,
        backoff: this.config.retryStrategy?.backoff ?? 'adaptive',
        baseDelay: this.config.retryStrategy?.baseDelay ?? 200,
        maxDelay: this.config.retryStrategy?.maxDelay ?? 10_000,
      }),
    )
  }

  /** Upload multiple objects in batch. */
  async putMany(items: PutManyItem[], options?: PutManyOptions): Promise<PutManyResult> {
    return this.withCircuit(() => putMany(this.client, this.config.bucket, items, options))
  }

  /** Upload multiple objects in parallel. */
  async putManyParallel(items: PutManyItem[], options?: PutManyOptions): Promise<PutManyResult> {
    return this.withCircuit(() => putManyParallel(this.client, this.config.bucket, items, options))
  }

  /** Download an object as a stream. */
  async get(key: string, options?: GetOptions): Promise<GetResult> {
    return this.withCircuit(() =>
      withRetry(() => get(this.client, this.config.bucket, key, options), {
        maxAttempts: this.config.retryStrategy?.maxAttempts ?? 3,
        backoff: this.config.retryStrategy?.backoff ?? 'adaptive',
      }),
    )
  }

  /** Download an object as a buffer. */
  async getAsBuffer(key: string, options?: GetOptions): Promise<Uint8Array> {
    return this.withCircuit(() =>
      withRetry(() => getAsBuffer(this.client, this.config.bucket, key, options), {
        maxAttempts: this.config.retryStrategy?.maxAttempts ?? 3,
        backoff: this.config.retryStrategy?.backoff ?? 'adaptive',
      }),
    )
  }

  /** Download an object as a string. */
  async getAsString(key: string, options?: GetOptions): Promise<string> {
    return this.withCircuit(() =>
      withRetry(() => getAsString(this.client, this.config.bucket, key, options), {
        maxAttempts: this.config.retryStrategy?.maxAttempts ?? 3,
        backoff: this.config.retryStrategy?.backoff ?? 'adaptive',
      }),
    )
  }

  /** Get object metadata. */
  async head(key: string, options?: HeadOptions): Promise<ObjectMetadata> {
    return this.withCircuit(() => head(this.client, this.config.bucket, key, options))
  }

  /** Check if an object exists. */
  async exists(key: string): Promise<ExistsResult> {
    return this.withCircuit(() => exists(this.client, this.config.bucket, key))
  }

  /** Delete a single object. */
  async delete(key: string, options?: DeleteOptions): Promise<DeleteResult> {
    return this.withCircuit(() => deleteObject(this.client, this.config.bucket, key, options))
  }

  /** Delete multiple objects. */
  async deleteMany(keys: string[]): Promise<DeleteManyResult> {
    return this.withCircuit(() => deleteMany(this.client, this.config.bucket, keys))
  }

  /** Copy an object. */
  async copy(
    sourceKey: string,
    destinationKey: string,
    options?: CopyOptions,
  ): Promise<CopyResult> {
    return this.withCircuit(() =>
      copy(this.client, this.config.bucket, sourceKey, destinationKey, options),
    )
  }

  /** Move an object (copy + delete source). */
  async move(
    sourceKey: string,
    destinationKey: string,
    options?: MoveOptions,
  ): Promise<MoveResult> {
    return this.withCircuit(() =>
      move(this.client, this.config.bucket, sourceKey, destinationKey, options),
    )
  }

  /** List objects under a prefix. */
  async list(prefix: string, options?: ListOptions): Promise<ListResult> {
    return this.withCircuit(() => list(this.client, this.config.bucket, prefix, options))
  }

  /** List all objects under a prefix (auto-paginating). */
  async listAll(
    prefix: string,
    options?: Omit<ListOptions, 'continuationToken'>,
  ): Promise<ListedObject[]> {
    return this.withCircuit(() => listAll(this.client, this.config.bucket, prefix, options))
  }

  // -----------------------------------------------------------------------
  // Presigned URL operations
  // -----------------------------------------------------------------------

  /** Generate a presigned upload (PUT) URL. */
  async presignedUpload(
    key: string,
    options?: PresignedUrlOptions & { contentType?: string },
  ): Promise<PresignedUrlResult> {
    return presignedUpload(this.client, this.config.bucket, key, options)
  }

  /** Generate a presigned PUT URL (alias). */
  async presignedPut(
    key: string,
    options?: PresignedUrlOptions & { contentType?: string },
  ): Promise<PresignedUrlResult> {
    return presignedPut(this.client, this.config.bucket, key, options)
  }

  /** Generate a presigned download (GET) URL. */
  async presignedDownload(key: string, options?: PresignedUrlOptions): Promise<PresignedUrlResult> {
    return presignedDownload(this.client, this.config.bucket, key, options)
  }

  /** Generate a presigned GET URL (alias). */
  async presignedGet(key: string, options?: PresignedUrlOptions): Promise<PresignedUrlResult> {
    return presignedGet(this.client, this.config.bucket, key, options)
  }

  /** Generate a presigned DELETE URL. */
  async presignedDelete(key: string, options?: PresignedUrlOptions): Promise<PresignedUrlResult> {
    return presignedDelete(this.client, this.config.bucket, key, options)
  }

  // -----------------------------------------------------------------------
  // Multipart upload operations
  // -----------------------------------------------------------------------

  /** Initiate a multipart upload. */
  async multipartCreate(key: string, options?: PutOptions): Promise<MultipartCreateResult> {
    return multipartCreate(this.client, this.config.bucket, key, options)
  }

  /** Upload a part to a multipart upload. */
  async multipartUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: BodyInput,
    options?: MultipartUploadPartOptions,
  ): Promise<MultipartUploadPartResult> {
    return multipartUploadPart(
      this.client,
      this.config.bucket,
      key,
      uploadId,
      partNumber,
      body,
      options,
    )
  }

  /** Complete a multipart upload. */
  async multipartComplete(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<MultipartCompleteResult> {
    return multipartComplete(this.client, this.config.bucket, key, uploadId, parts)
  }

  /** Abort a multipart upload. */
  async multipartAbort(key: string, uploadId: string): Promise<void> {
    return multipartAbort(this.client, this.config.bucket, key, uploadId)
  }

  /** List uploaded parts. */
  async multipartListParts(key: string, uploadId: string): Promise<MultipartListedPart[]> {
    return multipartListParts(this.client, this.config.bucket, key, uploadId)
  }

  // -----------------------------------------------------------------------
  // Metadata & Tag operations
  // -----------------------------------------------------------------------

  /** Get object metadata (alias for head). */
  async getMetadata(key: string): Promise<ObjectMetadata> {
    return this.head(key)
  }

  /** Update object metadata by copying the object onto itself with new metadata. */
  async updateMetadata(
    key: string,
    metadata: Record<string, string>,
    contentType?: string,
  ): Promise<CopyResult> {
    return this.withCircuit(() =>
      copy(this.client, this.config.bucket, key, key, {
        metadata,
        contentType,
        metadataDirective: 'REPLACE',
      }),
    )
  }

  /** Set tags on an object. */
  async setTags(key: string, tags: TagSet): Promise<void> {
    await this.client.send(
      new PutObjectTaggingCommand({
        Bucket: this.config.bucket,
        Key: key,
        Tagging: {
          TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
        },
      }),
    )
  }

  /** Get tags on an object. */
  async getTags(key: string): Promise<TagSet> {
    const result = await this.client.send(
      new GetObjectTaggingCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    )

    const tags: TagSet = {}
    for (const tag of result.TagSet ?? []) {
      if (tag.Key && tag.Value !== undefined) {
        tags[tag.Key] = tag.Value
      }
    }
    return tags
  }

  // -----------------------------------------------------------------------
  // Health & Diagnostics
  // -----------------------------------------------------------------------

  /** Check bucket health. */
  async health(): Promise<HealthCheckResult> {
    return checkHealth(this.client, this.config.bucket)
  }

  /** Destroy the underlying S3 client. */
  destroy(): void {
    this.client.destroy()
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** Execute a function with circuit breaker protection. */
  private async withCircuit<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.circuit.isAllowed()) {
      throw new Error('Storage circuit breaker is open — requests are blocked')
    }
    try {
      const result = await fn()
      this.circuit.recordSuccess()
      return result
    } catch (error) {
      this.circuit.recordFailure()
      throw error
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a Storage instance — the recommended entry point.
 *
 * @example
 * ```ts
 * import { createStorage } from "@abugida/storage";
 *
 * const storage = createStorage({
 *   provider: "minio",
 *   endpoint: "http://localhost:9000",
 *   region: "us-east-1",
 *   accessKeyId: "minioadmin",
 *   secretAccessKey: "minioadmin",
 *   bucket: "abugida",
 * });
 *
 * await storage.put("test.txt", "Hello, world!");
 * ```
 */
export function createStorage(
  config: StorageConfig,
  options?: { circuitBreaker?: Partial<CircuitBreakerConfig> },
): Storage {
  return new Storage(config, options)
}
