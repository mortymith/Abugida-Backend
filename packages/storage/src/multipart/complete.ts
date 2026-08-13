/**
 * Complete a multipart upload.
 */

import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { MultipartCompleteResult, CompletedPart } from './types.ts'

/**
 * Finalize a multipart upload by assembling all uploaded parts.
 *
 * @param client - S3 client.
 * @param bucket - Bucket name.
 * @param key - Object key.
 * @param uploadId - Upload ID from `multipartCreate`.
 * @param parts - Array of completed parts (part number + ETag).
 */
export async function multipartComplete(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<MultipartCompleteResult> {
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber)

  const result = await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    }),
  )

  return {
    key,
    etag: result.ETag,
    versionId: result.VersionId,
  }
}
