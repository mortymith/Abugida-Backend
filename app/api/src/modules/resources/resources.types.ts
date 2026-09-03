/**
 * @module resources.types
 *
 * TypeScript interfaces for the resources feature module.
 */

export interface CourseListView {
  courseId: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  priceAmount: string | null
  priceCurrency: string
  isFree: boolean
  status: string | null
  publishedAt: string | null
  averageRating: string | null
  ratingCount: number
  totalEnrollments: number
}

export interface CourseDetailView {
  courseId: string
  examTypeId: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  priceAmount: string | null
  priceCurrency: string
  isFree: boolean
  status: string | null
  publishedAt: string | null
  version: number
  averageRating: string | null
  ratingCount: number
  totalEnrollments: number
  rowVersion: number
}

export interface CourseCurriculumView {
  courseId: string
  title: string
  modules: CurriculumModuleView[]
}

export interface CurriculumModuleView {
  moduleId: string
  title: string
  description: string | null
  sortOrder: number
  estimatedDurationMinutes: number | null
  lessons: CurriculumLessonView[]
}

export interface CurriculumLessonView {
  lessonId: string
  title: string
  contentType: string | null
  durationSeconds: number | null
  isDownloadable: boolean
}

export interface ModuleSummaryView {
  moduleId: string
  title: string
  description: string | null
  sortOrder: number
  estimatedDurationMinutes: number | null
  isPreviewAvailable: boolean
  lessonCount: number
}

export interface LessonSummaryView {
  lessonId: string
  title: string
  description: string | null
  contentType: string | null
  durationSeconds: number | null
  pageCount: number | null
  isDownloadable: boolean
}

export interface ResourceDetailView {
  lessonId: string
  moduleId: string
  courseId: string
  title: string
  description: string | null
  contentType: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  durationSeconds: number | null
  pageCount: number | null
  isDownloadable: boolean
  rowVersion: number
}

export interface CourseListQuery {
  cursor: string | undefined
  limit: number | undefined
  sort: string | undefined
}

export interface LessonListQuery {
  cursor: string | undefined
  limit: number | undefined
}
