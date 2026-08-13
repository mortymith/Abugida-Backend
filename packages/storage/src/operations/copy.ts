/**
 * Copy operations.
 */

import { CopyObjectCommand, type CopyObjectCommandInput } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { CopyOptions, CopyResult } from '../core/types.ts'

/**
 * Copy an object to a new key within the same bucket.
 */
export async function copy(
  client: S3Client,
  bucket: string,
  sourceKey: string,
  destinationKey: string,
  options?: CopyOptions,
): Promise<CopyResult> {
  const input: CopyObjectCommandInput = {
    Bucket: bucket,
    Key: destinationKey,
    CopySource: `${bucket}/${sourceKey}`,
    ContentType: options?.contentType,
    Metadata: options?.metadata,
    MetadataDirective: options?.metadataDirective,
  }

  const result = await client.send(new CopyObjectCommand(input))

  return {
    key: destinationKey,
    etag: result.CopyObjectResult?.ETag,
    versionId: result.VersionId,
  }
}
