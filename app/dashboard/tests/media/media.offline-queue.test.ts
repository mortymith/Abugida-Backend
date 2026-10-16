import { describe, expect, test } from 'bun:test'
import {
  closeWarningMessage,
  deleteOfflineQueueItem,
  nextQueueItem,
  OFFLINE_QUEUE_DB_NAME,
  OFFLINE_QUEUE_STORE,
  orderQueueForFlush,
  pendingUploadCount,
  pendingUploadLabel,
  readOfflineQueue,
  shouldQueueOffline,
  shouldWarnOnClose,
  writeOfflineQueueItem,
} from '#/features/media/media.offline-queue'
import type { OfflineQueueItem } from '#/features/media/media.offline-queue'

describe('shouldQueueOffline', () => {
  test('true when offline', () => {
    expect(shouldQueueOffline(false)).toBe(true)
  })
  test('false when online', () => {
    expect(shouldQueueOffline(true)).toBe(false)
  })
})

describe('orderQueueForFlush', () => {
  const queued: OfflineQueueItem = {
    id: 'q1',
    fileId: 'f1',
    fileName: 'a.mp4',
    totalBytes: 100,
    uploadedBytes: 0,
    status: 'queued',
    queuedAt: 2000,
    lastAttemptAt: null,
    error: null,
  }
  const paused: OfflineQueueItem = {
    id: 'p1',
    fileId: 'f2',
    fileName: 'b.mp4',
    totalBytes: 100,
    uploadedBytes: 50,
    status: 'paused',
    queuedAt: 1000,
    lastAttemptAt: 1500,
    error: null,
  }
  const failed: OfflineQueueItem = {
    id: 'x1',
    fileId: 'f3',
    fileName: 'c.mp4',
    totalBytes: 100,
    uploadedBytes: 30,
    status: 'failed',
    queuedAt: 1500,
    lastAttemptAt: 1600,
    error: 'network',
  }

  test('paused comes first (resume mid-upload)', () => {
    const ordered = orderQueueForFlush([queued, paused, failed])
    expect(ordered[0].id).toBe('p1')
  })
  test('queued comes after paused (FIFO by queuedAt)', () => {
    const ordered = orderQueueForFlush([queued, paused, failed])
    expect(ordered[1].id).toBe('q1')
  })
  test('failed comes last (retry)', () => {
    const ordered = orderQueueForFlush([queued, paused, failed])
    expect(ordered[2].id).toBe('x1')
  })
})

describe('nextQueueItem', () => {
  test('returns first ordered item', () => {
    const items: OfflineQueueItem[] = [
      {
        id: 'q1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 1000,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(nextQueueItem(items)?.id).toBe('q1')
  })
  test('returns null when empty', () => {
    expect(nextQueueItem([])).toBeNull()
  })
})

describe('pendingUploadCount', () => {
  test('counts queued + paused + failed', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
      {
        id: '2',
        fileId: 'f2',
        fileName: 'b',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'paused',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
      {
        id: '3',
        fileId: 'f3',
        fileName: 'c',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'failed',
        queuedAt: 0,
        lastAttemptAt: null,
        error: 'x',
      },
      {
        id: '4',
        fileId: 'f4',
        fileName: 'd',
        totalBytes: 100,
        uploadedBytes: 100,
        status: 'completed',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(pendingUploadCount(items)).toBe(3)
  })
})

describe('pendingUploadLabel', () => {
  test('singular for 1', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(pendingUploadLabel(items)).toBe('1 upload waiting to sync')
  })
  test('plural for 3', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
      {
        id: '2',
        fileId: 'f2',
        fileName: 'b',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
      {
        id: '3',
        fileId: 'f3',
        fileName: 'c',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(pendingUploadLabel(items)).toBe('3 uploads waiting to sync')
  })
  test('empty for 0', () => {
    expect(pendingUploadLabel([])).toBe('')
  })
})

describe('shouldWarnOnClose', () => {
  test('true when uploading', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 50,
        status: 'uploading',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(shouldWarnOnClose(items)).toBe(true)
  })
  test('false when all completed', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 100,
        status: 'completed',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(shouldWarnOnClose(items)).toBe(false)
  })
})

describe('closeWarningMessage', () => {
  test('singular noun for 1 upload', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 50,
        status: 'uploading',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(closeWarningMessage(items)).toContain('1 upload is')
  })
  test('plural noun for 2 uploads', () => {
    const items: OfflineQueueItem[] = [
      {
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 50,
        status: 'uploading',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
      {
        id: '2',
        fileId: 'f2',
        fileName: 'b',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      },
    ]
    expect(closeWarningMessage(items)).toContain('2 uploads are')
  })
})

describe('constants', () => {
  test('db and store names are stable', () => {
    expect(OFFLINE_QUEUE_DB_NAME).toBe('abugida-upload-queue')
    expect(OFFLINE_QUEUE_STORE).toBe('pending-uploads')
  })
})

describe('IndexedDB I/O (graceful when unavailable)', () => {
  test('readOfflineQueue returns [] when IndexedDB unavailable', async () => {
    const result = await readOfflineQueue()
    expect(result).toEqual([])
  })
  test('writeOfflineQueueItem does not throw when unavailable', async () => {
    await expect(
      writeOfflineQueueItem({
        id: '1',
        fileId: 'f1',
        fileName: 'a',
        totalBytes: 100,
        uploadedBytes: 0,
        status: 'queued',
        queuedAt: 0,
        lastAttemptAt: null,
        error: null,
      }),
    ).resolves.toBeUndefined()
  })
  test('deleteOfflineQueueItem does not throw when unavailable', async () => {
    await expect(deleteOfflineQueueItem('1')).resolves.toBeUndefined()
  })
})
