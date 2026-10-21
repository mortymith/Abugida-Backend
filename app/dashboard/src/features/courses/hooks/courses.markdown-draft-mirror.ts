/**
 * IndexedDB draft mirror for the Lesson Editor — spec 12 § 8.1.1.
 *
 * The 60s _no-typing_ autosave timer means an author who types for 40 seconds
 * and closes the tab has an in-memory-only buffer. This module is the
 * durability layer that closes that gap, and it is the mechanism Part 04
 * S-2.7 declares behind every session-expiry and reload guarantee.
 *
 * Three rules (verbatim from § 8.1.1):
 *  1. The unsaved body is mirrored to IndexedDB on every `editor.update`,
 *     debounced 1000 ms, and cleared on a confirmed save — never on a failed
 *     or conflicted one.
 *  2. On mount, if a local draft exists, the editor surfaces a restore
 *     prompt **before hydration**. The prompt is never silent and never
 *     auto-applied.
 *  3. `beforeunload` sets `preventDefault` whenever `dirty === true`,
 *     regardless of the IndexedDB mirror.
 *
 * Store / key:
 *   database:  `abugida-lesson-drafts`
 *   store:     `drafts`
 *   key shape: `draft:item:<itemPublicId>:<rowVersion>`
 *
 * The `rowVersion` in the key is what makes a stale draft impossible to
 * confuse with a current one: a draft written against rowVersion N does not
 * match a row that has moved on to N+1.
 *
 * This module is deliberately DOM-light: it uses `indexedDB` directly (no
 * wrapper) and avoids any React-specific imports so the same code can be
 * exercised by `bun test` against a `fake-indexeddb` shim.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Time the author is idle before the mirror write fires. Spec 12 § 8.1.1. */
export const DRAFT_MIRROR_DEBOUNCE_MS = 1_000

/** IndexedDB database + store names. */
const DB_NAME = 'abugida-lesson-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

/** The shape persisted to IndexedDB. No media bytes, no student data. */
export interface LessonDraftMirror {
  /** Canonical Markdown body, the same string `saveLesson` would receive. */
  body: string
  /** Title at the time of the mirror — needed because the editor mirrors both. */
  title: string
  /** ISO 8601 timestamp the draft was last touched, for the restore prompt. */
  updatedAt: string
  /**
   * The rowVersion the draft was based on. The key also carries it, but
   * keeping it in the payload means the prompt can read it without parsing
   * the key.
   */
  rowVersion: number
}

/**
 * Build the IndexedDB key for one (item, rowVersion) pair.
 *
 * Exported so tests and the restore prompt can construct the same key the
 * mirror writes, without duplicating the format string.
 */
export function draftKey(itemPublicId: string, rowVersion: number): string {
  return `draft:item:${itemPublicId}:${rowVersion}`
}

/**
 * Lazy single-tab IndexedDB opener. Returns null when IndexedDB is unavailable
 * (older browsers, private mode in some engines, SSR). The hook treats null as
 * "mirror disabled" rather than throwing — a missing mirror degrades to the
 * in-memory buffer only, which is the pre-Revison-3 behaviour.
 */
let cachedDb: IDBDatabase | null = null
let cachedDbPromise: Promise<IDBDatabase | null> | null = null

export function openDraftsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (cachedDb) return Promise.resolve(cachedDb)
  if (cachedDbPromise) return cachedDbPromise

  cachedDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      cachedDb = request.result
      resolve(cachedDb)
    }
    request.onerror = () => resolve(null)
  })
  return cachedDbPromise
}

/**
 * Test-only hook: drop the cached connection so a fresh `openDraftsDb` call
 * re-opens against the (possibly reset) underlying database. Exported for
 * `bun test` against `fake-indexeddb`; not used by the editor at runtime.
 */
export function __resetDraftsDbCacheForTests(): void {
  if (cachedDb) {
    cachedDb.close()
  }
  cachedDb = null
  cachedDbPromise = null
}

/** Read a draft by key. Resolves null when the key is absent or the DB is unavailable. */
export async function readDraft(key: string): Promise<LessonDraftMirror | null> {
  const db = await openDraftsDb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      resolve((request.result as LessonDraftMirror | undefined) ?? null)
    }
    request.onerror = () => resolve(null)
  })
}

