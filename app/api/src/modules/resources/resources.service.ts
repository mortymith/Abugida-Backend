/**
 * @module resources.service
 *
 * Business logic for the resources feature module.
 */

import type { ResourcesRepository, CourseWithStats } from './resources.repository'
import { encodeCursor } from './resources.repository'
import type {
  CourseListView,
  CourseDetailView,
  CourseCurriculumView,
  ModuleSummaryView,
  LessonSummaryView,
  ResourceDetailView,
  CourseListQuery,
  LessonListQuery,
} from './resources.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message = 'Resource not found.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toCourseListView(row: CourseWithStats): CourseListView {
  return {
    courseId: row.publicId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbnailUrl: row.thumbnailObjectKey,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    isFree: row.isFree,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    averageRating: row.averageRating,
    ratingCount: row.ratingCount,
    totalEnrollments: row.totalEnrollments,
  }
}

function toCourseDetailView(row: CourseWithStats): CourseDetailView {
  return {
    courseId: row.publicId,
    examTypeId: String(row.examTypeId),
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbnailUrl: row.thumbnailObjectKey,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    isFree: row.isFree,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    version: row.version,
    averageRating: row.averageRating,
    ratingCount: row.ratingCount,
    totalEnrollments: row.totalEnrollments,
    rowVersion: row.rowVersion,
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface ResourcesService {
  listCoursesByExamType(
    examTypeId: string,
    query: CourseListQuery,
  ): Promise<{
    data: CourseListView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getCourse(courseId: string): Promise<CourseDetailView>
  getCourseCurriculum(courseId: string): Promise<CourseCurriculumView>
  listModules(courseId: string): Promise<{ data: ModuleSummaryView[] }>
  listModuleLessons(
    moduleId: string,
    query: LessonListQuery,
  ): Promise<{
    data: LessonSummaryView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getResource(resourceId: string): Promise<ResourceDetailView>
}

export function createResourcesService(repo: ResourcesRepository): ResourcesService {
  return {
    async listCoursesByExamType(examTypeId, query) {
      const internalExamTypeId = await repo.findExamTypeIdByPublicId(examTypeId)
      if (!internalExamTypeId) throw new NotFoundError('Exam type not found.')

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findCoursesByExamType(internalExamTypeId, {
        cursor: query.cursor,
        limit,
        sort: query.sort,
      })

      const data = rows.map(toCourseListView)
      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getCourse(courseId) {
      const row = await repo.findCourseByPublicId(courseId)
      if (!row) throw new NotFoundError('Course not found.')
      return toCourseDetailView(row)
    },

    async getCourseCurriculum(courseId) {
      const course = await repo.findCourseByPublicId(courseId)
      if (!course) throw new NotFoundError('Course not found.')

      const modules = await repo.findModulesByCourse(course.id)

      return {
        courseId: course.publicId,
        title: course.title,
        modules: modules.map((mod) => ({
          moduleId: mod.publicId,
          title: mod.title,
          description: mod.description,
          sortOrder: mod.sortOrder,
          estimatedDurationMinutes: mod.estimatedDurationMinutes,
          lessons: [],
        })),
      }
    },

    async listModules(courseId) {
      const course = await repo.findCourseByPublicId(courseId)
      if (!course) throw new NotFoundError('Course not found.')

      const modules = await repo.findModulesByCourse(course.id)

      return {
        data: modules.map((mod) => ({
          moduleId: mod.publicId,
          title: mod.title,
          description: mod.description,
          sortOrder: mod.sortOrder,
          estimatedDurationMinutes: mod.estimatedDurationMinutes,
          isPreviewAvailable: mod.isPreviewAvailable,
          lessonCount: mod.lessonCount,
        })),
      }
    },

    async listModuleLessons(moduleId, query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findLessonsByModule(Number.parseInt(moduleId, 10) || 0, {
        cursor: query.cursor,
        limit,
      })

      const data = rows.map((row) => ({
        lessonId: row.publicId,
        title: row.title,
        description: row.description,
        contentType: row.contentType,
        durationSeconds: row.durationSeconds,
        pageCount: row.pageCount,
        isDownloadable: row.isDownloadable,
      }))

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getResource(resourceId) {
      const row = await repo.findLessonByPublicId(resourceId)
      if (!row) throw new NotFoundError('Resource not found.')

      return {
        lessonId: row.publicId,
        moduleId: String(row.moduleId),
        courseId: String(row.courseId),
        title: row.title,
        description: row.description,
        contentType: row.contentType,
        fileSizeBytes: row.fileSizeBytes,
        mimeType: row.mimeType,
        durationSeconds: row.durationSeconds,
        pageCount: row.pageCount,
        isDownloadable: row.isDownloadable,
        rowVersion: row.rowVersion,
      }
    },
  }
}
