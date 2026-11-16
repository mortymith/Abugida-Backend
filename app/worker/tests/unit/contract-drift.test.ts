/**
 * @test unit/contract-drift
 * @description Contract-drift guards between `@abugida/queue` and the worker
 * app (ADR-028 §5):
 *
 * 1. every `JobType` has exactly one processor,
 * 2. every processor's `queueName` is the queue `JOB_QUEUE_MAP` assigns to it,
 * 3. a valid fixture for every job type passes `validateJobData`.
 *
 * The compile-time half of the guarantee lives in
 * `src/runtime/processors.ts` (`satisfies ProcessorEntries`); these tests are
 * the runtime half, so a contract change that compiles still cannot silently
 * drift.
 */

import { describe, expect, test } from 'bun:test'
import {
  JOB_QUEUE_MAP,
  JobType,
  QUEUE_NAMES,
  validateJobData,
  type JobDataMap,
} from '@abugida/queue'

import { allProcessors, processors } from '@/runtime/processors'
import { ProcessorRegistry } from '@/runtime/registry'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * One valid payload per job type. Adding a `JobType` to the contract makes
 * this file fail to typecheck until a fixture is added here.
 */
const FIXTURES = {
  [JobType.PURCHASE_INITIATE]: {
    userId: 'user-1',
    courseId: 'course-1',
    amount: 500,
    currency: 'ETB',
    paymentMethod: 'telebirr',
    idempotencyKey: 'key-1',
  },
  [JobType.PURCHASE_COMPLETE]: {
    purchaseId: 'purchase-1',
    transactionId: 'txn-1',
    status: 'success',
    callbackPayload: {},
    idempotencyKey: 'key-1',
  },
  [JobType.BUNDLE_ENROLLMENT_CREATE]: {
    userId: 'user-1',
    bundleId: 'bundle-1',
    courseIds: ['course-1'],
    idempotencyKey: 'key-1',
  },
  [JobType.ENROLLMENT_PROGRESS_UPDATE]: {
    enrollmentId: 'enrollment-1',
    completedLessons: 3,
    totalLessons: 10,
    idempotencyKey: 'key-1',
  },
  [JobType.DATA_EXPORT]: {
    userId: 'user-1',
    format: 'json',
    requestedAt: '2026-01-01T00:00:00.000Z',
    idempotencyKey: 'key-1',
  },
  [JobType.WEBHOOK_PROCESS]: {
    source: 'telebirr',
    payload: {},
    headers: {},
    idempotencyKey: 'key-1',
  },
  [JobType.SMS_NOTIFICATION]: {
    recipientPhone: '+251912345678',
    message: 'Hello',
    idempotencyKey: 'key-1',
  },
  [JobType.EMAIL_NOTIFICATION]: {
    recipientEmail: 'user@example.com',
    subject: 'Hello',
    htmlBody: '<p>Hello</p>',
    idempotencyKey: 'key-1',
  },
  [JobType.MODERATION_SUBMIT]: {
    entityType: 'comment',
    entityId: 'comment-1',
    content: 'Hello',
    submittedBy: 'user-1',
    idempotencyKey: 'key-1',
  },
  [JobType.RECALCULATE_STATS]: {
    courseId: 'course-1',
    idempotencyKey: 'key-1',
  },
  [JobType.AGGREGATE_METRICS]: {
    period: 'daily',
    date: '2026-01-01',
    idempotencyKey: 'key-1',
  },
  [JobType.AUDIT_LOG]: {
    action: 'test_action',
    actorId: 'user-1',
    entityType: 'test',
    entityId: 'test-entity',
    metadata: {},
    idempotencyKey: 'key-1',
  },
  [JobType.MAINTENANCE_TASK]: {
    taskName: 'session_cleanup',
    params: {},
    idempotencyKey: 'key-1',
  },
  [JobType.DATA_RETENTION]: {
    entityType: 'session',
    olderThanDays: 90,
    batchSize: 100,
    idempotencyKey: 'key-1',
  },
} satisfies { [T in JobType]: JobDataMap[T] }

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

describe('contract coverage', () => {
  test('every job type has exactly one processor', () => {
    const jobTypes = Object.values(JobType)
    const registered = Object.keys(processors) as JobType[]

    expect(registered).toHaveLength(jobTypes.length)
    for (const jobType of jobTypes) {
      expect(registered).toContain(jobType)
    }
  })

  test('the flattened aggregate matches the registry', () => {
    const registry = new ProcessorRegistry(allProcessors)

    expect(registry.getJobTypes()).toHaveLength(Object.values(JobType).length)
    expect(allProcessors).toHaveLength(Object.values(processors).length)
  })

  test('every fixture validates against the contract', () => {
    for (const jobType of Object.values(JobType)) {
      const result = validateJobData(jobType, FIXTURES[jobType])
      expect(result.errors).toEqual([])
      expect(result.valid).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Queue assignment
// ---------------------------------------------------------------------------

describe('queue assignment', () => {
  test('each processor runs on the queue JOB_QUEUE_MAP assigns', () => {
    for (const entry of allProcessors) {
      expect(entry.queueName).toBe(JOB_QUEUE_MAP[entry.jobType])
    }
  })

  test('every queue declared by the contract is consumed by someone', () => {
    const consumed = new Set(allProcessors.map((entry) => entry.queueName))

    for (const queueName of Object.values(QUEUE_NAMES)) {
      expect(consumed.has(queueName)).toBe(true)
    }
  })
})
