/**
 * Upload a single part in a multipart upload.
 */

import { UploadPartCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { BodyInput } from '../core/types.ts'
import type { MultipartUploadPartResult, MultipartUploadPartOptions } from './types.ts'

/**
 * Upload a part to an active multipart upload.
 *
 * @param client - S3 client.
 * @param bucket - Bucket name.
 * @param key - Object key.
 * @param uploadId - Multipart upload ID from `multipartCreate`.
 * @param partNumber - 1-based part number.
 * @param body - Part body data.
 */
export async function multipartUploadPart(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  body: BodyInput,
  _options?: MultipartUploadPartOptions,
): Promise<MultipartUploadPartResult> {
  const result = await client.send(
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body as unknown as import('@aws-sdk/client-s3').UploadPartCommandInput['Body'],
    }),
  )

  return {
    partNumber,
    etag: result.ETag!,
  }
}
