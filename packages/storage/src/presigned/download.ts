/**
 * Presigned download URL generation.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3Client } from '@aws-sdk/client-s3'
import type { PresignedUrlOptions, PresignedUrlResult } from './types.ts'

const DEFAULT_EXPIRY = 3600

/**
 * Generate a presigned URL for downloading an object.
 *
 * The client can GET this URL directly without further authentication.
 * Response headers can be overridden via options.
 */
export async function presignedDownload(
  client: S3Client,
  bucket: string,
  key: string,
  options?: PresignedUrlOptions,
): Promise<PresignedUrlResult> {
  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRY

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: options?.responseContentType,
    ResponseContentDisposition: options?.responseContentDisposition,
    ResponseCacheControl: options?.responseCacheControl,
  })

  const url = await getSignedUrl(client, command, { expiresIn })

  return {
    url,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

/**
 * Alias: presigned GET URL.
 */
export const presignedGet = presignedDownload
