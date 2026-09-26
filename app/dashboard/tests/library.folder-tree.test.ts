import { describe, expect, test } from 'bun:test'
import {
  buildTrail,
  describeFolderDelete,
  isMoveIntoDescendant,
  planFolderDelete,
  viewAfterFolderDelete,
} from '#/features/library/library.folder-tree'

const FOLDERS = [
  { publicId: 'root-a', name: 'Videos', parentId: null },
  { publicId: 'root-b', name: 'PDFs', parentId: null },
  { publicId: 'child-a1', name: 'TOEFL Speaking', parentId: 'root-a' },
  { publicId: 'child-a1-1', name: 'Intro', parentId: 'child-a1' },
]

describe('folder tree rules (spec 05 S-3.4)', () => {
  test('buildTrail walks root → … → folder', () => {
    const trail = buildTrail(FOLDERS, 'child-a1-1')
    expect(trail.map((step) => step.name)).toEqual(['Videos', 'TOEFL Speaking', 'Intro'])
  })

  test('buildTrail for a root folder is a single step', () => {
    expect(buildTrail(FOLDERS, 'root-b').map((step) => step.name)).toEqual(['PDFs'])
  })

  test('buildTrail survives orphaned parents (no infinite loop)', () => {
    const orphaned = [{ publicId: 'x', name: 'X', parentId: 'missing' }]
    expect(buildTrail(orphaned, 'x')).toHaveLength(1)
  })

  test('rejects moving a folder into itself or a descendant', () => {
    expect(isMoveIntoDescendant(FOLDERS, 'root-a', 'root-a')).toBe(true)
    expect(isMoveIntoDescendant(FOLDERS, 'root-a', 'child-a1')).toBe(true)
    expect(isMoveIntoDescendant(FOLDERS, 'root-a', 'child-a1-1')).toBe(true)
    expect(isMoveIntoDescendant(FOLDERS, 'root-a', null)).toBe(false)
    expect(isMoveIntoDescendant(FOLDERS, 'root-a', 'root-b')).toBe(false)
  })

  test('planFolderDelete redistributes assets and reparents direct children', () => {
    const plan = planFolderDelete(FOLDERS, 'child-a1', 12)
    expect(plan).not.toBeNull()
    expect(plan?.assetCountInside).toBe(12)
    expect(plan?.reparentedFolderIds).toEqual(['child-a1-1'])
  })

  test('planFolderDelete for a root folder reparents to null (top level)', () => {
    const plan = planFolderDelete(FOLDERS, 'root-a', 0)
    expect(plan?.reparentedFolderIds).toEqual(['child-a1'])
  })

  test('planFolderDelete returns null for unknown folders', () => {
    expect(planFolderDelete(FOLDERS, 'nope', 0)).toBeNull()
  })
})

describe('viewAfterFolderDelete', () => {
  // Videos → TOEFL Speaking → Intro
  const trail = buildTrail(FOLDERS, 'child-a1-1')

  test('deleting the folder in view falls back to "all"', () => {
    expect(viewAfterFolderDelete(trail, 'child-a1-1', 'child-a1-1')).toBe('all')
  })

  test('deleting an ancestor steps out to its parent', () => {
    expect(viewAfterFolderDelete(trail, 'child-a1-1', 'child-a1')).toBe('root-a')
  })

  test('deleting the root of the trail falls back to "all"', () => {
    expect(viewAfterFolderDelete(trail, 'child-a1-1', 'root-a')).toBe('all')
  })

  test('deleting an unrelated folder leaves the view alone', () => {
    expect(viewAfterFolderDelete(trail, 'child-a1-1', 'root-b')).toBeNull()
  })

  test('a folder outside the trail never moves the view', () => {
    expect(viewAfterFolderDelete([], 'all', 'root-b')).toBeNull()
  })
})

describe('describeFolderDelete', () => {
  test('counts assets and subfolders', () => {
    expect(describeFolderDelete(12, 2)).toBe(
      '12 assets will move to Uncategorized. 2 subfolders will move to this folder’s parent.',
    )
  })

  test('uses singular wording for one of each', () => {
    expect(describeFolderDelete(1, 1)).toBe(
      '1 asset will move to Uncategorized. 1 subfolder will move to this folder’s parent.',
    )
  })

  test('omits lines for a folder with no contents', () => {
    expect(describeFolderDelete(0, 0)).toBe('This folder is empty. Deleting it cannot be undone.')
  })
})
