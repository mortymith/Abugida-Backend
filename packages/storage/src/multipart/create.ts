/**
 * Initiate a multipart upload.
 */

import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { PutOptions } from '../core/types.ts'
import type { MultipartCreateResult } from './types.ts'

/**
 * Start a multipart upload session.
 *
 * Returns an `uploadId` that must be passed to subsequent part uploads
 * and the complete/abort operations.
 */
export async function multipartCreate(
  client: S3Client,
  bucket: string,
  key: string,
  options?: PutOptions,
): Promise<MultipartCreateResult> {
  const input = {
    Bucket: bucket,
    Key: key,
    ContentType: options?.contentType,
    Metadata: options?.metadata,
    CacheControl: options?.cacheControl,
    ContentDisposition: options?.contentDisposition,
    ContentEncoding: options?.contentEncoding,
  }

  const result = await client.send(new CreateMultipartUploadCommand(input))

  return {
    key,
    uploadId: result.UploadId!,
  }
}
