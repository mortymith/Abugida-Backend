/**
 * Move operations (copy + delete).
 */

import type { S3Client } from '@aws-sdk/client-s3'
import type { MoveOptions, MoveResult } from '../core/types.ts'
import { copy } from './copy.ts'
import { deleteObject } from './delete.ts'

/**
 * Move an object to a new key (copy then delete source).
 *
 * The operation is **not atomic** — if the delete fails after a successful
 * copy, both the source and destination will exist. The caller should
 * handle this scenario if strong consistency is required.
 */
export async function move(
  client: S3Client,
  bucket: string,
  sourceKey: string,
  destinationKey: string,
  options?: MoveOptions,
): Promise<MoveResult> {
  const copyResult = await copy(client, bucket, sourceKey, destinationKey, options)

  await deleteObject(client, bucket, sourceKey)

  return {
    key: destinationKey,
    etag: copyResult.etag,
  }
}
