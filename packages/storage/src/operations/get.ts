/**
 * Get (download) operations.
 */

import { GetObjectCommand, type GetObjectCommandInput } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { GetOptions, GetResult, ObjectMetadata } from '../core/types.ts'
import { StorageDownloadError, StorageNotFoundError } from '../utils/errors.ts'

/**
 * Download an object from storage.
 *
 * Returns a streaming body plus metadata. The caller is responsible for
 * consuming or cancelling the stream.
 */
export async function get(
  client: S3Client,
  bucket: string,
  key: string,
  options?: GetOptions,
): Promise<GetResult> {
  try {
    const input: GetObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Range: options?.range,
      VersionId: options?.versionId,
    }

    const result = await client.send(new GetObjectCommand(input))

    if (!result.Body) {
      throw new StorageNotFoundError(key)
    }

    const metadata: ObjectMetadata = {
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

    return {
      body: result.Body as unknown as ReadableStream<Uint8Array>,
      metadata,
    }
  } catch (error) {
    if ((error as { name?: string })?.name === 'NoSuchKey') {
      throw new StorageNotFoundError(key, { cause: error })
    }
    throw new StorageDownloadError(`Failed to download object: ${key}`, { cause: error, key })
  }
}

/**
 * Download an object as a Uint8Array.
 * Convenience method — avoids manual stream consumption.
 */
export async function getAsBuffer(
  client: S3Client,
  bucket: string,
  key: string,
  options?: GetOptions,
): Promise<Uint8Array> {
  const { body } = await get(client, bucket, key, options)
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.byteLength
  }

  const buffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }

  return buffer
}

/**
 * Download an object as a string (UTF-8).
 */
export async function getAsString(
  client: S3Client,
  bucket: string,
  key: string,
  options?: GetOptions,
): Promise<string> {
  const buffer = await getAsBuffer(client, bucket, key, options)
  return new TextDecoder().decode(buffer)
}
