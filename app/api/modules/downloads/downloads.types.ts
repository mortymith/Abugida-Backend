/**
 * @module downloads.types
 *
 * TypeScript interfaces for the downloads feature module.
 */

export interface DownloadStatusView {
  courseId: string
  totalSizeBytes: number
  downloadableLessonCount: number
  maxAllowedBytes: 524288000
  isWithinLimit: boolean
}

export interface PresignedDownloadUrlView {
  url: string
  expiresIn: number
  expiresAt: string
  courseId: string
  fileName: string
  fileSizeBytes: number
}

export interface DownloadInitiatedView {
  courseId: string
  status: 'ready' | 'preparing'
  totalSizeBytes: number
  downloadableLessonCount: number
}

export interface CourseDownloadInfo {
  courseId: number
  courseTitle: string
  totalSizeBytes: number
  downloadableLessonCount: number
  lessons: Array<{
    lessonId: number
    publicId: string
    title: string
    fileObjectKey: string | null
    fileSizeBytes: number | null
    mimeType: string | null
  }>
}
