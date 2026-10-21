/**
 * Spec 12 § 8.1.2 — offline save queue round-trip.
 *
 * Verifies the queue's storage helpers behave correctly:
 *  - `enqueueSave` writes one entry per lesson.
 *  - `readQueuedSave` returns it.
 *  - `clearQueuedSave` removes it.
 *  - A second enqueue for the same lesson replaces the first (the queue is
 *    keyed by lessonPublicId, so only the latest save replays on reconnect).
 *  - `countQueuedSaves` reports the right depth for the offline banner.
 */
import { test, expect, beforeEach, afterEach } from 'bun:test'
import fakeIndexedDB, { IDBKeyRange as fakeKeyRange } from 'fake-indexeddb'
import {
  QUEUE_STORE_NAME,
  __resetQueueDbCacheForTests,
  enqueueSave,
  readQueuedSave,
  clearQueuedSave,
  countQueuedSaves,
} from '#/features/courses/hooks/courses.markdown-offline-queue'

import type { QueuedSave } from '#/features/courses/hooks/courses.markdown-offline-queue'

;(globalThis as unknown as { indexedDB: typeof fakeIndexedDB }).indexedDB = fakeIndexedDB
;(globalThis as unknown as { IDBKeyRange: typeof fakeKeyRange }).IDBKeyRange = fakeKeyRange

function makeEntry(lessonPublicId: string, body: string, rowVersion: number): QueuedSave {
  return {
    lessonPublicId,
    body,
    bodyFormat: 'markdown',
    expectedRowVersion: rowVersion,
    queuedAt: new Date().toISOString(),
    input: {
      title: 'Test Lesson',
      contentType: 'video',
      videoUrl: null,
      durationMinutes: null,
      tags: [],
      assetId: null,
    },
  }
}

beforeEach(async () => {
  __resetQueueDbCacheForTests()
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDB.deleteDatabase('abugida-lesson-drafts')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

afterEach(async () => {
  __resetQueueDbCacheForTests()
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDB.deleteDatabase('abugida-lesson-drafts')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

test('QUEUE_STORE_NAME is the spec value', () => {
  expect(QUEUE_STORE_NAME).toBe('offline-save-queue')
})

test('enqueueSave then readQueuedSave round-trips an entry', async () => {
  const entry = makeEntry('item-1', '## Hello', 5)
  await enqueueSave(entry)
  const read = await readQueuedSave('item-1')
  expect(read).not.toBeNull()
  expect(read?.body).toBe('## Hello')
  expect(read?.expectedRowVersion).toBe(5)
  expect(read?.bodyFormat).toBe('markdown')
})

test('readQueuedSave returns null when the lesson has no queue entry', async () => {
  const read = await readQueuedSave('item-2')
  expect(read).toBeNull()
})

test('clearQueuedSave removes an entry', async () => {
  await enqueueSave(makeEntry('item-3', 'body', 1))
  await clearQueuedSave('item-3')
  const read = await readQueuedSave('item-3')
  expect(read).toBeNull()
})

test('a second enqueue for the same lesson replaces the first', async () => {
  // Spec 12 § 8.1.2: subsequent queued writes for the same lesson are not
  // discarded — they replace the head, so only the latest save replays on
  // reconnect. The earlier save's rowVersion is lost, but the IndexedDB
  // mirror still has the body if the author needs to recover it.
  await enqueueSave(makeEntry('item-4', 'first body', 1))
  await enqueueSave(makeEntry('item-4', 'second body', 2))
  const read = await readQueuedSave('item-4')
  expect(read?.body).toBe('second body')
  expect(read?.expectedRowVersion).toBe(2)
})

test('countQueuedSaves reports the right depth across lessons', async () => {
  expect(await countQueuedSaves()).toBe(0)
  await enqueueSave(makeEntry('item-a', 'a', 1))
  await enqueueSave(makeEntry('item-b', 'b', 1))
  await enqueueSave(makeEntry('item-c', 'c', 1))
  expect(await countQueuedSaves()).toBe(3)
  // Re-enqueueing item-b does not increase the count.
  await enqueueSave(makeEntry('item-b', 'b2', 2))
  expect(await countQueuedSaves()).toBe(3)
  await clearQueuedSave('item-a')
  expect(await countQueuedSaves()).toBe(2)
})
