import { useCallback, useEffect, useState } from 'react'
import { isCourseWorkspaceTab } from '#/features/courses/courses.workspace'
import type { CourseWorkspacePreference } from './navigation.resume'

/**
 * Persistence for the "course I was last in" preference that backs Resume
 * authoring (S-A.1).
 *
 * `localStorage` is browser-only and reading it during render desynchronises
 * hydration, so `useResumePreference` hydrates in an effect and the shell
 * renders without the affordance until the browser has answered — one frame of
 * absence, never a mismatch.
 *
 * The record is stored **defensively**: an unknown tab, a non-string title, or
 * a corrupt payload yields `null` rather than a crash in the header.
 */
const STORAGE_KEY = 'abugida-last-course-workspace'

type StoredPreference = {
  coursePublicId?: unknown
  courseTitle?: unknown
  tab?: unknown
  itemPublicId?: unknown
  savedAt?: unknown
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Blocked by privacy settings — Resume is a convenience, not a contract.
    return null
  }
}

export function readCourseWorkspacePreference(): CourseWorkspacePreference | null {
  const store = storage()
  if (!store) return null
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return null
    const raw = parsed as StoredPreference
    if (
      typeof raw.coursePublicId !== 'string' ||
      raw.coursePublicId.length === 0 ||
      typeof raw.courseTitle !== 'string' ||
      raw.courseTitle.length === 0 ||
      !isCourseWorkspaceTab(raw.tab) ||
      typeof raw.savedAt !== 'number' ||
      !Number.isFinite(raw.savedAt)
    ) {
      return null
    }
    const itemPublicId =
      typeof raw.itemPublicId === 'string' && raw.itemPublicId.length > 0
        ? raw.itemPublicId
        : undefined
    return {
      coursePublicId: raw.coursePublicId,
      courseTitle: raw.courseTitle,
      tab: raw.tab,
      savedAt: raw.savedAt,
      ...(itemPublicId ? { itemPublicId } : {}),
    }
  } catch {
    return null
  }
}

export function rememberCourseWorkspace(
  preference: Omit<CourseWorkspacePreference, 'savedAt'>,
): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...preference, savedAt: Date.now() }))
  } catch {
    // A full or unavailable quota must never break navigation.
  }
}

export function clearCourseWorkspacePreference(): void {
  storage()?.removeItem(STORAGE_KEY)
}

/**
 * The stored preference, hydrated after mount. `remember` is a no-op during the
 * first render so an SSR page and its hydrated client agree.
 */
export function useResumePreference() {
  const [preference, setPreference] = useState<CourseWorkspacePreference | null>(null)

  useEffect(() => {
    setPreference(readCourseWorkspacePreference())
  }, [])

  const remember = useCallback((next: Omit<CourseWorkspacePreference, 'savedAt'>) => {
    rememberCourseWorkspace(next)
    setPreference(readCourseWorkspacePreference())
  }, [])

  const clear = useCallback(() => {
    clearCourseWorkspacePreference()
    setPreference(null)
  }, [])

  return { preference, remember, clear }
}
