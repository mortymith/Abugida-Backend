/**
 * Offline save queue for the Lesson Editor — spec 12 § 8.1.2.
 *
 * When the editor is offline and dirty, writes are **enqueued** in order
 * rather than rejected. The canvas stays editable (Part 04 S-2.7 is explicit
 * that offline authoring is safe, because the IndexedDB mirror keeps taking
 * writes every 1000 ms). The banner reads _"You're offline — N changes will
 * sync when you reconnect."_ and `Flush now` reads **"Queued — will sync"**
 * rather than erroring.
 *
 * Queue semantics on reconnect (§ 8.1.2):
 *  - Queued writes flush **in order**.
 *  - A queued write whose `rowVersion` is now stale resolves to **conflict**
 *    (§ 8.2) — never a silent overwrite.
 *  - Subsequent queued writes for the same lesson are **not** discarded:
 *    they are held behind the conflict resolution and re-stamped by whichever
 *    option the author picks, so _"Keep mine"_ recovers the whole queue
 *    rather than only its head.
 *
 * Storage: IndexedDB, in a separate store from the draft mirror. The mirror
 * is the recovery path for unsaved work; the queue is the replay buffer for
 * confirmed save attempts that could not reach the server. They serve
 * different purposes and must not collide.
 */
/** IndexedDB store name, lives in the same database as the draft mirror. */
export const QUEUE_STORE_NAME = 'offline-save-queue'

/** One entry in the offline queue. */
export interface QueuedSave {
  /** The lesson's public id — used as the queue key. */
  lessonPublicId: string
  /** The Markdown body the author tried to save. */
  body: string
  /** Always 'markdown' — boundary enforcement is D-3. */
  bodyFormat: 'markdown'
  /** The rowVersion the save was based on; checked on flush. */
  expectedRowVersion: number
  /** ISO 8601 timestamp the save was queued. */
  queuedAt: string
  /** The full SaveLessonInput, minus the body / bodyFormat / rowVersion above. */
  input: {
    title: string
    contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
    videoUrl: string | null
    durationMinutes: number | null
    tags: string[]
    assetId: string | null
  }
}

/**
 * Open the same IndexedDB database the draft mirror uses, but ensure the
 * queue store exists. Bumps the schema to version 2 if the queue store is
 * missing; idempotent if it already exists.
 *
 * This deliberately does NOT use the draft mirror's cache, because adding a
 * store requires a version bump and the mirror's cached connection is at
 * version 1. We open our own connection at version 2; the mirror will pick
 * up the new store the next time its cache is reset (which only happens in
 * tests).
 */
let cachedQueueDb: IDBDatabase | null = null

async function openQueueDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null
  if (cachedQueueDb) return cachedQueueDb
  return new Promise<IDBDatabase | null>((resolve) => {
    // Version 2: ensures both the drafts store (from the mirror) and the
    // queue store exist. The upgrade is idempotent.
    const request = indexedDB.open('abugida-lesson-drafts', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts')
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'lessonPublicId' })
      }
    }
    request.onsuccess = () => {
      cachedQueueDb = request.result
      resolve(cachedQueueDb)
    }
    request.onerror = () => resolve(null)
  })
}

async function getQueueStore(mode: 'readonly' | 'readwrite'): Promise<IDBObjectStore | null> {
  const db = await openQueueDb()
  if (!db) return null
  return db.transaction(QUEUE_STORE_NAME, mode).objectStore(QUEUE_STORE_NAME)
}

/** Test-only: drop the cached connection so a fresh open re-upgrades. */
export function __resetQueueDbCacheForTests(): void {
  if (cachedQueueDb) cachedQueueDb.close()
  cachedQueueDb = null
}

/** Replace the queued save for a lesson. There is at most one per lesson. */
export async function enqueueSave(entry: QueuedSave): Promise<void> {
  const store = await getQueueStore('readwrite')
  if (!store) return
  await new Promise<void>((resolve) => {
    const request = store.put(entry)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

/** Read the queued save for one lesson, or null if none. */
export async function readQueuedSave(lessonPublicId: string): Promise<QueuedSave | null> {
  const store = await getQueueStore('readonly')
  if (!store) return null
  return new Promise((resolve) => {
    const request = store.get(lessonPublicId)
    request.onsuccess = () => resolve((request.result as QueuedSave | undefined) ?? null)
    request.onerror = () => resolve(null)
  })
}

/** Remove the queued save for one lesson. Called after a successful flush. */
export async function clearQueuedSave(lessonPublicId: string): Promise<void> {
  const store = await getQueueStore('readwrite')
  if (!store) return
  await new Promise<void>((resolve) => {
    const request = store.delete(lessonPublicId)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

/** Count of lessons with queued saves — for the offline banner's "N changes". */
export async function countQueuedSaves(): Promise<number> {
  const store = await getQueueStore('readonly')
  if (!store) return 0
  return new Promise((resolve) => {
    const request = store.count()
    request.onsuccess = () => resolve(Number(request.result) || 0)
    request.onerror = () => resolve(0)
  })
}
