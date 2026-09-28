import { useCallback, useEffect, useState } from 'react'

/**
 * View-mode state for the Lesson Editor — spec 12 § 7.1.
 *
 * Rich is the default and stays the recommended mode; split and preview are
 * opt-in. The choice is a one-bit client preference, so it lives in
 * `localStorage` rather than costing a Settings screen.
 */

export const LESSON_VIEW_MODES = ['rich', 'split', 'preview'] as const
export type LessonViewMode = (typeof LESSON_VIEW_MODES)[number]

const STORAGE_KEY = 'abugida.lesson-editor.view'

export const VIEW_MODE_LABELS: Record<LessonViewMode, string> = {
  rich: 'Rich text',
  split: 'Split',
  preview: 'Preview',
}

export const VIEW_MODE_HINTS: Record<LessonViewMode, string> = {
  rich: 'Edit with formatting controls. Recommended for most authoring.',
  split: 'Edit visually and as Markdown side by side. Precise, but undo works per sync.',
  preview: 'Read-only: exactly what a student will see, and what a reviewer approves.',
}

function isViewMode(value: unknown): value is LessonViewMode {
  return typeof value === 'string' && (LESSON_VIEW_MODES as readonly string[]).includes(value)
}

function readStoredMode(): LessonViewMode {
  // Guarded: this can run during SSR, where `localStorage` does not exist.
  if (typeof window === 'undefined') return 'rich'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isViewMode(stored) ? stored : 'rich'
  } catch {
    // Private-mode or disabled storage: fall back to the default silently.
    return 'rich'
  }
}

export function useLessonViewMode() {
  // Start at the default on both server and first client render so hydration
  // matches; the stored preference is applied after mount.
  const [mode, setModeState] = useState<LessonViewMode>('rich')

  useEffect(() => {
    setModeState(readStoredMode())
  }, [])

  const setMode = useCallback((next: LessonViewMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Non-fatal: the mode still applies for this session.
    }
  }, [])

  return { mode, setMode }
}
