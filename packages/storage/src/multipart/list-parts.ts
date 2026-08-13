/**
 * List parts of an in-progress multipart upload.
 */

import { ListPartsCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { MultipartListedPart } from './types.ts'

/**
 * List parts that have been uploaded for a multipart upload.
 */
export async function multipartListParts(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
): Promise<MultipartListedPart[]> {
  const allParts: MultipartListedPart[] = []
  let partNumberMarker: string | undefined

  do {
    const result = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      }),
    )

    for (const part of result.Parts ?? []) {
      allParts.push({
        partNumber: part.PartNumber ?? 0,
        etag: part.ETag,
        size: part.Size,
        lastModified: part.LastModified,
      })
    }

    partNumberMarker = result.NextPartNumberMarker
  } while (partNumberMarker)

  return allParts
}
