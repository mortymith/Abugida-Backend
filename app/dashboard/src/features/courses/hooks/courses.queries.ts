import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  getCourseCatalog,
  getCourseDetails,
  getCourseFormReference,
  getCoursePricing,
  getCurriculum,
  getLiveSessions,
  getCompletionSettings,
  getPendingReviewCount,
  getPublishReadiness,
  getQuizForLesson,
  getReviewLessonPreview,
  getReviewQueue,
  getUnlockRules,
  getCourseStudents,
  getCourseAnalytics,
  getCourseTemplates,
} from '#/features/courses/server/all'
import type {
  PendingReviewCounts,
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
import type { ReadinessResult } from '../courses.readiness'
import type { CatalogQuery } from '../schemas/courses.catalog.schema'
import { nextCatalogPage } from '../courses.catalog-pagination'
import type { ReviewQueueQuery, TemplateQuery } from '../schemas/courses.workflow.schema'

export const courseQueryKeys = {
  catalog: (query: CatalogQuery) => ['courses', 'catalog', query] as const,
  reference: () => ['courses', 'reference'] as const,
  details: (coursePublicId: string) => ['courses', 'details', coursePublicId] as const,
  /** Prefix covering every cached details query, for lifecycle invalidation. */
  detailsAll: () => ['courses', 'details'] as const,
  readiness: (coursePublicId: string) => ['courses', 'readiness', coursePublicId] as const,
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
  /** The Students nav badge count. Distinct from `students` — see below. */
  studentCount: (coursePublicId: string) => ['courses', 'student-count', coursePublicId] as const,
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

/**
 * Paginated catalog for the S-2.1 grid.
 *
 * The key deliberately omits `page` so that "Load more" accumulates pages under
 * one cache entry, while changing any filter (status/type/sort/search) produces
 * a *new* key and therefore restarts from the first page. Previously `page` was
 * hard-coded to 0, so sorting only ever applied to the first page and
 * "Load more" prefetched a page it could never render.
 */
export function catalogInfiniteQueryOptions(query: Omit<CatalogQuery, 'page'>) {
  return infiniteQueryOptions({
    // Built inline from the page-less filters so `page` never enters the key.
    queryKey: ['courses', 'catalog', query, 'infinite'] as const,
    queryFn: ({ pageParam }): Promise<CourseCatalogResult> =>
      getCourseCatalog({ data: { ...query, page: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      nextCatalogPage(lastPage.page, lastPage.items.length, lastPage.totalCount),
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

/**
 * S-2.22 publish readiness (`RC-1…RC-8`).
 *
 * The verdict is re-evaluated on the server on every fetch — the spec
 * forbids trusting a cached checklist, because publishing re-validates
 * at the moment of publish anyway.
 */
export function publishReadinessQueryOptions(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.readiness(coursePublicId),
    queryFn: (): Promise<ReadinessResult> => getPublishReadiness({ data: { coursePublicId } }),
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

/**
 * S-A.1 Courses badge.
 *
 * Deterministic rules: no badge at zero (the item stays), `99+` above the cap,
 * **archived submissions excluded** (a decision already taken), and a refresh
 * **on focus** rather than on a fixed interval — a 15-minute timer never runs in
 * a background tab, and work decided in another tab drops out on the next
 * poll.
 */
export function pendingReviewCountQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: courseQueryKeys.pendingReviews(),
    queryFn: async (): Promise<PendingReviewCounts> => await getPendingReviewCount(),
    staleTime: STALE.badge,
    enabled,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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

/**
 * The Students nav count (S-2.6 wireframe: `○ Students (234)`).
 *
 * Its own cache entry rather than a projection of `courseStudentsQueryOptions`:
 * two different result shapes under one key would leave the badge typed as a
 * number while the tab's fetch had parked a `CourseStudentsResult` there. The
 * server already answers `totalCount`, so a separate key costs one extra entry
 * and keeps both call sites honest.
 *
 * `staleTime` matches the list, so the tab and the badge refresh together
 * rather than the badge lagging a page behind the roster it counts.
 */
export function courseStudentsQueryOptionsFn(coursePublicId: string) {
  return queryOptions({
    queryKey: courseQueryKeys.studentCount(coursePublicId),
    queryFn: async (): Promise<number> => {
      const { getCourseStudents: fetchCourseStudents } =
        await import('#/features/courses/server/all')
      const result = await fetchCourseStudents({ data: { coursePublicId, page: 0 } })
      return result.totalCount
    },
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
