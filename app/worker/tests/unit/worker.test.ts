/**
 * @test unit/worker
 * @description Unit tests for the worker runtime.
 */

import { describe, test, expect, mock } from 'bun:test'
import * as RealBullMQ from 'bullmq'
import { JobType, QUEUE_NAMES, mergeWithDefaults } from '@abugida/queue'
import type { AnyProcessorEntry } from '@/runtime/types'

// mock.module() overrides are process-global in bun and mock.restore() does
// not unregister them. Spread the real module so every key bullmq actually
// exports (UnrecoverableError, types, helpers...) stays available to test
// files that run after this one; only the classes under test are mocked.
//
// The Worker mock records every instance it hands out so tests can control
// the close behaviour of a single BullMQ worker (the runtime creates them
// internally, one per queue).
const createdWorkers: Array<{
  on: ReturnType<typeof mock>
  close: ReturnType<typeof mock>
}> = []

mock.module('bullmq', () => ({
  ...RealBullMQ,
  Queue: mock(() => ({
    add: mock(() => ({ id: 'test' })),
    getJobCounts: mock(() => Promise.resolve({})),
    close: mock(() => Promise.resolve()),
  })),
  Worker: mock(() => {
    const instance = {
      on: mock(() => {}),
      close: mock(() => Promise.resolve()),
    }
    createdWorkers.push(instance)
    return instance
  }),
  createBunRedisClient: mock(() => ({
    on: mock(() => {}),
    quit: mock(() => Promise.resolve()),
  })),
}))

const CONFIG = mergeWithDefaults({
  redis: { hostname: 'localhost', port: 6379 },
})

const PURCHASE_ENTRY: AnyProcessorEntry = {
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

  test('stop closes the per-queue BullMQ connections', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')
    const { createBullMQConnection, closeConnection } = await import('@abugida/queue')
    const { processors } = await import('@/runtime/processors')

    const worker = createQueueWorker(
      CONFIG,
      Object.values(processors).filter((entry) => entry.queueName === QUEUE_NAMES.PURCHASES),
    )
    await worker.start()

    // While the worker runs, the connection is the cached one it created.
    const purpose = `consumer:${QUEUE_NAMES.PURCHASES}`
    const whileRunning = createBullMQConnection(CONFIG, purpose)
    expect(worker.isRunning()).toBe(true)

    await worker.stop()

    // After stop the cache entry is gone: the next call builds a fresh one.
    const afterStop = createBullMQConnection(CONFIG, purpose)
    expect(afterStop).not.toBe(whileRunning)
    await closeConnection(CONFIG, purpose)
  })

  test('stop forces the close of a stuck BullMQ worker after the timeout', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')
    const { processors } = await import('@/runtime/processors')

    const worker = createQueueWorker(
      CONFIG,
      Object.values(processors).filter((entry) => entry.queueName === QUEUE_NAMES.PURCHASES),
      { closeTimeoutMs: 25 },
    )
    await worker.start()

    // Simulate a worker that never finishes closing (a job stuck forever).
    const stuck = createdWorkers.at(-1)
    expect(stuck).toBeDefined()
    let releaseStuckClose: () => void = () => {}
    stuck!.close = mock(
      () =>
        new Promise<void>((resolve) => {
          releaseStuckClose = resolve
        }),
    )

    const stop = worker.stop()
    await expect(
      Promise.race([
        stop.then(() => 'stopped'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000)),
      ]),
    ).resolves.toBe('stopped')

    expect(worker.isRunning()).toBe(false)
    releaseStuckClose()
  })

  test('stop waits for a graceful close that finishes in time', async () => {
    const { createQueueWorker } = await import('@/runtime/worker')
    const { processors } = await import('@/runtime/processors')

    const worker = createQueueWorker(
      CONFIG,
      Object.values(processors).filter((entry) => entry.queueName === QUEUE_NAMES.PURCHASES),
      { closeTimeoutMs: 5000 },
    )
    await worker.start()

    const closable = createdWorkers.at(-1)
    expect(closable).toBeDefined()
    closable!.close = mock(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

    await worker.stop()
    expect(worker.isRunning()).toBe(false)
  })
})
