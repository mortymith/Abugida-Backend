/**
 * IndexedDB draft mirror (spec 04 § S-2.7, spec 12 § 8.1.1).
 *
 * The Lesson Editor mirrors the author's buffer to IndexedDB so a session
 * expiry or accidental tab close does not lose work. The contract is:
 *
 * - **Key:** `draft:item:<itemPublicId>:<rowVersion>` — the row version is
 *   part of the key so a mirror from a stale version never silently
 *   overwrites a newer server state.
 * - **Value:** `{ body, title, updatedAt, rowVersion }`.
 * - **Debounce:** 1000ms — every keystroke would thrash IndexedDB.
 * - **Clear:** only on confirmed server save. A failed save leaves the
 *   mirror intact.
 *
 * Restore logic on mount:
 * - mirror's `rowVersion` > server's `rowVersion` → impossible (mirror is
 *   always derived from a server-acknowledged version); treat as no-op.
 * - mirror's `rowVersion` === server's `rowVersion` and mirror has body →
 *   prompt to restore (the author had unsaved work).
 * - mirror's `rowVersion` < server's `rowVersion` → **Conflict** (the
 *   server moved on while the author was away). Delegate to the conflict
 *   diff; never silently restore.
 *
 * This module is framework-free: it owns the IndexedDB contract and the
 * restore-decision logic. The React hook (`useDraftMirror`) is a consumer.
 */

import type { ConflictAction } from './courses.conflict-diff'

export const DRAFT_MIRROR_DB_NAME = 'abugida-drafts'
export const DRAFT_MIRROR_STORE = 'item-drafts'
export const DRAFT_MIRROR_DEBOUNCE_MS = 1000

export interface DraftMirrorEntry {
  readonly body: string
  readonly title: string
  readonly updatedAt: number
  readonly rowVersion: number
}

export type RestoreDecision =
  | { readonly kind: 'no-mirror' }
  | { readonly kind: 'restore'; readonly entry: DraftMirrorEntry }
  | {
      readonly kind: 'conflict'
      readonly entry: DraftMirrorEntry
      readonly serverRowVersion: number
    }

export function draftMirrorKey(itemPublicId: string, rowVersion: number): string {
  return `draft:item:${itemPublicId}:${rowVersion}`
}

/**
 * Decide what to do with a mirror entry on mount, given the server's
 * current `rowVersion`.
 *
 * The decision tree implements the spec invariant: a mirror from a stale
 * version never silently overwrites a newer server state. When the server
 * has moved on (`mirror.rowVersion < serverRowVersion`), the only path is
 * the conflict diff — never silent restore, never silent discard.
 */
export function decideRestore(
  entry: DraftMirrorEntry | null,
  serverRowVersion: number,
): RestoreDecision {
  if (!entry) return { kind: 'no-mirror' }
  if (entry.rowVersion < serverRowVersion) {
    return { kind: 'conflict', entry, serverRowVersion }
  }
  // mirror.rowVersion >= serverRowVersion — the mirror is from this version
  // (or a phantom future version, which we treat as this version). If the
  // body is non-empty, prompt to restore.
  if (entry.body.length > 0 || entry.title.length > 0) {
    return { kind: 'restore', entry }
  }
  return { kind: 'no-mirror' }
}

/**
 * Apply the author's restore decision. The component calls this after
 * showing the restore prompt or conflict diff.
 *
 * - `restore` → the mirror's body/title become the editor's buffer.
 * - `discard` → the mirror is cleared and the server's body/title are used.
 * - `keep-mine` / `take-theirs` → conflict actions delegated to
 *   `applyConflictAction` from the conflict-diff module.
 */
export function applyRestoreDecision(
  decision: RestoreDecision,
  action: 'restore' | 'discard' | ConflictAction,
  serverBody: string,
  serverTitle: string,
): { body: string; title: string; clearMirror: boolean } {
  if (decision.kind === 'no-mirror') {
    return { body: serverBody, title: serverTitle, clearMirror: false }
  }

  if (decision.kind === 'restore') {
    if (action === 'restore') {
      return { body: decision.entry.body, title: decision.entry.title, clearMirror: false }
    }
    if (action === 'discard') {
      return { body: serverBody, title: serverTitle, clearMirror: true }
    }
    // Conflict actions on a restore decision are a no-op — restore has no
    // conflict. Fall through to server values.
    return { body: serverBody, title: serverTitle, clearMirror: true }
  }

  // decision.kind === 'conflict'
  if (action === 'keep-mine') {
    return { body: decision.entry.body, title: decision.entry.title, clearMirror: false }
  }
  if (action === 'take-theirs') {
    return { body: serverBody, title: serverTitle, clearMirror: true }
  }
  if (action === 'discard') {
    return { body: serverBody, title: serverTitle, clearMirror: true }
  }
  // `compare` and `restore` are not terminal actions on a conflict — the
  // component opens the diff overlay and the author makes a follow-up
  // choice. Return server values; the mirror is preserved.
  return { body: serverBody, title: serverTitle, clearMirror: false }
}

// ── IndexedDB I/O ──────────────────────────────────────────────────────────
//
// These are deliberately minimal — open a DB, get/put/delete a single key.
// The hook owns the debounce and the lifecycle; these functions are the
// storage primitives.

export function openDraftMirrorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const request = indexedDB.open(DRAFT_MIRROR_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFT_MIRROR_STORE)) {
        db.createObjectStore(DRAFT_MIRROR_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function readDraftMirror(
  itemPublicId: string,
  rowVersion: number,
): Promise<DraftMirrorEntry | null> {
  try {
    const db = await openDraftMirrorDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_MIRROR_STORE, 'readonly')
      const store = tx.objectStore(DRAFT_MIRROR_STORE)
      const request = store.get(draftMirrorKey(itemPublicId, rowVersion))
      request.onsuccess = () => resolve((request.result as DraftMirrorEntry | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    })
  } catch {
    return null
  }
}

export async function writeDraftMirror(
  itemPublicId: string,
  rowVersion: number,
  entry: DraftMirrorEntry,
): Promise<void> {
  try {
    const db = await openDraftMirrorDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_MIRROR_STORE, 'readwrite')
      const store = tx.objectStore(DRAFT_MIRROR_STORE)
      store.put(entry, draftMirrorKey(itemPublicId, rowVersion))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
  } catch {
    // Swallow — the mirror is a best-effort recovery mechanism. A write
    // failure (e.g. private mode) must never block the editor.
  }
}

export async function clearDraftMirror(itemPublicId: string, rowVersion: number): Promise<void> {
  try {
    const db = await openDraftMirrorDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_MIRROR_STORE, 'readwrite')
      const store = tx.objectStore(DRAFT_MIRROR_STORE)
      store.delete(draftMirrorKey(itemPublicId, rowVersion))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    })
  } catch {
    // Swallow — same rationale as writeDraftMirror.
  }
}
