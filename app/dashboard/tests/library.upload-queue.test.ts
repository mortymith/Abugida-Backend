import { describe, expect, test } from 'bun:test'
import {
  findExistingByName,
  uploadQueueReducer,
  validatePickedFile,
} from '#/features/library/library.upload-queue'
import { ASSET_MAX_SIZE_BYTES, ASSET_MIME_LIST } from '#/features/library/library.asset-category'
import type { QueueItem } from '#/features/library/library.upload-queue'

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'file-1',
    fileName: 'lecture.mp4',
    displayName: 'lecture.mp4',
    sizeBytes: 1024,
    contentType: 'video/mp4',
    status: 'queued',
    progress: 0,
    ...overrides,
  }
}

describe('upload queue (spec 05 S-3.2)', () => {
  test('add → progress → done transitions', () => {
    let state = uploadQueueReducer([], { type: 'add', items: [item()] })
    state = uploadQueueReducer(state, { type: 'status', id: 'file-1', status: 'uploading' })
    state = uploadQueueReducer(state, { type: 'progress', id: 'file-1', progress: 150 })
    expect(state[0]?.progress).toBe(100)
    state = uploadQueueReducer(state, { type: 'done', id: 'file-1', assetPublicId: 'a-1' })
    expect(state[0]?.status).toBe('done')
    expect(state[0]?.resultAssetPublicId).toBe('a-1')
  })

  test('errors keep the item for retry and record the message', () => {
    let state = uploadQueueReducer([item()], { type: 'error', id: 'file-1', message: 'boom' })
    expect(state[0]?.status).toBe('error')
    expect(state[0]?.error).toBe('boom')
    state = uploadQueueReducer(state, { type: 'status', id: 'file-1', status: 'queued' })
    expect(state[0]?.status).toBe('queued')
  })

  test('in-flight files cannot be removed or renamed', () => {
    let state = uploadQueueReducer([item()], { type: 'status', id: 'file-1', status: 'uploading' })
    state = uploadQueueReducer(state, { type: 'remove', id: 'file-1' })
    expect(state).toHaveLength(1)
    state = uploadQueueReducer(state, { type: 'rename', id: 'file-1', displayName: 'new name' })
    expect(state[0]?.displayName).toBe('lecture.mp4')
  })

  test('queued files can be removed and renamed', () => {
    let state = uploadQueueReducer([item()], { type: 'remove', id: 'file-1' })
    expect(state).toHaveLength(0)
    state = uploadQueueReducer([item()], { type: 'rename', id: 'file-1', displayName: 'New Name' })
    expect(state[0]?.displayName).toBe('New Name')
  })

  test('findExistingByName is case-insensitive and trimmed (replace checkbox)', () => {
    const existing = [{ publicId: 'a', name: 'TOEFL_Syllabus.pdf ' }]
    expect(findExistingByName(existing, 'toefl_syllabus.pdf')?.publicId).toBe('a')
    expect(findExistingByName(existing, 'other.pdf')).toBeNull()
    expect(findExistingByName(existing, '   ')).toBeNull()
  })

  test('validatePickedFile mirrors the server gate', () => {
    expect(validatePickedFile('a.mp4', 100, null, ASSET_MIME_LIST, ASSET_MAX_SIZE_BYTES)).toBeNull()
    expect(
      validatePickedFile('a.mp4', 100, 'video/mp4', ASSET_MIME_LIST, ASSET_MAX_SIZE_BYTES),
    ).toBeNull()
    expect(
      validatePickedFile('a.xyz', 100, 'text/plain', ASSET_MIME_LIST, ASSET_MAX_SIZE_BYTES)?.code,
    ).toBe('unsupported_type')
    expect(
      validatePickedFile(
        'a.mp4',
        ASSET_MAX_SIZE_BYTES + 1,
        'video/mp4',
        ASSET_MIME_LIST,
        ASSET_MAX_SIZE_BYTES,
      )?.code,
    ).toBe('too_large')
    expect(
      validatePickedFile('a.mp4', 0, 'video/mp4', ASSET_MIME_LIST, ASSET_MAX_SIZE_BYTES)?.code,
    ).toBe('empty')
  })
})
