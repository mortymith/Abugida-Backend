import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Autosave for the Lesson Editor — spec 12 § 8.1.
 *
 * Part 11 mandates a 60-second autosave for course content. This is an *idle*
 * timer (60s since the last edit), not a wall-clock interval, so a save never
 * interrupts mid-sentence. `Ctrl/⌘+S` flushes immediately.
 *
 * Autosave is suspended whenever the editor is not editable — an `in_review`
 * lesson is locked for editing, and permission-aware UI means a Viewer or
 * Reviewer has no save path at all.
 */

export const LESSON_AUTOSAVE_IDLE_MS = 60_000

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface UseLessonAutosaveOptions {
  /** Whether a save is currently permitted. */
  enabled: boolean
  /** Persist the current body. Rejects on failure. */
  save: () => Promise<void>
  /** Whether there is anything worth saving. */
  dirty: boolean
  idleMs?: number
}

export function useLessonAutosave({
  enabled,
  save,
  dirty,
  idleMs = LESSON_AUTOSAVE_IDLE_MS,
}: UseLessonAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  // Mirrors of the latest props, so the timer and the key handler never close
  // over stale values.
  const dirtyRef = useRef(dirty)
  const enabledRef = useRef(enabled)
  const saveRef = useRef(save)

  useEffect(() => {
    dirtyRef.current = dirty
    setStatus((current) => (dirty ? (current === 'saving' ? current : 'dirty') : current))
  }, [dirty])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current || !dirtyRef.current || inFlight.current) return false
    inFlight.current = true
    setStatus('saving')
    try {
      await saveRef.current()
      setStatus('saved')
      setError(null)
      setSavedAt(new Date())
      return true
    } catch (cause) {
      // The unsaved buffer is deliberately left in place: a failed save must
      // never discard the author's work.
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Save failed')
      return false
    } finally {
      inFlight.current = false
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void flush()
    }, idleMs)
  }, [flush, idleMs])

  // Restart the idle timer on every edit.
  useEffect(() => {
    if (!dirty || !enabled) {
      if (timer.current) clearTimeout(timer.current)
      return
    }
    schedule()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dirty, enabled, schedule])

  // `Ctrl/⌘+S` flushes now, anywhere in the editor including inside
  // ProseMirror. It must also suppress the browser's own save dialog, and must
  // not be swallowed by the editor surface (spec 12 § 7.3, Q on ⌘K).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (timer.current) clearTimeout(timer.current)
        void flush()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [flush])

  return { status, savedAt, error, flush, schedule }
}
