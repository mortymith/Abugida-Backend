/**
 * Presigned URL types.
 */

/** Options for generating presigned URLs. */
export interface PresignedUrlOptions {
  /** URL expiration time in seconds. Defaults to 3600 (1 hour). */
  expiresIn?: number
  /** Response content type override (for download URLs). */
  responseContentType?: string
  /** Response content disposition override (for download URLs). */
  responseContentDisposition?: string
  /** Response cache control override. */
  responseCacheControl?: string
}

/** Result of a presigned URL generation. */
export interface PresignedUrlResult {
  /** The presigned URL. */
  url: string
  /** Expiration time in seconds. */
  expiresIn: number
  /** When the URL expires. */
  expiresAt: Date
}
