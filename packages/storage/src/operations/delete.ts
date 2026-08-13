/**
 * Delete operations.
 */

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  type DeleteObjectCommandInput,
  type DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { DeleteOptions, DeleteResult, DeleteManyResult } from '../core/types.ts'
import { StorageError } from '../utils/errors.ts'

/**
 * Delete a single object from storage.
 */
export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string,
  options?: DeleteOptions,
): Promise<DeleteResult> {
  const input: DeleteObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    VersionId: options?.versionId,
  }

  await client.send(new DeleteObjectCommand(input))

  return {
    key,
    versionId: options?.versionId,
  }
}

/**
 * Delete multiple objects in a single batch request.
 *
 * S3 supports up to 1,000 keys per delete request. This function
 * automatically paginates when the input exceeds that limit.
 */
export async function deleteMany(
  client: S3Client,
  bucket: string,
  keys: string[],
): Promise<DeleteManyResult> {
  const BATCH_SIZE = 1000
  const deleted: string[] = []
  const errors: Array<{ key: string; error: Error }> = []

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)

    const input: DeleteObjectsCommandInput = {
      Bucket: bucket,
      Delete: {
        Objects: batch.map((key) => ({ Key: key })),
        Quiet: false,
      },
    }

    try {
      const result = await client.send(new DeleteObjectsCommand(input))

      for (const d of result.Deleted ?? []) {
        if (d.Key) deleted.push(d.Key)
      }

      for (const e of result.Errors ?? []) {
        if (e.Key) {
          errors.push({
            key: e.Key,
            error: new StorageError(`Delete failed: ${e.Message ?? 'Unknown error'}`, {
              key: e.Key,
            }),
          })
        }
      }
    } catch (error) {
      // Entire batch failed
      for (const key of batch) {
        errors.push({
          key,
          error: new StorageError(`Delete batch failed`, { cause: error, key }),
        })
      }
    }
  }

  return {
    deleted,
    errors: errors.length > 0 ? errors : undefined,
  }
}
