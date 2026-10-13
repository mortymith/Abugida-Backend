/**
 * Course workspace data hooks (spec 04). One place for the queries the shell and
 * its tabs share, so the identity header, the nav counts, the readiness banner
 * and the catalog card cannot each build their own view of the same course.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courseQueryKeys, publishReadinessQueryOptions } from './courses.queries'
import type { ReadinessResult } from '../courses.readiness'

/** `RC-1…RC-8` as the workspace needs it: the checklist and the banner counts. */
export function usePublishReadiness(coursePublicId: string) {
  return useQuery({
    ...publishReadinessQueryOptions(coursePublicId),
    // A stale readiness verdict is worse than a fresh fetch: the spec requires
    // readiness to be re-evaluated rather than trusted from a cache.
    staleTime: 10_000,
  })
}

/** The one number the banner, the health card and the RC-4a row all quote. */
export function readinessItemsNeedingContent(result: ReadinessResult | undefined): number {
  return result?.itemsNeedingContent ?? 0
}

/**
 * Every lifecycle mutation. Each invalidates the whole course surface — the
 * readiness verdict changes on every transition, and a stale checklist left
 * behind by a publish is exactly the "UI shows a version that no longer exists"
 * failure the spec warns about.
 */
export function useCourseLifecycleMutations(coursePublicId: string) {
  const queryClient = useQueryClient()

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: courseQueryKeys.details(coursePublicId) })
    void queryClient.invalidateQueries({ queryKey: courseQueryKeys.detailsAll() })
    void queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
    void queryClient.invalidateQueries({ queryKey: ['courses', 'readiness', coursePublicId] })
  }

  return {
    submit: useMutation({
      mutationFn: async (submissionNote: string | null) => {
        const { submitCourseForReview } = await import('../server/all')
        return submitCourseForReview({ data: { coursePublicId, submissionNote } })
      },
      onSuccess: refresh,
    }),
    withdraw: useMutation({
      mutationFn: async () => {
        const { withdrawCourseReview } = await import('../server/all')
        return withdrawCourseReview({ data: { coursePublicId } })
      },
      onSuccess: refresh,
    }),
    decide: useMutation({
      mutationFn: async (variables: {
        decision: 'approve' | 'request_changes' | 'reject'
        comment: string
      }) => {
        if (variables.decision === 'approve') {
          const { approveCourseReview } = await import('../server/all')
          return approveCourseReview({ data: { coursePublicId, ...variables } })
        }
        const { decideCourseReview } = await import('../server/all')
        return decideCourseReview({ data: { coursePublicId, ...variables } })
      },
      onSuccess: refresh,
    }),
    publish: useMutation({
      mutationFn: async () => {
        const { publishCourse } = await import('../server/all')
        return publishCourse({
          data: {
            coursePublicId,
            visibility: 'published',
            releaseMode: 'immediate',
            scheduledFor: null,
            notifyStudents: true,
            notifySubscribers: true,
            confirmed: true,
          },
        })
      },
      onSuccess: refresh,
    }),
    unpublish: useMutation({
      mutationFn: async () => {
        const { unpublishCourse } = await import('../server/all')
        return unpublishCourse({ data: { coursePublicId } })
      },
      onSuccess: refresh,
    }),
    restore: useMutation({
      mutationFn: async () => {
        const { restoreCourse } = await import('../server/all')
        return restoreCourse({ data: { coursePublicId } })
      },
      onSuccess: refresh,
    }),
    archive: useMutation({
      mutationFn: async () => {
        const { archiveCourse } = await import('../server/all')
        return archiveCourse({ data: { coursePublicId } })
      },
      onSuccess: refresh,
    }),
    setVisibility: useMutation({
      mutationFn: async (variables: {
        lessonPublicId: string
        visibility: 'draft' | 'published' | 'scheduled'
        scheduledPublishAt?: string | null
      }) => {
        const { setItemVisibility } = await import('../server/all')
        return setItemVisibility({
          data: {
            coursePublicId,
            lessonPublicId: variables.lessonPublicId,
            visibility: variables.visibility,
            scheduledPublishAt: variables.scheduledPublishAt ?? null,
          },
        })
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: courseQueryKeys.curriculum(coursePublicId),
        })
        void queryClient.invalidateQueries({ queryKey: ['courses', 'readiness', coursePublicId] })
        void queryClient.invalidateQueries({ queryKey: ['courses', 'catalog'] })
      },
    }),
  }
}
