/**
 * Presigned upload URL generation.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3Client } from '@aws-sdk/client-s3'
import type { PresignedUrlOptions, PresignedUrlResult } from './types.ts'

const DEFAULT_EXPIRY = 3600

/**
 * Generate a presigned URL for uploading an object.
 *
 * The client can PUT directly to this URL without further authentication.
 */
export async function presignedUpload(
  client: S3Client,
  bucket: string,
  key: string,
  options?: PresignedUrlOptions & { contentType?: string },
): Promise<PresignedUrlResult> {
  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRY

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: options?.contentType,
  })

  const url = await getSignedUrl(client, command, { expiresIn })

  return {
    url,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

/**
 * Alias: presigned PUT URL.
 */
export const presignedPut = presignedUpload
