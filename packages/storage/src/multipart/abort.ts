/**
 * Abort a multipart upload.
 */

import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'

/**
 * Abort an in-progress multipart upload.
 *
 * Any parts that were already uploaded will be cleaned up by S3
 * (eventually). Storage costs for uploaded parts may accrue until
 * the cleanup completes.
 */
export async function multipartAbort(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }),
  )
}
