import { describe, expect, test } from 'bun:test'
import {
  applyRestoreDecision,
  clearDraftMirror,
  DRAFT_MIRROR_DEBOUNCE_MS,
  DRAFT_MIRROR_DB_NAME,
  DRAFT_MIRROR_STORE,
  decideRestore,
  draftMirrorKey,
  readDraftMirror,
  writeDraftMirror,
} from '#/features/courses/courses.draft-mirror'
import type { DraftMirrorEntry } from '#/features/courses/courses.draft-mirror'

describe('draft mirror key', () => {
  test('encodes itemPublicId and rowVersion', () => {
    expect(draftMirrorKey('abc-123', 4)).toBe('draft:item:abc-123:4')
  })
})

describe('decideRestore', () => {
  const entry: DraftMirrorEntry = {
    body: 'unsaved work',
    title: 'Lesson title',
    updatedAt: Date.now(),
    rowVersion: 3,
  }

  test('no mirror → no-mirror', () => {
    expect(decideRestore(null, 3)).toEqual({ kind: 'no-mirror' })
  })

  test('mirror.version === server.version with body → restore', () => {
    const result = decideRestore(entry, 3)
    expect(result.kind).toBe('restore')
    if (result.kind === 'restore') {
      expect(result.entry.body).toBe('unsaved work')
    }
  })

  test('mirror.version < server.version → conflict (never silent restore)', () => {
    const result = decideRestore(entry, 5)
    expect(result.kind).toBe('conflict')
    if (result.kind === 'conflict') {
      expect(result.entry.body).toBe('unsaved work')
      expect(result.serverRowVersion).toBe(5)
    }
  })

  test('empty mirror body → no-mirror', () => {
    const emptyEntry: DraftMirrorEntry = {
      body: '',
      title: '',
      updatedAt: Date.now(),
      rowVersion: 3,
    }
    expect(decideRestore(emptyEntry, 3)).toEqual({ kind: 'no-mirror' })
  })
})

describe('applyRestoreDecision', () => {
  const entry: DraftMirrorEntry = {
    body: 'mirror body',
    title: 'mirror title',
    updatedAt: Date.now(),
    rowVersion: 3,
  }

  test('restore action uses mirror body/title', () => {
    const decision = { kind: 'restore' as const, entry }
    const result = applyRestoreDecision(decision, 'restore', 'server body', 'server title')
    expect(result.body).toBe('mirror body')
    expect(result.title).toBe('mirror title')
    expect(result.clearMirror).toBe(false)
  })

  test('discard action uses server body/title and clears mirror', () => {
    const decision = { kind: 'restore' as const, entry }
    const result = applyRestoreDecision(decision, 'discard', 'server body', 'server title')
    expect(result.body).toBe('server body')
    expect(result.title).toBe('server title')
    expect(result.clearMirror).toBe(true)
  })

  test('keep-mine on conflict uses mirror body', () => {
    const decision = {
      kind: 'conflict' as const,
      entry,
      serverRowVersion: 5,
    }
    const result = applyRestoreDecision(decision, 'keep-mine', 'server body', 'server title')
    expect(result.body).toBe('mirror body')
    expect(result.title).toBe('mirror title')
    expect(result.clearMirror).toBe(false)
  })

  test('take-theirs on conflict uses server body and clears mirror', () => {
    const decision = {
      kind: 'conflict' as const,
      entry,
      serverRowVersion: 5,
    }
    const result = applyRestoreDecision(decision, 'take-theirs', 'server body', 'server title')
    expect(result.body).toBe('server body')
    expect(result.title).toBe('server title')
    expect(result.clearMirror).toBe(true)
  })
})

describe('constants', () => {
  test('debounce is 1000ms per spec', () => {
    expect(DRAFT_MIRROR_DEBOUNCE_MS).toBe(1000)
  })

  test('db and store names are stable', () => {
    expect(DRAFT_MIRROR_DB_NAME).toBe('abugida-drafts')
    expect(DRAFT_MIRROR_STORE).toBe('item-drafts')
  })
})

describe('IndexedDB I/O (graceful when unavailable)', () => {
  test('readDraftMirror returns null when IndexedDB is unavailable', async () => {
    // In a non-DOM test environment, IndexedDB is undefined; the function
    // should resolve null rather than reject.
    const result = await readDraftMirror('item-1', 1)
    expect(result).toBeNull()
  })

  test('writeDraftMirror does not throw when IndexedDB is unavailable', async () => {
    await expect(
      writeDraftMirror('item-1', 1, {
        body: 'test',
        title: 'test',
        updatedAt: Date.now(),
        rowVersion: 1,
      }),
    ).resolves.toBeUndefined()
  })

  test('clearDraftMirror does not throw when IndexedDB is unavailable', async () => {
    await expect(clearDraftMirror('item-1', 1)).resolves.toBeUndefined()
  })
})
