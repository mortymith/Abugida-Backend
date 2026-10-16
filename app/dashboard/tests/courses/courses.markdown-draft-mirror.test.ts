/**
 * Spec 12 § 8.1.1 — IndexedDB draft mirror round-trip.
 *
 * Verifies the three guarantees the mirror makes:
 *  1. A draft written at rowVersion N is read back identically.
 *  2. `clearDraft` removes the key.
 *  3. `draftKey` produces the canonical `draft:item:<id>:<rv>` shape that
 *     Part 04 S-2.7 declares, so a draft written by one build is readable by
 *     another.
 *
 * The React hook is exercised by the editor's manual + E2E pass; this test
 * covers the pure storage helpers and the key format, which are the parts
 * that have to survive a build mismatch.
 */
import { test, expect, beforeEach, afterEach } from 'bun:test'
import fakeIndexedDB, { IDBKeyRange as fakeKeyRange } from 'fake-indexeddb'
import {
  DRAFT_MIRROR_DEBOUNCE_MS,
  draftKey,
  readDraft,
  writeDraft,
  clearDraft,
  __resetDraftsDbCacheForTests,
  type LessonDraftMirror,
} from '#/features/courses/hooks/courses.markdown-draft-mirror'

// Inject the fake IndexedDB before any test opens a database. The module
// checks `typeof indexedDB === 'undefined'` at call time, so the injection
// works even though the file was imported above.
;(globalThis as unknown as { indexedDB: typeof fakeIndexedDB }).indexedDB = fakeIndexedDB
;(globalThis as unknown as { IDBKeyRange: typeof fakeKeyRange }).IDBKeyRange = fakeKeyRange

beforeEach(async () => {
  __resetDraftsDbCacheForTests()
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDB.deleteDatabase('abugida-lesson-drafts')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

afterEach(async () => {
  __resetDraftsDbCacheForTests()
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDB.deleteDatabase('abugida-lesson-drafts')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

test('draftKey produces the canonical Part 04 S-2.7 shape', () => {
  expect(draftKey('7f3c2a2a-1b2c-4d4e-8a2a-000000000001', 7)).toBe(
    'draft:item:7f3c2a2a-1b2c-4d4e-8a2a-000000000001:7',
  )
})

test('DRAFT_MIRROR_DEBOUNCE_MS is the spec value (1000ms)', () => {
  // Spec 12 § 8.1.1 "Cadence: 1000 ms debounce, independent of the 60s server
  // autosave".
  expect(DRAFT_MIRROR_DEBOUNCE_MS).toBe(1_000)
})

test('writeDraft then readDraft round-trips a payload', async () => {
  const key = draftKey('item-1', 3)
  const draft: LessonDraftMirror = {
    body: '## Intro\n\nThis is a draft body.',
    title: 'Advanced Tonal Patterns',
    updatedAt: '2026-10-17T10:00:00.000Z',
    rowVersion: 3,
  }
  await writeDraft(key, draft)
  const readBack = await readDraft(key)
  expect(readBack).not.toBeNull()
  expect(readBack?.body).toBe(draft.body)
  expect(readBack?.title).toBe(draft.title)
  expect(readBack?.rowVersion).toBe(3)
})

test('readDraft returns null when the key is absent', async () => {
  const readBack = await readDraft(draftKey('item-2', 1))
  expect(readBack).toBeNull()
})

test('clearDraft removes a written draft', async () => {
  const key = draftKey('item-3', 5)
  await writeDraft(key, {
    body: 'draft',
    title: 'T',
    updatedAt: new Date().toISOString(),
    rowVersion: 5,
  })
  await clearDraft(key)
  const readBack = await readDraft(key)
  expect(readBack).toBeNull()
})

test('a draft written at rowVersion N does not collide with rowVersion N+1', async () => {
  const id = 'item-4'
  const draftOld: LessonDraftMirror = {
    body: 'old body',
    title: 'Old',
    updatedAt: '2026-10-15T10:00:00.000Z',
    rowVersion: 4,
  }
  const draftNew: LessonDraftMirror = {
    body: 'new body',
    title: 'New',
    updatedAt: '2026-10-17T10:00:00.000Z',
    rowVersion: 5,
  }
  await writeDraft(draftKey(id, 4), draftOld)
  await writeDraft(draftKey(id, 5), draftNew)
  // Both keys coexist; the restore logic picks based on the rowVersion the
  // server reports.
  expect((await readDraft(draftKey(id, 4)))?.body).toBe('old body')
  expect((await readDraft(draftKey(id, 5)))?.body).toBe('new body')
})
