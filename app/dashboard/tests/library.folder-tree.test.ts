import { describe, expect, test } from 'bun:test'
import {
  buildTrail,
  isMoveIntoDescendant,
  planFolderDelete,
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
