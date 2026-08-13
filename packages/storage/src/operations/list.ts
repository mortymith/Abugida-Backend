/**
 * List operations.
 */

import { ListObjectsV2Command, type ListObjectsV2CommandInput } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { ListOptions, ListResult, ListedObject } from '../core/types.ts'

/**
 * List objects under a given prefix.
 *
 * Returns a single page of results. Use the `continuationToken` from the
 * result to fetch subsequent pages.
 */
export async function list(
  client: S3Client,
  bucket: string,
  prefix: string,
  options?: ListOptions,
): Promise<ListResult> {
  const input: ListObjectsV2CommandInput = {
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: options?.maxKeys ?? 1000,
    ContinuationToken: options?.continuationToken,
    Delimiter: options?.delimiter,
    StartAfter: options?.startAfter,
  }

  const result = await client.send(new ListObjectsV2Command(input))

  const objects: ListedObject[] = (result.Contents ?? []).map((obj) => ({
    key: obj.Key ?? '',
    size: obj.Size,
    etag: obj.ETag,
    lastModified: obj.LastModified,
  }))

  return {
    objects,
    isTruncated: result.IsTruncated ?? false,
    continuationToken: result.NextContinuationToken,
    commonPrefixes: result.CommonPrefixes?.map((cp) => cp.Prefix ?? ''),
  }
}

/**
 * List **all** objects under a prefix, automatically paginating.
 *
 * ⚠️ Use with caution on buckets with many objects — this may issue
 * multiple requests and consume significant memory for the result set.
 */
export async function listAll(
  client: S3Client,
  bucket: string,
  prefix: string,
  options?: Omit<ListOptions, 'continuationToken'>,
): Promise<ListedObject[]> {
  const allObjects: ListedObject[] = []
  let continuationToken: string | undefined

  do {
    const result = await list(client, bucket, prefix, {
      ...options,
      continuationToken,
    })

    allObjects.push(...result.objects)
    continuationToken = result.continuationToken
  } while (continuationToken)

  return allObjects
}
