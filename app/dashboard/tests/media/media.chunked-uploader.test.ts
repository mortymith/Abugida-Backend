import { describe, expect, test } from 'bun:test'
import {
  classifyUploadFailure,
  computeChunkCount,
  computeChunkRange,
  computeNextPartNumber,
  computeResumeOffset,
  computeUploadProgress,
  formatBytes,
  isCheckpointStale,
  shouldCheckpoint,
  sizeBucket,
  UPLOAD_FAILURE_ACTIONS,
  CHUNK_SIZE_BYTES,
  CHECKPOINT_INTERVAL_MS,
} from '#/features/media/media.chunked-uploader'

describe('chunk constants', () => {
  test('chunk size is 8 MB', () => {
    expect(CHUNK_SIZE_BYTES).toBe(8 * 1024 * 1024)
  })
  test('checkpoint interval is 10 s', () => {
    expect(CHECKPOINT_INTERVAL_MS).toBe(10_000)
  })
})

describe('classifyUploadFailure', () => {
  test('HTTP 413 → oversize', () => {
    const result = classifyUploadFailure({ kind: 'http', status: 413 })
    expect(result.reason).toBe('oversize')
    expect(result.message).toContain('limit')
    expect(result.actions).toContain('remove')
  })

  test('HTTP 415 → format_unsupported', () => {
    const result = classifyUploadFailure({ kind: 'http', status: 415 })
    expect(result.reason).toBe('format_unsupported')
    expect(result.actions).toContain('remove')
  })

  test('HTTP 507 → storage_full', () => {
    const result = classifyUploadFailure({ kind: 'http', status: 507 })
    expect(result.reason).toBe('storage_full')
  })

  test('HTTP 500 → server_error', () => {
    const result = classifyUploadFailure({ kind: 'http', status: 500 })
    expect(result.reason).toBe('server_error')
    expect(result.actions).toContain('retry')
  })

  test('network error → network_lost', () => {
    const result = classifyUploadFailure({ kind: 'network' }, { atPercent: 42 })
    expect(result.reason).toBe('network_lost')
    expect(result.message).toContain('42%')
    expect(result.actions).toContain('resume')
    expect(result.actions).toContain('retry_from_start')
  })

  test('validation reason passes through', () => {
    const result = classifyUploadFailure({ kind: 'validation', reason: 'malware_scan_failed' })
    expect(result.reason).toBe('malware_scan_failed')
    expect(result.actions).toContain('remove')
  })
})

describe('UPLOAD_FAILURE_ACTIONS', () => {
  test('network_lost offers resume and retry_from_start', () => {
    expect(UPLOAD_FAILURE_ACTIONS.network_lost).toEqual(['resume', 'retry_from_start'])
  })
  test('oversize only offers remove', () => {
    expect(UPLOAD_FAILURE_ACTIONS.oversize).toEqual(['remove'])
  })
})

describe('computeChunkCount', () => {
  test('1 file exactly 8 MB → 1 chunk', () => {
    expect(computeChunkCount(8 * 1024 * 1024)).toBe(1)
  })
  test('8 MB + 1 byte → 2 chunks', () => {
    expect(computeChunkCount(8 * 1024 * 1024 + 1)).toBe(2)
  })
  test('45 MB → 6 chunks (5 full + 1 partial)', () => {
    expect(computeChunkCount(45 * 1024 * 1024)).toBe(6)
  })
  test('0 bytes → 0 chunks', () => {
    expect(computeChunkCount(0)).toBe(0)
  })
})

describe('computeChunkRange', () => {
  test('part 1 of a 45 MB file starts at 0', () => {
    const total = 45 * 1024 * 1024
    const range = computeChunkRange(total, 1)
    expect(range.start).toBe(0)
    expect(range.size).toBe(8 * 1024 * 1024)
  })
  test('last part is smaller than chunk size', () => {
    const total = 45 * 1024 * 1024
    const lastPart = computeChunkCount(total)
    const range = computeChunkRange(total, lastPart)
    expect(range.size).toBe(total - (lastPart - 1) * 8 * 1024 * 1024)
    expect(range.end).toBe(total)
  })
})

