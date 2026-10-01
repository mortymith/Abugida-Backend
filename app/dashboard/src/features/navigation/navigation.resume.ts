import {
  DEFAULT_WORKSPACE_TAB,
  buildCourseWorkspaceHref,
  isCourseWorkspaceTab,
} from '#/features/courses/courses.workspace'
import type { CourseWorkspaceTab } from '#/features/courses/courses.workspace'
import { COURSE_AUTHORING_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'

/**
 * **Resume authoring** (S-A.1): "Continue in {course}" returns the user to the
 * course they last had open, at the tab and item they left.
 *
 * The conflict rules are the point. A dangling destination is worse than no
 * affordance, so every way the remembered target can stop existing resolves to
 * an explicit decision here — pure, so the rules are testable without React,
 * a router, or a database.
 *
 * | Condition                              | Behaviour                                              |
 * | -------------------------------------- | ------------------------------------------------------ |
 * | Course archived                        | **Hidden** — there is nothing to resume into            |
 * | Course deleted                         | **Hidden**, and the stale preference is cleared         |
 * | Lost `course.manage_curriculum`        | **Hidden** — resume is an authoring affordance         |
 * | Viewer                                | **Never shown**, under any condition                    |
 * | Last-edited item archived or deleted   | Falls back to the course **Overview**, and says so      |
 * | Item moved to another course           | Falls back to the course Overview, never a dangling id  |
 * | > 7 days since last edit               | Hidden; the preference is retained                      |
 */

/** Resume is offered for a week; after that the preference is kept but unused. */
export const RESUME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface CourseWorkspacePreference {
  coursePublicId: string
  courseTitle: string
  tab: CourseWorkspaceTab
  /** Public id of the last-edited curriculum item, when the user was in one. */
  itemPublicId?: string
  /** Epoch ms of the last time the workspace was opened. */
  savedAt: number
}

export type ResumeHiddenReason =
  'no-preference' | 'not-authoring' | 'stale' | 'course-archived' | 'course-deleted'

export type ResumeDecision =
  | { kind: 'hidden'; reason: ResumeHiddenReason; clearPreference: boolean }
  | {
      kind: 'resume'
      coursePublicId: string
      courseTitle: string
      tab: CourseWorkspaceTab
      itemPublicId?: string
      /** Route path + search for the destination. */
      to: string
    }
  | {
      kind: 'fallback'
      coursePublicId: string
      courseTitle: string
      tab: CourseWorkspaceTab
      to: string
      /** What the user is told when they land on the fallback. */
      message: string
    }

/** Everything the decision needs about the world *now*, as facts. */
export interface ResumeFacts {
  role: PlatformRole
  /** `false` once the course details query resolved without a course. */
  courseExists: boolean
  courseStatus: 'draft' | 'in_review' | 'published' | 'archived' | null
  /** `false` once the curriculum resolved without the remembered item. */
  itemExists: boolean
  /** `true` while the curriculum is still loading — absence is not yet a fact. */
  curriculumPending: boolean
  now: number
}

function isStale(savedAt: number, now: number): boolean {
  return now - savedAt > RESUME_MAX_AGE_MS
}

/**
 * Resolve the resume affordance. Order matters: the role and freshness checks
 * come before the course checks so a Viewer never sees a flash of the control,
 * and the deleted case is distinguished from the archived one because only the
 * former should erase the stored preference.
 */
export function resolveResumeDecision(
  preference: CourseWorkspacePreference | null,
  facts: ResumeFacts,
): ResumeDecision {
  if (!preference) return { kind: 'hidden', reason: 'no-preference', clearPreference: false }

  // Never shown for a Viewer, and never for someone who can no longer manage
  // curriculum — including after a role change.
  if (!COURSE_AUTHORING_ROLES.includes(facts.role)) {
    return { kind: 'hidden', reason: 'not-authoring', clearPreference: false }
  }

  if (isStale(preference.savedAt, facts.now)) {
    // Retained, so re-entry is still one click when they come back to it.
    return { kind: 'hidden', reason: 'stale', clearPreference: false }
  }

  if (!facts.courseExists) {
    return { kind: 'hidden', reason: 'course-deleted', clearPreference: true }
  }

  if (facts.courseStatus === 'archived') {
    return { kind: 'hidden', reason: 'course-archived', clearPreference: false }
  }

  const tab = isCourseWorkspaceTab(preference.tab) ? preference.tab : DEFAULT_WORKSPACE_TAB
  const base = `/courses/${preference.coursePublicId}`
  const itemPublicId = preference.itemPublicId

  // An item that is gone (archived, deleted, or moved to another course) must
  // not become a `item=` param that renders nothing.
  if (itemPublicId && !facts.curriculumPending && !facts.itemExists) {
    return {
      kind: 'fallback',
      coursePublicId: preference.coursePublicId,
      courseTitle: preference.courseTitle,
      tab: DEFAULT_WORKSPACE_TAB,
      to: buildCourseWorkspaceHref(base, { tab: DEFAULT_WORKSPACE_TAB }),
      message: `That lesson was archived. Opening ${preference.courseTitle}.`,
    }
  }

  if (itemPublicId) {
    return {
      kind: 'resume',
      coursePublicId: preference.coursePublicId,
      courseTitle: preference.courseTitle,
      tab,
      itemPublicId,
      to: buildCourseWorkspaceHref(base, { tab, item: itemPublicId }),
    }
  }

  return {
    kind: 'resume',
    coursePublicId: preference.coursePublicId,
    courseTitle: preference.courseTitle,
    tab,
    to: buildCourseWorkspaceHref(base, { tab }),
  }
}

/** The label the header control carries. */
export function resumeLabel(decision: ResumeDecision): string | null {
  if (decision.kind === 'hidden') return null
  return `Continue in ${decision.courseTitle}`
}
