/**
 * Head (metadata) operations.
 */

import { HeadObjectCommand, type HeadObjectCommandInput } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { HeadOptions, ObjectMetadata, ExistsResult } from '../core/types.ts'
import { StorageNotFoundError } from '../utils/errors.ts'

/**
 * Get object metadata without downloading the body.
 */
export async function head(
  client: S3Client,
  bucket: string,
  key: string,
  options?: HeadOptions,
): Promise<ObjectMetadata> {
  try {
    const input: HeadObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      VersionId: options?.versionId,
    }

    const result = await client.send(new HeadObjectCommand(input))

    return {
      key,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag,
      lastModified: result.LastModified,
      versionId: result.VersionId,
      metadata: result.Metadata as Record<string, string> | undefined,
      cacheControl: result.CacheControl,
      contentDisposition: result.ContentDisposition,
      contentEncoding: result.ContentEncoding,
    }
  } catch (error) {
    const name = (error as { name?: string })?.name
    if (name === 'NotFound' || name === 'NoSuchKey') {
      throw new StorageNotFoundError(key, { cause: error })
    }
    throw error
  }
}

/**
 * Check whether an object exists without throwing on 404.
 */
export async function exists(client: S3Client, bucket: string, key: string): Promise<ExistsResult> {
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return {
      exists: true,
      etag: result.ETag,
      contentLength: result.ContentLength,
    }
  } catch {
    return { exists: false }
  }
}