describe('computeResumeOffset', () => {
  test('sums uploaded part sizes', () => {
    const parts = [
      { partNumber: 1, size: 8 * 1024 * 1024 },
      { partNumber: 2, size: 8 * 1024 * 1024 },
    ]
    expect(computeResumeOffset(parts)).toBe(16 * 1024 * 1024)
  })
  test('empty parts → 0', () => {
    expect(computeResumeOffset([])).toBe(0)
  })
})

describe('computeNextPartNumber', () => {
  test('empty → part 1', () => {
    expect(computeNextPartNumber([])).toBe(1)
  })
  test('3 parts uploaded → part 4', () => {
    const parts = [
      { partNumber: 1, size: 8 },
      { partNumber: 2, size: 8 },
      { partNumber: 3, size: 8 },
    ]
    expect(computeNextPartNumber(parts)).toBe(4)
  })
})

describe('computeUploadProgress', () => {
  test('0% at start', () => {
    expect(computeUploadProgress(0, 100)).toBe(0)
  })
  test('50% at halfway', () => {
    expect(computeUploadProgress(50, 100)).toBe(50)
  })
  test('100% at completion', () => {
    expect(computeUploadProgress(100, 100)).toBe(100)
  })
  test('capped at 100%', () => {
    expect(computeUploadProgress(150, 100)).toBe(100)
  })
  test('0 bytes total → 0%', () => {
    expect(computeUploadProgress(0, 0)).toBe(0)
  })
})

describe('shouldCheckpoint', () => {
  test('true when no previous checkpoint', () => {
    expect(shouldCheckpoint(null, 0, Date.now())).toBe(true)
  })
  test('true when 8 MB crossed since last checkpoint', () => {
    const last = { uploadedBytes: 0, at: Date.now() }
    expect(shouldCheckpoint(last, 8 * 1024 * 1024, Date.now())).toBe(true)
  })
  test('true when 10 s crossed since last checkpoint', () => {
    const now = Date.now()
    const last = { uploadedBytes: 1000, at: now - 11_000 }
    expect(shouldCheckpoint(last, 2000, now)).toBe(true)
  })
  test('false when neither threshold crossed', () => {
    const now = Date.now()
    const last = { uploadedBytes: 0, at: now }
    expect(shouldCheckpoint(last, 1000, now)).toBe(false)
  })
})

describe('isCheckpointStale', () => {
  test('true when past 7 days', () => {
    const now = Date.now()
    const checkpoint = {
      assetDraftId: 'd1',
      objectKey: 'key',
      multipartUploadId: null,
      totalBytes: 100,
      uploadedBytes: 50,
      lastChunkAt: now - 8 * 24 * 60 * 60 * 1000,
      status: 'paused' as const,
    }
    expect(isCheckpointStale(checkpoint, now)).toBe(true)
  })
  test('false when within 7 days', () => {
    const now = Date.now()
    const checkpoint = {
      assetDraftId: 'd1',
      objectKey: 'key',
      multipartUploadId: null,
      totalBytes: 100,
      uploadedBytes: 50,
      lastChunkAt: now - 1 * 24 * 60 * 60 * 1000,
      status: 'uploading' as const,
    }
    expect(isCheckpointStale(checkpoint, now)).toBe(false)
  })
})

describe('formatBytes', () => {
  test('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })
  test('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
  test('formats MB', () => {
    expect(formatBytes(45 * 1024 * 1024)).toBe('45.0 MB')
  })
  test('formats GB', () => {
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB')
  })
})

describe('sizeBucket', () => {
  test('<1MB', () => {
    expect(sizeBucket(500 * 1024)).toBe('<1MB')
  })
  test('1-10MB', () => {
    expect(sizeBucket(5 * 1024 * 1024)).toBe('1-10MB')
  })
  test('10-100MB', () => {
    expect(sizeBucket(45 * 1024 * 1024)).toBe('10-100MB')
  })
  test('100-500MB', () => {
    expect(sizeBucket(200 * 1024 * 1024)).toBe('100-500MB')
  })
  test('>500MB', () => {
    expect(sizeBucket(600 * 1024 * 1024)).toBe('>500MB')
  })
})
