import { useEffect } from 'react'
import { useMatches } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  courseDetailsQueryOptions,
  curriculumQueryOptions,
} from '#/features/courses/hooks/courses.queries'
import { CURRICULUM_TAB, parseCourseWorkspaceSearch } from '#/features/courses/courses.workspace'
import type { CourseWorkspaceTab } from '#/features/courses/courses.workspace'
import { rememberCourseWorkspace } from './navigation.resume-preference'

/**
 * S-2.6 Course Workspace context, as the **shell** needs to see it.
 *
 * The breadcrumb and Resume authoring both have to answer questions the course
 * screens already answer — what is this course called, which tab am I on, does
 * the selected item still exist — so they read the same cached queries rather
 * than issuing a second fetch or rendering a dangling `item=` param that 404s.
 *
 * Returns `null` outside the course workspace, which is how the breadcrumb knows
 * to fall back to module crumbs.
 */
export interface CourseWorkspaceContext {
  coursePublicId: string
  courseTitle: string
  /** `null` while the details query is loading — the crumb falls back to the id. */
  courseStatus: CourseLifecycleTabState | null
  tab: CourseWorkspaceTab
  itemPublicId?: string
  itemTitle?: string
  /** `false` once the curriculum has loaded without the remembered item. */
  itemExists: boolean
  /** `true` until the curriculum has settled, so nothing is called "gone" early. */
  curriculumPending: boolean
}

type CourseLifecycleTabState = 'draft' | 'in_review' | 'published' | 'archived'

interface WorkspaceMatch {
  routeId: string
  params: { courseId?: string }
  search: Record<string, unknown>
}

export function useCourseWorkspace(): CourseWorkspaceContext | null {
  const matches = useMatches() as unknown as WorkspaceMatch[]
  const match = matches.find((entry) => entry.routeId === '/_app/courses/$courseId')
  const coursePublicId = match?.params.courseId
  const { tab, item: itemPublicId } = parseCourseWorkspaceSearch(match?.search ?? null)

  const details = useQuery({
    ...courseDetailsQueryOptions(coursePublicId ?? ''),
    enabled: coursePublicId != null,
  })
  const curriculum = useQuery({
    ...curriculumQueryOptions(coursePublicId ?? ''),
    enabled: coursePublicId != null && tab === CURRICULUM_TAB,
  })

  const lesson = itemPublicId
    ? curriculum.data?.modules
        .flatMap((module) => module.lessons)
        .find((entry) => entry.publicId === itemPublicId)
    : undefined

  const context: CourseWorkspaceContext | null =
    coursePublicId == null
      ? null
      : {
          coursePublicId,
          courseTitle: details.data?.title ?? coursePublicId,
          courseStatus: details.data?.status ?? null,
          tab,
          ...(itemPublicId ? { itemPublicId } : {}),
          ...(lesson ? { itemTitle: lesson.title } : {}),
          itemExists: lesson != null,
          curriculumPending: tab === CURRICULUM_TAB && curriculum.isPending,
        }

  useRememberCourseWorkspace(context)
  return context
}

/**
 * Record where the user was, so **Resume authoring** can return them to the
 * exact tab and item they left (S-A.1). A course left in Draft is the common
 * case; recording happens on every settled render, not on navigation events, so
 * a reload inside the workspace is remembered too.
 *
 * Skipped while the details query is loading so the publicId placeholder is
 * never stored as a title.
 */
function useRememberCourseWorkspace(context: CourseWorkspaceContext | null) {
  const coursePublicId = context?.coursePublicId
  const courseTitle = context?.courseTitle
  const status = context?.courseStatus
  const tab = context?.tab
  const itemPublicId = context?.itemPublicId

  useEffect(() => {
    if (!coursePublicId || !courseTitle || !status || !tab) return
    if (courseTitle === coursePublicId) return
    rememberCourseWorkspace({
      coursePublicId,
      courseTitle,
      tab,
      ...(itemPublicId ? { itemPublicId } : {}),
    })
  }, [coursePublicId, courseTitle, itemPublicId, status, tab])
}
