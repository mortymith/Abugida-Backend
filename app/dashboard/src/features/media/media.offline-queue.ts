/**
 * Offline upload queue (spec 05 § S-3.2 — Queued (offline)).
 *
 * Dropping a file while offline does not fail. It is **queued**, the row
 * says "Waiting for connection — will upload automatically.", and the
 * modal footer shows "N uploads waiting to sync." On reconnect the queue
 * flushes in order and each file reports its outcome.
 *
 * The queue is persisted to IndexedDB so it survives tab reload (decision
 * D3). On mount, the hook reads the queue and resumes any uploads that
 * were in flight. Metadata drafts persist alongside so the author's
 * per-file edits are not lost either.
 *
 * This module is framework-free: it owns the queue ordering, the
 * flush-in-order semantics, and the IndexedDB contract. The React hook
 * owns the `online`/`offline` event listeners and the XHR calls.
 */

import type { PerFileMetadata } from './media.upload-metadata'

export const OFFLINE_QUEUE_DB_NAME = 'abugida-upload-queue'
export const OFFLINE_QUEUE_STORE = 'pending-uploads'
export const OFFLINE_QUEUE_METADATA_STORE = 'metadata-drafts'

export type OfflineQueueItemStatus =
  | 'queued' // waiting for connection
  | 'uploading' // in flight
  | 'paused' // user paused or network dropped mid-upload
  | 'completed' // done; will be removed on next flush
  | 'failed' // needs retry

export interface OfflineQueueItem {
  readonly id: string
  readonly fileId: string
  readonly fileName: string
  readonly totalBytes: number
  readonly uploadedBytes: number
  readonly status: OfflineQueueItemStatus
  readonly queuedAt: number
  readonly lastAttemptAt: number | null
  readonly error: string | null
}

export interface OfflineQueueState {
  readonly items: readonly OfflineQueueItem[]
  readonly isOnline: boolean
}

/**
 * Decide whether a newly-dropped file should be queued or uploaded
 * immediately. The spec: "Dropping a file while offline does not fail. It
 * is queued."
 */
export function shouldQueueOffline(isOnline: boolean): boolean {
  return !isOnline
}

/**
 * Order the queue for flushing. The spec: "the queue flushes in order."
 * Order is:
 * 1. `paused` (resume first — the author was mid-upload)
 * 2. `queued` (FIFO by `queuedAt`)
 * 3. `failed` (retry last — the author may want to review the failure)
 */
export function orderQueueForFlush(items: readonly OfflineQueueItem[]): OfflineQueueItem[] {
  const paused = items.filter((i) => i.status === 'paused')
  const queued = items.filter((i) => i.status === 'queued').sort((a, b) => a.queuedAt - b.queuedAt)
  const failed = items.filter((i) => i.status === 'failed')
  return [...paused, ...queued, ...failed]
}

/**
 * The next item to upload when flushing the queue. Returns `null` when
 * the queue is empty or all items are completed.
 */
export function nextQueueItem(items: readonly OfflineQueueItem[]): OfflineQueueItem | null {
  const ordered = orderQueueForFlush(items)
  return ordered[0] ?? null
}

/**
 * The "N uploads waiting to sync" count for the modal footer. Counts
 * items that are queued, paused, or failed — not completed or in-flight.
 */
export function pendingUploadCount(items: readonly OfflineQueueItem[]): number {
  return items.filter(
    (i) => i.status === 'queued' || i.status === 'paused' || i.status === 'failed',
  ).length
}

/**
 * The footer label for the modal. "3 uploads waiting to sync." or
 * "1 upload waiting to sync." Singular/plural handled.
 */
export function pendingUploadLabel(items: readonly OfflineQueueItem[]): string {
  const count = pendingUploadCount(items)
  if (count === 0) return ''
  return `${count} upload${count === 1 ? '' : 's'} waiting to sync`
}

/**
 * Whether the modal's close confirmation should fire. The spec: closing
 * with uploads in flight shows the pause-and-resume confirmation. This
 * is true when any item is uploading, paused, or queued.
 */
export function shouldWarnOnClose(items: readonly OfflineQueueItem[]): boolean {
  return items.some(
    (i) => i.status === 'uploading' || i.status === 'paused' || i.status === 'queued',
  )
}

/**
 * The close-confirmation message. The spec: "2 uploads are still in
 * progress. Closing pauses them — you can resume from the Media module."
 */
export function closeWarningMessage(items: readonly OfflineQueueItem[]): string {
  const inFlight = items.filter((i) => i.status === 'uploading').length
  const paused = items.filter((i) => i.status === 'paused').length
  const queued = items.filter((i) => i.status === 'queued').length
  const total = inFlight + paused + queued
  if (total === 0) return ''
  const noun = total === 1 ? 'upload is' : 'uploads are'
  return `${total} ${noun} still in progress. Closing pauses them — you can resume from the Media module.`
}

// ── IndexedDB I/O ──────────────────────────────────────────────────────────
//
// Minimal IndexedDB contract: open the DB, get/put/delete items + metadata
// drafts. The hook owns the `online`/`offline` events and the XHR calls.

export function openOfflineQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const request = indexedDB.open(OFFLINE_QUEUE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_METADATA_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_METADATA_STORE, { keyPath: 'fileId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function readOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openOfflineQueueDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly')
      const store = tx.objectStore(OFFLINE_QUEUE_STORE)
      const request = store.getAll()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      request.onsuccess = () => resolve((request.result as OfflineQueueItem[]) ?? [])
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    })
  } catch {
    return []
  }
}

export async function writeOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openOfflineQueueDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(OFFLINE_QUEUE_STORE)
      store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
  } catch {
    // Swallow — the queue is best-effort. A write failure (e.g. private
    // mode) must never block the editor.
  }
}

export async function deleteOfflineQueueItem(id: string): Promise<void> {
  try {
    const db = await openOfflineQueueDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(OFFLINE_QUEUE_STORE)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    })
  } catch {
    // Swallow — same rationale.
  }
}

export async function readMetadataDraft(fileId: string): Promise<PerFileMetadata | null> {
  try {
    const db = await openOfflineQueueDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_METADATA_STORE, 'readonly')
      const store = tx.objectStore(OFFLINE_QUEUE_METADATA_STORE)
      const request = store.get(fileId)
      request.onsuccess = () => resolve((request.result as PerFileMetadata | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    })
  } catch {
    return null
  }
}

export async function writeMetadataDraft(metadata: PerFileMetadata): Promise<void> {
  try {
    const db = await openOfflineQueueDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_METADATA_STORE, 'readwrite')
      const store = tx.objectStore(OFFLINE_QUEUE_METADATA_STORE)
      store.put(metadata)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
  } catch {
    // Swallow — metadata drafts are best-effort.
  }
}
