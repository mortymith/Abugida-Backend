import { describe, expect, test } from 'bun:test'
import {
  canRestoreVersion,
  computeRestoreVersion,
  versionDiffSummary,
  versionLabel,
} from '#/features/media/media.version-restore'
import type { AssetVersionSummary } from '#/features/media/media.version-restore'

const v1: AssetVersionSummary = {
  versionNumber: 1,
  objectKey: 'key-v1',
  fileSizeBytes: 2_000_000,
  mimeType: 'application/pdf',
  uploadedBy: 'u1',
  uploadedAt: 1000,
  note: null,
}
const v2: AssetVersionSummary = {
  versionNumber: 2,
  objectKey: 'key-v2',
  fileSizeBytes: 3_000_000,
  mimeType: 'application/pdf',
  uploadedBy: 'u1',
  uploadedAt: 2000,
  note: 'Updated',
}
const v3: AssetVersionSummary = {
  versionNumber: 3,
  objectKey: 'key-v3',
  fileSizeBytes: 2_500_000,
  mimeType: 'application/pdf',
  uploadedBy: 'u2',
  uploadedAt: 3000,
  note: null,
}

describe('computeRestoreVersion (append-only)', () => {
  test('writes v(n+1) with restored bytes', () => {
    const result = computeRestoreVersion(v1, 3)
    expect(result.newVersionNumber).toBe(4)
    expect(result.restoredFromVersion).toBe(1)
    expect(result.objectKey).toBe('key-v1')
  })
  test('restoring v2 from v5 writes v6', () => {
    const result = computeRestoreVersion(v2, 5)
    expect(result.newVersionNumber).toBe(6)
    expect(result.restoredFromVersion).toBe(2)
  })
})

describe('canRestoreVersion', () => {
  test('permitted when source < current', () => {
    const result = canRestoreVersion(2, 5)
    expect(result.permitted).toBe(true)
    expect(result.reason).toBeNull()
  })
  test('not permitted when source === current (no-op)', () => {
    const result = canRestoreVersion(5, 5)
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('already the current')
  })
  test('not permitted when source > current (does not exist)', () => {
    const result = canRestoreVersion(10, 5)
    expect(result.permitted).toBe(false)
    expect(result.reason).toContain('does not exist')
  })
})

describe('versionLabel', () => {
  test('current tag on current version', () => {
    expect(versionLabel(v3, true)).toBe('v3 (current)')
  })
  test('no tag on non-current', () => {
    expect(versionLabel(v1, false)).toBe('v1')
  })
})

describe('versionDiffSummary', () => {
  test('computes size delta between adjacent versions', () => {
    const diff = versionDiffSummary(v1, v2)
    expect(diff.sizeDelta).toBe(1_000_000)
    expect(diff.sizeDeltaLabel).toContain('larger')
  })
  test('smaller delta when size decreases', () => {
    const diff = versionDiffSummary(v2, v3)
    expect(diff.sizeDelta).toBe(-500_000)
    expect(diff.sizeDeltaLabel).toContain('smaller')
  })
  test('null when prev is null (first version)', () => {
    const diff = versionDiffSummary(null, v1)
    expect(diff.sizeDelta).toBeNull()
    expect(diff.sizeDeltaLabel).toBe('')
  })
})
