/**
 * Put (upload) operations.
 */

import { PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type {
  PutOptions,
  PutResult,
  BodyInput,
  PutManyItem,
  PutManyOptions,
  PutManyResult,
} from '../core/types.ts'
import { StorageUploadError } from '../utils/errors.ts'

/**
 * Upload an object to storage.
 */
export async function put(
  client: S3Client,
  bucket: string,
  key: string,
  body: BodyInput,
  options?: PutOptions,
): Promise<PutResult> {
  try {
    // Convert body to a format S3 accepts
    let s3Body: PutObjectCommandInput['Body']
    if (body instanceof ReadableStream) {
      s3Body = body as unknown as PutObjectCommandInput['Body']
    } else if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      s3Body = body as PutObjectCommandInput['Body']
    } else if (typeof body === 'string') {
      s3Body = body
    } else if (body instanceof Blob) {
      s3Body = body as unknown as PutObjectCommandInput['Body']
    } else {
      s3Body = body as PutObjectCommandInput['Body']
    }

    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: s3Body,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      CacheControl: options?.cacheControl,
      ContentDisposition: options?.contentDisposition,
      ContentEncoding: options?.contentEncoding,
    }

    // Server-side encryption
    if (options?.encryption) {
      input.ServerSideEncryption = options.encryption
      if (options.encryptionKeyId) {
        input.SSEKMSKeyId = options.encryptionKeyId
      }
    }

    // Checksum
    if (options?.checksum) {
      input.ChecksumSHA256 = options.checksum
    }

    const result = await client.send(new PutObjectCommand(input))

    return {
      key,
      etag: result.ETag,
      versionId: result.VersionId,
      checksum: result.ChecksumSHA256,
    }
  } catch (error) {
    throw new StorageUploadError(`Failed to upload object to key: ${key}`, { cause: error, key })
  }
}

/**
 * Upload multiple objects in batch.
 */
export async function putMany(
  client: S3Client,
  bucket: string,
  items: PutManyItem[],
  options?: PutManyOptions,
): Promise<PutManyResult> {
  const concurrency = options?.concurrency ?? 5
  const results: PutResult[] = []
  const failures: Array<{ key: string; error: Error }> = []

  // Process in batches with limited concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((item) => put(client, bucket, item.key, item.body, item.options)),
    )

    for (let j = 0; j < batchResults.length; j++) {
      const batchResult = batchResults[j]!
      const item = batch[j]!

      if (batchResult.status === 'fulfilled') {
        results.push(batchResult.value)
      } else {
        failures.push({
          key: item.key,
          error: batchResult.reason as Error,
        })
      }

      options?.onProgress?.(results.length + failures.length, items.length)
    }
  }

  return {
    results,
    failures: failures.length > 0 ? failures : undefined,
  }
}

/**
 * Upload multiple objects in parallel with concurrency control and progress tracking.
 */
export async function putManyParallel(
  client: S3Client,
  bucket: string,
  items: PutManyItem[],
  options?: PutManyOptions & { onProgress?: (completed: number, total: number) => void },
): Promise<PutManyResult> {
  return putMany(client, bucket, items, options)
}
