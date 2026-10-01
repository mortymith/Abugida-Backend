import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  courseDetailsQueryOptions,
  curriculumQueryOptions,
} from '#/features/courses/hooks/courses.queries'
import { COURSE_AUTHORING_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'
import { resolveResumeDecision } from '../navigation.resume'
import type { ResumeDecision } from '../navigation.resume'
import { useResumePreference } from '../navigation.resume-preference'

/**
 * Resolve the Resume authoring affordance for the header (S-A.1).
 *
 * The remembered course is re-read before the control is offered, because every
 * one of the conflict rules depends on the course *now* rather than when the
 * preference was written. Queries are disabled until there is something to
 * check, so the header costs nothing for the majority of sessions.
 *
 * `now` is sampled once per decision so the seven-day window cannot flip
 * mid-render.
 */
export function useResumeDecision(role: PlatformRole): ResumeDecision {
  const { preference, clear } = useResumePreference()

  const checkable = preference != null && COURSE_AUTHORING_ROLES.includes(role)

  const details = useQuery({
    ...courseDetailsQueryOptions(preference?.coursePublicId ?? ''),
    enabled: checkable,
  })
  const curriculum = useQuery({
    ...curriculumQueryOptions(preference?.coursePublicId ?? ''),
    enabled: checkable,
  })

  const itemExists =
    preference?.itemPublicId != null
      ? (curriculum.data?.modules.flatMap((module) => module.lessons) ?? []).some(
          (lesson) => lesson.publicId === preference.itemPublicId,
        )
      : true

  const decision = resolveResumeDecision(preference, {
    role,
    // Absence is only a fact once the query has settled, so a loading response
    // reads as "still there" rather than as a deleted course.
    courseExists: details.isPending ? true : details.data != null,
    courseStatus: details.data?.status ?? null,
    itemExists,
    curriculumPending: curriculum.isPending,
    now: Date.now(),
  })

  // A deleted course leaves nothing to resume into: drop the stale record so the
  // control cannot reappear for a course that no longer exists.
  useEffect(() => {
    if (decision.kind === 'hidden' && decision.clearPreference) clear()
  }, [clear, decision])

  return decision
}
