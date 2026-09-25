import { queryOptions } from '@tanstack/react-query'
import {
  getCourseCatalog,
  getCourseDetails,
  getCourseFormReference,
  getCoursePricing,
  getCurriculum,
  getLiveSessions,
  getCompletionSettings,
  getPendingReviewCount,
  getQuizForLesson,
  getReviewLessonPreview,
  getReviewQueue,
  getUnlockRules,
  getCourseStudents,
  getCourseAnalytics,
  getCourseTemplates,
} from '#/features/courses/server/all'
import type {
  CourseFormReference,
  CourseAnalyticsDTO,
  CourseCatalogResult,
  CourseDetailsDTO,
  CoursePricingDTO,
  CourseStudentsResult,
  CourseTemplateDTO,
  CurriculumDTO,
  LiveSessionDTO,
  QuizDTO,
  ReviewLessonPreview,
  ReviewQueueItem,
  UnlockRulesDTO,
  CompletionSettingsDTO,
} from '../courses.types'
import type { CatalogQuery } from '../schemas/courses.catalog.schema'
import type { ReviewQueueQuery, TemplateQuery } from '../schemas/courses.workflow.schema'

export const courseQueryKeys = {
  catalog: (query: CatalogQuery) => ['courses', 'catalog', query] as const,
  reference: () => ['courses', 'reference'] as const,
  details: (coursePublicId: string) => ['courses', 'details', coursePublicId] as const,
  curriculum: (coursePublicId: string) => ['courses', 'curriculum', coursePublicId] as const,
  pricing: (coursePublicId: string) => ['courses', 'pricing', coursePublicId] as const,
  quiz: (lessonPublicId: string) => ['courses', 'quiz', lessonPublicId] as const,
  unlockRules: (lessonPublicId: string) => ['courses', 'unlock-rules', lessonPublicId] as const,
  reviews: (query: ReviewQueueQuery) => ['courses', 'reviews', query] as const,
  reviewPreview: (lessonPublicId: string) => ['courses', 'review-preview', lessonPublicId] as const,
  pendingReviews: () => ['courses', 'pending-reviews'] as const,
  templates: (query: TemplateQuery) => ['courses', 'templates', query] as const,
  students: (coursePublicId: string, search: string, page: number) =>
    ['courses', 'students', coursePublicId, search, page] as const,
  analytics: (coursePublicId: string) => ['courses', 'analytics', coursePublicId] as const,
  liveSessions: (coursePublicId: string) => ['courses', 'live-sessions', coursePublicId] as const,
  completion: (coursePublicId: string) => ['courses', 'completion', coursePublicId] as const,
}

const STALE = { list: 15_000, detail: 30_000, reference: 300_000, badge: 30_000 }

export function catalogQueryOptions(query: CatalogQuery) {
  return queryOptions({
    queryKey: courseQueryKeys.catalog(query),
    queryFn: (): Promise<CourseCatalogResult> => getCourseCatalog({ data: query }),
    staleTime: STALE.list,
  })
}

export function courseReferenceQueryOptions() {
  return queryOptions({
    queryKey: courseQueryKeys.reference(),
    queryFn: async (): Promise<CourseFormReference> => await getCourseFormReference(),
    staleTime: STALE.reference,
  })
}

export function courseDetailsQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.details(coursePublicId),
    queryFn: (): Promise<CourseDetailsDTO> => getCourseDetails({ data: { coursePublicId } }),
    staleTime: STALE.detail,
  })
}

export function curriculumQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.curriculum(coursePublicId),
    queryFn: (): Promise<CurriculumDTO> => getCurriculum({ data: { coursePublicId } }),
    staleTime: STALE.detail,
  })
}

export function coursePricingQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.pricing(coursePublicId),
    queryFn: (): Promise<CoursePricingDTO> => getCoursePricing({ data: { coursePublicId } }),
    staleTime: STALE.detail,
  })
}

export function quizQueryOptions(lessonPublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.quiz(lessonPublicId),
    queryFn: (): Promise<QuizDTO> => getQuizForLesson({ data: { lessonPublicId } }),
    staleTime: STALE.detail,
  })
}

export function unlockRulesQueryOptions(lessonPublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.unlockRules(lessonPublicId),
    queryFn: (): Promise<UnlockRulesDTO> => getUnlockRules({ data: { lessonPublicId } }),
    staleTime: 0,
  })
}

export function reviewQueueQueryOptionsFn(query: ReviewQueueQuery) {
  return queryOptions({
    queryKey: courseQueryKeys.reviews(query),
    queryFn: (): Promise<ReviewQueueItem[]> => getReviewQueue({ data: query }),
    staleTime: STALE.list,
  })
}

export function reviewPreviewQueryOptions(lessonPublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.reviewPreview(lessonPublicId),
    queryFn: (): Promise<ReviewLessonPreview> =>
      getReviewLessonPreview({ data: { lessonPublicId } }),
    staleTime: STALE.detail,
  })
}

export function pendingReviewCountQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: courseQueryKeys.pendingReviews(),
    queryFn: async (): Promise<number> => await getPendingReviewCount(),
    staleTime: STALE.badge,
    enabled,
    refetchInterval: 60_000,
  })
}

export function templatesQueryOptions(query: TemplateQuery) {
  return queryOptions({
    queryKey: courseQueryKeys.templates(query),
    queryFn: (): Promise<CourseTemplateDTO[]> => getCourseTemplates({ data: query }),
    staleTime: STALE.list,
  })
}

export function courseStudentsQueryOptions(coursePublicId: string, search: string, page: number) {
  return queryOptions({
    queryKey: courseQueryKeys.students(coursePublicId, search, page),
    queryFn: (): Promise<CourseStudentsResult> =>
      getCourseStudents({ data: { coursePublicId, search: search || undefined, page } }),
    staleTime: STALE.list,
  })
}

export function courseAnalyticsQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.analytics(coursePublicId),
    queryFn: (): Promise<CourseAnalyticsDTO> => getCourseAnalytics({ data: { coursePublicId } }),
    staleTime: STALE.list,
  })
}

export function liveSessionsQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.liveSessions(coursePublicId),
    queryFn: (): Promise<{ upcoming: LiveSessionDTO[]; history: LiveSessionDTO[] }> =>
      getLiveSessions({ data: { coursePublicId } }),
    staleTime: STALE.detail,
  })
}

export function completionSettingsQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.completion(coursePublicId),
    queryFn: (): Promise<CompletionSettingsDTO> =>
      getCompletionSettings({ data: { coursePublicId } }),
    staleTime: STALE.detail,
  })
}
