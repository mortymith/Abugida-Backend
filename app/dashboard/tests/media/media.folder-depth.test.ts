import { describe, expect, test } from 'bun:test'
import {
  canCreateSubfolder,
  computeFolderDepth,
  depthExceededMessage,
  keyboardDragAnnouncement,
  keyboardDragReducer,
  MAX_FOLDER_DEPTH,
} from '#/features/media/media.folder-depth'
import type { FolderNode } from '#/features/media/media.folder-depth'

function folder(id: string, parentId: string | null, name: string): FolderNode {
  return { id, parentId, name }
}

describe('computeFolderDepth', () => {
  test('root folder is depth 1', () => {
    const folders = new Map([['f1', folder('f1', null, 'Root')]])
    expect(computeFolderDepth('f1', folders)).toBe(1)
  })
  test('child of root is depth 2', () => {
    const folders = new Map([
      ['f1', folder('f1', null, 'Root')],
      ['f2', folder('f2', 'f1', 'Child')],
    ])
    expect(computeFolderDepth('f2', folders)).toBe(2)
  })
  test('grandchild is depth 3 (exceeds cap)', () => {
    const folders = new Map([
      ['f1', folder('f1', null, 'Root')],
      ['f2', folder('f2', 'f1', 'Child')],
      ['f3', folder('f3', 'f2', 'Grandchild')],
    ])
    expect(computeFolderDepth('f3', folders)).toBe(3)
  })
})

describe('canCreateSubfolder', () => {
  test('permitted at root (depth 1)', () => {
    expect(canCreateSubfolder(null, new Map())).toEqual({ kind: 'permitted' })
  })
  test('permitted under a root folder (creates depth 2)', () => {
    const folders = new Map([['f1', folder('f1', null, 'Root')]])
    expect(canCreateSubfolder('f1', folders)).toEqual({ kind: 'permitted' })
  })
  test('depth_exceeded under a depth-2 folder', () => {
    const folders = new Map([
      ['f1', folder('f1', null, 'Root')],
      ['f2', folder('f2', 'f1', 'Child')],
    ])
    const result = canCreateSubfolder('f2', folders)
    expect(result.kind).toBe('depth_exceeded')
    if (result.kind === 'depth_exceeded') {
      expect(result.suggestedParentId).toBe('f1') // sibling of f2
    }
  })
})

describe('depthExceededMessage', () => {
  test('names the new folder and the current folder', () => {
    const msg = depthExceededMessage('New Folder', 'TOEFL Speaking')
    expect(msg).toContain('2 levels deep')
    expect(msg).toContain('New Folder')
    expect(msg).toContain('TOEFL Speaking')
  })
})

describe('keyboardDragReducer', () => {
  test('pick_up from idle', () => {
    const state = keyboardDragReducer(
      { kind: 'idle' },
      { type: 'pick_up', assetId: 'a1', sourceFolderId: 'f1' },
    )
    expect(state.kind).toBe('picked_up')
  })
  test('move from picked_up', () => {
    const state = keyboardDragReducer(
      { kind: 'picked_up', assetId: 'a1', sourceFolderId: 'f1' },
      { type: 'move', targetFolderId: 'f2' },
    )
    expect(state.kind).toBe('moving')
  })
  test('drop from moving', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', assetId: 'a1', targetFolderId: 'f2' },
      { type: 'drop' },
    )
    expect(state.kind).toBe('dropped')
  })
  test('cancel returns to idle', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', assetId: 'a1', targetFolderId: 'f2' },
      { type: 'cancel' },
    )
    expect(state.kind).toBe('idle')
  })
  test('pick_up ignored when already picked_up', () => {
    const state = keyboardDragReducer(
      { kind: 'picked_up', assetId: 'a1', sourceFolderId: 'f1' },
      { type: 'pick_up', assetId: 'a2', sourceFolderId: 'f2' },
    )
    expect(state.kind).toBe('picked_up')
  })
})

describe('keyboardDragAnnouncement', () => {
  const folderNames = new Map([
    ['f1', 'Root'],
    ['f2', 'Child'],
  ])

  test('picked_up announces instructions', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'picked_up', assetId: 'a1', sourceFolderId: 'f1' },
      folderNames,
    )
    expect(msg).toContain('Picked up')
    expect(msg).toContain('arrows')
  })
  test('moving announces target folder name', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'moving', assetId: 'a1', targetFolderId: 'f2' },
      folderNames,
    )
    expect(msg).toContain('Child')
  })
  test('dropped announces target folder name', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'dropped', assetId: 'a1', targetFolderId: 'f2' },
      folderNames,
    )
    expect(msg).toContain('Dropped')
    expect(msg).toContain('Child')
  })
  test('idle returns empty', () => {
    expect(keyboardDragAnnouncement({ kind: 'idle' }, folderNames)).toBe('')
  })
})

describe('MAX_FOLDER_DEPTH', () => {
  test('is 2 (spec)', () => {
    expect(MAX_FOLDER_DEPTH).toBe(2)
  })
})
