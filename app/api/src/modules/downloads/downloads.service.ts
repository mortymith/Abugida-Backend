/**
 * @module downloads.service
 *
 * Business logic for the downloads feature module.
 */

import type { Storage } from '@abugida/storage'
import type { DownloadsRepository } from './downloads.repository'
import type {
  DownloadStatusView,
  PresignedDownloadUrlView,
  DownloadInitiatedView,
} from './downloads.types'

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_DOWNLOAD_SIZE_BYTES = 524_288_000 // 500 MB
const PRESIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour

// ── Errors ─────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message = 'Resource not found.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class DownloadLimitExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DownloadLimitExceededError'
  }
}

export class StorageUnavailableError extends Error {
  constructor(message = 'Object storage is not configured.') {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface DownloadsService {
  initiateDownload(userPublicId: string, coursePublicId: string): Promise<DownloadInitiatedView>
  getDownloadStatus(userPublicId: string, coursePublicId: string): Promise<DownloadStatusView>
  getPresignedUrl(userPublicId: string, coursePublicId: string): Promise<PresignedDownloadUrlView>
}

export function createDownloadsService(
  repo: DownloadsRepository,
  storage: Storage | undefined,
): DownloadsService {
  return {
    async initiateDownload(userPublicId, coursePublicId) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new NotFoundError('User not found.')

      const courseId = await repo.findCourseIdByPublicId(coursePublicId)
      if (!courseId) throw new NotFoundError('Course not found.')

      const enrolled = await repo.verifyEnrollment(userId, courseId)
      if (!enrolled) throw new ForbiddenError('You are not enrolled in this course.')

      const info = await repo.getCourseDownloadInfo(courseId)
      if (!info) throw new NotFoundError('Course has no downloadable content.')

      const isWithinLimit = info.totalSizeBytes <= MAX_DOWNLOAD_SIZE_BYTES
      if (!isWithinLimit) {
        throw new DownloadLimitExceededError(
          `Course download size (${info.totalSizeBytes} bytes) exceeds the maximum allowed (${MAX_DOWNLOAD_SIZE_BYTES} bytes).`,
        )
      }

      return {
        courseId: coursePublicId,
        status: 'ready',
        totalSizeBytes: info.totalSizeBytes,
        downloadableLessonCount: info.downloadableLessonCount,
      }
    },

    async getDownloadStatus(userPublicId, coursePublicId) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new NotFoundError('User not found.')

      const courseId = await repo.findCourseIdByPublicId(coursePublicId)
      if (!courseId) throw new NotFoundError('Course not found.')

      const enrolled = await repo.verifyEnrollment(userId, courseId)
      if (!enrolled) throw new ForbiddenError('You are not enrolled in this course.')

      const info = await repo.getCourseDownloadInfo(courseId)
      if (!info) throw new NotFoundError('Course has no downloadable content.')

      return {
        courseId: coursePublicId,
        totalSizeBytes: info.totalSizeBytes,
        downloadableLessonCount: info.downloadableLessonCount,
        maxAllowedBytes: 524_288_000,
        isWithinLimit: info.totalSizeBytes <= MAX_DOWNLOAD_SIZE_BYTES,
      }
    },

    async getPresignedUrl(userPublicId, coursePublicId) {
      const userId = await repo.findUserIdByPublicId(userPublicId)
      if (!userId) throw new NotFoundError('User not found.')

      const courseId = await repo.findCourseIdByPublicId(coursePublicId)
      if (!courseId) throw new NotFoundError('Course not found.')

      const enrolled = await repo.verifyEnrollment(userId, courseId)
      if (!enrolled) throw new ForbiddenError('You are not enrolled in this course.')

      if (!storage) throw new StorageUnavailableError()

      const info = await repo.getCourseDownloadInfo(courseId)
      if (!info) throw new NotFoundError('Course has no downloadable content.')

      const isWithinLimit = info.totalSizeBytes <= MAX_DOWNLOAD_SIZE_BYTES
      if (!isWithinLimit) {
        throw new DownloadLimitExceededError(
          `Course download size (${info.totalSizeBytes} bytes) exceeds the maximum allowed (${MAX_DOWNLOAD_SIZE_BYTES} bytes).`,
        )
      }

      // Use the course title as the file name for the download
      const fileName = `${info.courseTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_')}.zip`

      const result = await storage.presignedDownload(fileName, {
        expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
        responseContentDisposition: `attachment; filename="${fileName}"`,
      })

      return {
        url: result.url,
        expiresIn: result.expiresIn,
        expiresAt: result.expiresAt.toISOString(),
        courseId: coursePublicId,
        fileName,
        fileSizeBytes: info.totalSizeBytes,
      }
    },
  }
}
