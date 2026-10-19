/**
 * @test helpers/bullmq-mock
 * @description Shared BullMQ module mock for unit tests. Bun's
 * `mock.module` overrides are process-global for the whole `bun test` run,
 * so a partial mock registered by one suite (client, worker) leaks into
 * every other suite that imports a name the mock omits — historically the
 * cause of `Export named 'UnrecoverableError' not found` failures in the
 * processor suites. Register the mock through this helper so the surface
 * stays complete and defined in one place; add new bullmq imports here
 * when src starts importing them.
 */

import { mock } from 'bun:test'

/**
 * Thrown by processors to fail a job regardless of remaining attempts.
 * Real class semantics (extends Error) so `toBeInstanceOf` assertions in
 * the processor suites hold against the same class object the mocked
 * processors throw.
 */
class UnrecoverableError extends Error {
  constructor(message = 'bullmq:unrecoverable') {
    super(message)
    this.name = 'UnrecoverableError'
  }
}

type MockQueueInstance = {
  add: ReturnType<typeof mock>
  addBulk: ReturnType<typeof mock>
  getJobCounts: ReturnType<typeof mock>
  close: ReturnType<typeof mock>
}

/**
 * Register the process-global bullmq mock. Returns the mocked `Queue`
 * instance methods so suites can retarget their return values per test.
 */
function mockBullMQ(): { queue: MockQueueInstance } {
  const queue: MockQueueInstance = {
    add: mock(() => ({ id: 'test-job-id', name: 'PURCHASE_INITIATE' })),
    addBulk: mock(() => [{ id: 'bulk-job-1' }, { id: 'bulk-job-2' }]),
    getJobCounts: mock(() =>
      Promise.resolve({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      }),
    ),
    close: mock(() => Promise.resolve()),
  }

  mock.module('bullmq', () => ({
    Queue: mock(() => queue),
    Worker: mock(() => ({
      on: mock(() => {}),
      close: mock(() => Promise.resolve()),
    })),
    createBunRedisClient: mock(() => ({ on: mock(() => {}) })),
    UnrecoverableError,
  }))

  return { queue }
}

export { mockBullMQ, UnrecoverableError }