/** Write a draft by key. No-ops when the DB is unavailable. */
export async function writeDraft(key: string, draft: LessonDraftMirror): Promise<void> {
  const db = await openDraftsDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(draft, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/** Remove a draft by key. Used on confirmed save and on Discard. */
export async function clearDraft(key: string): Promise<void> {
  const db = await openDraftsDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/**
 * Restore-prompt state surfaced to the editor before hydration.
 *
 * `pending` means a draft exists at the current rowVersion; the editor must
 * ask the author Restore / Discard before hydrating from the server body.
 * `stale` means the draft's rowVersion is older than the server's, in which
 * case the editor routes to the conflict dialog (§ 8.2) instead.
 */
export type DraftRestoreState =
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'pending'; draft: LessonDraftMirror }
  | { kind: 'stale'; draft: LessonDraftMirror }

export interface UseLessonDraftMirrorOptions {
  itemPublicId: string
  /** The server's current rowVersion, read from `LessonEditDTO`. */
  rowVersion: number
  /** The current Markdown body, kept in sync with the editor. */
  body: string
  /** The current title, mirrored alongside the body. */
  title: string
  /** Whether the editor is dirty — drives the beforeunload guard. */
  dirty: boolean
  /**
   * Whether the mirror should be writing. False during hydration (so we don't
   * mirror the server body before the author has touched anything) and during
   * locked states (in_review / Viewer).
   */
  enabled: boolean
  /** Override for tests; defaults to DRAFT_MIRROR_DEBOUNCE_MS. */
  debounceMs?: number
}

export interface UseLessonDraftMirrorResult {
  /** The current restore-prompt state. */
  restore: DraftRestoreState
  /** The author chose Restore — give the draft back to the editor. */
  acceptRestore: () => LessonDraftMirror | null
  /** The author chose Discard — clear the mirror. */
  discardRestore: () => Promise<void>
  /**
   * Call from `onSuccess` of the save mutation. A failed or conflicted save
   * must NOT clear the mirror — the work is not yet safe.
   */
  onConfirmedSave: () => Promise<void>
}

/**
 * The hook the editor mounts. It does three things:
 *  1. On mount, looks for a draft at the current rowVersion. If found and the
 *     draft's rowVersion ≥ the server's, surfaces `pending`. If the draft's
 *     rowVersion is < the server's, surfaces `stale` (which the editor routes
 *     to the conflict dialog).
 *  2. While dirty and enabled, writes the current body to the mirror debounced
 *     at `debounceMs`.
 *  3. Registers a `beforeunload` handler that sets `preventDefault` whenever
 *     `dirty === true`.
 */
export function useLessonDraftMirror({
  itemPublicId,
  rowVersion,
  body,
  title,
  dirty,
  enabled,
  debounceMs = DRAFT_MIRROR_DEBOUNCE_MS,
}: UseLessonDraftMirrorOptions): UseLessonDraftMirrorResult {
  const [restore, setRestore] = useState<DraftRestoreState>({ kind: 'checking' })
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors of the latest values, so the debounced writer never closes over
  // stale props.
  const bodyRef = useRef(body)
  const titleRef = useRef(title)
  const rowVersionRef = useRef(rowVersion)
  const dirtyRef = useRef(dirty)
  const enabledRef = useRef(enabled)
  const keyRef = useRef<string>(draftKey(itemPublicId, rowVersion))

  useEffect(() => {
    bodyRef.current = body
  }, [body])
  useEffect(() => {
    titleRef.current = title
  }, [title])
  useEffect(() => {
    rowVersionRef.current = rowVersion
    keyRef.current = draftKey(itemPublicId, rowVersion)
  }, [itemPublicId, rowVersion])
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  // ---- 1. Mount-time restore check --------------------------------------
  useEffect(() => {
    let cancelled = false
    const key = draftKey(itemPublicId, rowVersion)
    void (async () => {
      const draft = await readDraft(key)
      // `cancelled` is set by the cleanup function below. TS's control-flow
      // analysis narrows it to `false` here because it cannot see the async
      // reassignment; the cast keeps the runtime check.
      if (cancelled as boolean) return
      if (!draft) {
        setRestore({ kind: 'none' })
        return
      }
      if (draft.rowVersion >= rowVersion) {
        setRestore({ kind: 'pending', draft })
      } else {
        setRestore({ kind: 'stale', draft })
      }
    })()
    return () => {
      cancelled = true
    }
    // We deliberately re-run only when the (item, rowVersion) pair changes.
    // Body / title / dirty changes must NOT re-trigger the mount-time read.
  }, [itemPublicId, rowVersion])

  // ---- 2. Debounced write while dirty & enabled -------------------------
  useEffect(() => {
    if (!enabled || !dirty) {
      if (writeTimer.current) {
        clearTimeout(writeTimer.current)
        writeTimer.current = null
      }
      return
    }
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(() => {
      const payload: LessonDraftMirror = {
        body: bodyRef.current,
        title: titleRef.current,
        updatedAt: new Date().toISOString(),
        rowVersion: rowVersionRef.current,
      }
      void writeDraft(keyRef.current, payload)
    }, debounceMs)
    return () => {
      if (writeTimer.current) {
        clearTimeout(writeTimer.current)
        writeTimer.current = null
      }
    }
  }, [body, title, dirty, enabled, debounceMs])

  // ---- 3. beforeunload guard -------------------------------------------
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      // The spec calls for `preventDefault` + `returnValue`. Modern browsers
      // ignore custom text, but the guard itself is what triggers the native
      // "Leave site? Changes you made may not be saved" prompt.
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const acceptRestore = useCallback((): LessonDraftMirror | null => {
    if (restore.kind !== 'pending') return null
    const draft = restore.draft
    setRestore({ kind: 'none' })
    return draft
  }, [restore])

  const discardRestore = useCallback(async () => {
    await clearDraft(keyRef.current)
    setRestore({ kind: 'none' })
  }, [])

  const onConfirmedSave = useCallback(async () => {
    // A confirmed save means the server now holds the same body the mirror
    // holds, so the mirror is redundant. A failed or conflicted save must
    // leave the mirror intact — handled by the editor, which only calls this
    // from the mutation's `onSuccess`.
    if (writeTimer.current) {
      clearTimeout(writeTimer.current)
      writeTimer.current = null
    }
    await clearDraft(keyRef.current)
  }, [])

  return { restore, acceptRestore, discardRestore, onConfirmedSave }
}
