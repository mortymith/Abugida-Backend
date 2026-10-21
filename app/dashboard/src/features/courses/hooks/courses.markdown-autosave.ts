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
 *
 * Spec 12 § 8.1.2 — the autosave matrix. The full state space:
 *   dirty × online|offline × saving|failed × locked|editable
 * Each cell has a defined Save action, Indicator, and expectedRowVersion
 * handling. This hook implements the matrix; the editor renders the
 * indicators.
 *
 * Offline is editable here, unlike most surfaces (Part 04 S-2.7 exception):
 * because the body is a local buffer with a 1000 ms mirror, locking the
 * author out would protect nothing and cost the whole session. What is
 * suspended offline is the **server write path**, not the editor. Writes
 * queue in order carrying the `rowVersion` they were based on; a stale
 * queued write resolves to the three-option conflict dialog (Phase A3),
 * never a silent overwrite.
 */

export const LESSON_AUTOSAVE_IDLE_MS = 60_000

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline' | 'suspended'

export interface UseLessonAutosaveOptions {
  /** Whether a save is currently permitted (editable + not locked). */
  enabled: boolean
  /** Persist the current body. Rejects on failure. */
  save: () => Promise<void>
  /** Whether there is anything worth saving. */
  dirty: boolean
  /** Whether the browser reports an active network connection. */
  online: boolean
  /** Override for tests; defaults to LESSON_AUTOSAVE_IDLE_MS. */
  idleMs?: number
}

export function useLessonAutosave({
  enabled,
  save,
  dirty,
  online,
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
  const onlineRef = useRef(online)
  const saveRef = useRef(save)

  useEffect(() => {
    dirtyRef.current = dirty
    // Spec 12 § 8.1.2 — derive status from the matrix rather than just
    // toggling dirty. The matrix cells:
    //   dirty & online & enabled & not in-flight & not failed → 'dirty'
    //   dirty & online & enabled & in-flight → 'saving' (preserved)
    //   dirty & online & enabled & failed → 'error' (preserved)
    //   dirty & offline & enabled → 'offline'
    //   dirty & any & !enabled → 'suspended'
    //   !dirty → 'idle' or 'saved' (preserved)
    setStatus((current) => {
      if (!enabled && dirty) return 'suspended'
      if (!dirty) return current === 'saving' ? current : current === 'error' ? current : current
      if (!online) return 'offline'
      if (current === 'saving' || current === 'error') return current
      return 'dirty'
    })
  }, [dirty, enabled, online])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    onlineRef.current = online
  }, [online])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current || !dirtyRef.current || inFlight.current) return false
    // Spec 12 § 8.1.2 — when offline, the save is enqueued by the editor
    // (which has the full SaveLessonInput) rather than attempted here. The
    // hook reports `offline` so the indicator matches the banner.
    if (!onlineRef.current) {
      setStatus('offline')
      return false
    }
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

  // Restart the idle timer on every edit. Spec 12 § 8.1.2: when offline or
  // suspended, the timer is disarmed — there is nothing to flush.
  useEffect(() => {
    if (!dirty || !enabled || !online) {
      if (timer.current) clearTimeout(timer.current)
      return
    }
    schedule()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dirty, enabled, online, schedule])

  // `Ctrl/⌘+S` flushes now, anywhere in the editor including inside
  // ProseMirror. It must also suppress the browser's own save dialog, and must
  // not be swallowed by the editor surface (spec 12 § 7.3, Q on ⌘K).
  //
  // The handler is split into a pure `shouldFlushOnSaveKey` predicate so
  // `bun test` can exercise the keymap wiring without a DOM or React renderer.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldFlushOnSaveKey(event)) return
      event.preventDefault()
      if (timer.current) clearTimeout(timer.current)
      void flush()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [flush])

  return { status, savedAt, error, flush, schedule }
}

/**
 * Pure predicate: does this keyboard event look like a Ctrl/⌘+S save shortcut?
 *
 * Exported so `courses.markdown.keymap.test.ts` can pin the keymap wiring
 * without a DOM. The predicate matches the spec 12 § 7.3 contract: Ctrl+S
 * on Windows/Linux, ⌘+S on macOS, and the key is matched case-insensitively
 * so caps lock does not break the shortcut.
 */
export function shouldFlushOnSaveKey(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
}): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false
  return event.key.toLowerCase() === 's'
}
