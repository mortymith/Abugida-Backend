/**
 * @test unit/worker
 * @description Unit tests for the worker runtime.
 */

import { describe, test, expect, mock } from 'bun:test'
import * as RealBullMQ from 'bullmq'
import { JobType, QUEUE_NAMES, mergeWithDefaults } from '@abugida/queue'

// mock.module() overrides are process-global in bun and mock.restore() does
// not unregister them. Spread the real module so every key bullmq actually
// exports (UnrecoverableError, types, helpers...) stays available to test
// files that run after this one; only the classes under test are mocked.
mock.module('bullmq', () => ({
  ...RealBullMQ,
  Queue: mock(() => ({
    add: mock(() => ({ id: 'test' })),
    getJobCounts: mock(() => Promise.resolve({})),
    close: mock(() => Promise.resolve()),
  })),
  Worker: mock(() => ({
    on: mock(() => {}),
    close: mock(() => Promise.resolve()),
  })),
  createBunRedisClient: mock(() => ({ on: mock(() => {}) })),
}))

const CONFIG = mergeWithDefaults({
  redis: { hostname: 'localhost', port: 6379 },
})

const PURCHASE_ENTRY = {
  jobType: JobType.PURCHASE_INITIATE,
  processor: async () => ({ ok: true }),
  queueName: QUEUE_NAMES.PURCHASES,
}

describe('createQueueWorker', () => {
  test('exposes the worker lifecycle surface', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')

    const worker = createQueueWorker(CONFIG, [])
    expect(worker).toBeDefined()
    expect(typeof worker.start).toBe('function')
    expect(typeof worker.stop).toBe('function')
    expect(typeof worker.isRunning).toBe('function')
    expect(typeof worker.registerProcessor).toBe('function')
    expect(worker.activeQueues()).toEqual([])
    expect(worker.isRunning()).toBe(false)
  })

  test('starts one BullMQ worker per queue', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')
    const { processors } = await import('@/runtime/processors')

    const worker = createQueueWorker(
      CONFIG,
      Object.values(processors).filter((entry) => entry.queueName === QUEUE_NAMES.PURCHASES),
    )

    await worker.start()

    expect(worker.isRunning()).toBe(true)
    expect(worker.activeQueues()).toEqual([QUEUE_NAMES.PURCHASES])

    await worker.stop()
    expect(worker.isRunning()).toBe(false)
    expect(worker.activeQueues()).toEqual([])
  })

  test('registers a processor before start, not after', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')

    const worker = createQueueWorker(CONFIG, [PURCHASE_ENTRY])
    worker.registerProcessor({
      jobType: JobType.AUDIT_LOG,
      processor: async () => ({ ok: true }),
      queueName: QUEUE_NAMES.AUDIT,
    })

    await worker.start()
    expect(worker.activeQueues()).toEqual([QUEUE_NAMES.PURCHASES, QUEUE_NAMES.AUDIT])

    expect(() => {
      worker.registerProcessor({
        jobType: JobType.DATA_EXPORT,
        processor: async () => ({ ok: true }),
        queueName: QUEUE_NAMES.EXPORTS,
      })
    }).toThrow('Cannot register processors after the worker has started')

    await worker.stop()
  })
})
