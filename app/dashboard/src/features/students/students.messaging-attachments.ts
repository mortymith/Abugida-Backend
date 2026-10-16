/**
 * Message attachment validation (spec 06 § S-4.5).
 *
 * The spec: "max 5 files and 10 MB each per message; accepted types
 * `.pdf .png .jpg .mp3 .mp4`; validated client-side on pick and again
 * server-side. A rejected file states the reason and the limit."
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 5
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ACCEPTED_ATTACHMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.mp3', '.mp4'] as const
export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'audio/mpeg',
  'video/mp4',
] as const

export type AttachmentRejectionReason =
  'too_many_files' | 'file_too_large' | 'unsupported_type' | 'empty_file'

export interface AttachmentValidationResult {
  readonly accepted: boolean
  readonly rejections: ReadonlyArray<{
    readonly fileName: string
    readonly reason: AttachmentRejectionReason
    readonly message: string
  }>
}

/**
 * Validate a list of attachment candidates. Returns per-file rejections
 * with specific reasons + the limit stated.
 *
 * The spec rejection messages:
 * - "'Design.zip isn't a supported attachment type. Accepted: PDF, PNG, JPG, MP3, MP4."
 * - "'Recording.m4a is 24 MB — the limit is 10 MB per file."
 */
export function validateAttachments(
  files: ReadonlyArray<{ name: string; size: number; type: string | null }>,
): AttachmentValidationResult {
  const rejections: Array<{
    fileName: string
    reason: AttachmentRejectionReason
    message: string
  }> = []

  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    rejections.push({
      fileName: '',
      reason: 'too_many_files',
      message: `A message can have at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments. You selected ${files.length}.`,
    })
  }

  for (const file of files) {
    if (file.size === 0) {
      rejections.push({
        fileName: file.name,
        reason: 'empty_file',
        message: `'${file.name}' is empty.`,
      })
      continue
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      rejections.push({
        fileName: file.name,
        reason: 'file_too_large',
        message: `'${file.name}' is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)} per file.`,
      })
      continue
    }
    if (!isAcceptedType(file.name, file.type)) {
      rejections.push({
        fileName: file.name,
        reason: 'unsupported_type',
        message: `'${file.name}' isn't a supported attachment type. Accepted: PDF, PNG, JPG, MP3, MP4.`,
      })
    }
  }

  return {
    accepted: rejections.length === 0,
    rejections,
  }
}

/**
 * Whether a file's type is accepted. Checks both the extension and the
 * MIME type (if available).
 */
export function isAcceptedType(fileName: string, mimeType: string | null): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const extAccepted = ACCEPTED_ATTACHMENT_EXTENSIONS.some((accepted) => accepted === `.${ext}`)
  if (extAccepted) return true
  if (mimeType) {
    return (ACCEPTED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)
  }
  return false
}

/**
 * Whether a file's size is within the limit.
 */
export function isAcceptedSize(size: number): boolean {
  return size > 0 && size <= MAX_ATTACHMENT_SIZE_BYTES
}

/**
 * Format bytes for human-readable display in rejection messages.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
