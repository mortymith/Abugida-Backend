/**
 * Presigned delete URL generation.
 */

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3Client } from '@aws-sdk/client-s3'
import type { PresignedUrlOptions, PresignedUrlResult } from './types.ts'

const DEFAULT_EXPIRY = 3600

/**
 * Generate a presigned URL for deleting an object.
 *
 * The client can DELETE this URL directly without further authentication.
 */
export async function presignedDelete(
  client: S3Client,
  bucket: string,
  key: string,
  options?: PresignedUrlOptions,
): Promise<PresignedUrlResult> {
  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRY

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const url = await getSignedUrl(client, command, { expiresIn })

  return {
    url,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}
