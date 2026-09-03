/**
 * @module downloads.repository
 *
 * Database operations for the downloads feature module.
 */

import { eq, and, isNull } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { courses, lessons } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { fileMetadata } from '@abugida/database/shared'
import type { CourseDownloadInfo } from './downloads.types'

// ── Repository interface ───────────────────────────────────────────────────

export interface DownloadsRepository {
  findUserIdByPublicId(publicId: string): Promise<string | undefined>
  findCourseIdByPublicId(coursePublicId: string): Promise<number | undefined>
  verifyEnrollment(userId: string, courseId: number): Promise<boolean>
  getCourseDownloadInfo(courseId: number): Promise<CourseDownloadInfo | undefined>
  getFileMetadataByLessonId(
    lessonId: number,
  ): Promise<{ objectKey: string; bucketName: string } | undefined>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createDownloadsRepository(db: DatabaseClient): DownloadsRepository {
  return {
    async findUserIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, publicId))
        .limit(1)
      return row?.id
    },

    async findCourseIdByPublicId(coursePublicId) {
      const [row] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.publicId, coursePublicId))
        .limit(1)
      return row?.id
    },

    async verifyEnrollment(userId, courseId) {
      const [row] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, userId),
            eq(enrollments.courseId, courseId),
            isNull(enrollments.deletedAt),
          ),
        )
        .limit(1)
      return !!row
    },

    async getCourseDownloadInfo(courseId) {
      const [course] = await db
        .select({ id: courses.id, title: courses.title })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1)

      if (!course) return undefined

      const downloadableLessons = await db
        .select({
          id: lessons.id,
          publicId: lessons.publicId,
          title: lessons.title,
          fileObjectKey: lessons.fileObjectKey,
          fileSizeBytes: lessons.fileSizeBytes,
          mimeType: lessons.mimeType,
          isDownloadable: lessons.isDownloadable,
        })
        .from(lessons)
        .where(
          and(
            eq(lessons.courseId, courseId),
            eq(lessons.isDownloadable, true),
            isNull(lessons.deletedAt),
          ),
        )

      const totalSizeBytes = downloadableLessons.reduce(
        (sum, lesson) => sum + (lesson.fileSizeBytes ?? 0),
        0,
      )

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalSizeBytes,
        downloadableLessonCount: downloadableLessons.length,
        lessons: downloadableLessons.map((l) => ({
          lessonId: l.id,
          publicId: l.publicId,
          title: l.title,
          fileObjectKey: l.fileObjectKey,
          fileSizeBytes: l.fileSizeBytes,
          mimeType: l.mimeType,
        })),
      }
    },

    async getFileMetadataByLessonId(lessonId) {
      const [row] = await db
        .select({ objectKey: fileMetadata.objectKey, bucketName: fileMetadata.bucketName })
        .from(fileMetadata)
        .where(eq(fileMetadata.lessonId, lessonId))
        .limit(1)
      return row ?? undefined
    },
  }
}
