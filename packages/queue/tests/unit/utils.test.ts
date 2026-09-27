/**
 * @test unit/utils
 * @description Unit tests for utility modules (idempotency, validators, errors).
 *
 * Note: retry/backoff is intentionally absent. BullMQ owns retrying via
 * `attempts` + `backoff` job options (see `config/schema.ts`); the package
 * does not ship its own retry wrapper.
 */

import { describe, test, expect } from 'bun:test'

// ---------------------------------------------------------------------------
// Error Classification Tests
// ---------------------------------------------------------------------------

describe('Error Utilities', () => {
  test('classifyError should identify connection errors', async () => {
    const { classifyError } = await import('../../src/utils/errors.js')

    expect(classifyError(new Error('ECONNREFUSED'))).toBe('connection')
    expect(classifyError(new Error('connection timeout'))).toBe('connection')
    expect(classifyError(new Error('timeout exceeded')).includes('timeout'))
    expect(classifyError(new Error('some other error'))).toBe('unknown')
  })

  test('safeErrorMessage should not leak internals', async () => {
    const { safeErrorMessage } = await import('../../src/utils/errors.js')

    expect(safeErrorMessage(new Error('secret password exposed'))).toBe(
      'An internal error occurred',
    )
  })
})

// ---------------------------------------------------------------------------
// Validator Tests
// ---------------------------------------------------------------------------

describe('Validators', () => {
  test('validateJobData should validate PURCHASE_INITIATE', async () => {
    const { validateJobData } = await import('../../src/utils/validators.js')
    const { JobType } = await import('../../src/core/types.js')

    // Valid data
    const valid = validateJobData(JobType.PURCHASE_INITIATE, {
      userId: 'user-1',
      courseId: 'course-1',
      amount: 500,
      currency: 'ETB',
      paymentMethod: 'telebirr',
      idempotencyKey: 'key-1',
    })
    expect(valid.valid).toBe(true)
    expect(valid.errors).toHaveLength(0)

    // Missing required fields
    const invalid = validateJobData(JobType.PURCHASE_INITIATE, {
      userId: '',
      courseId: 'course-1',
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.length).toBeGreaterThan(0)
  })

  test('validateJobData should validate WEBHOOK_PROCESS with enum', async () => {
    const { validateJobData } = await import('../../src/utils/validators.js')
    const { JobType } = await import('../../src/core/types.js')

    // Invalid source
    const invalid = validateJobData(JobType.WEBHOOK_PROCESS, {
      source: 'unknown_provider',
      payload: {},
      headers: {},
      idempotencyKey: 'key-1',
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.some((e) => e.includes('source'))).toBe(true)

    // Valid source
    const valid = validateJobData(JobType.WEBHOOK_PROCESS, {
      source: 'telebirr',
      payload: { data: 'test' },
      headers: { 'content-type': 'application/json' },
      idempotencyKey: 'key-1',
    })
    expect(valid.valid).toBe(true)
  })

  test('validateJobData should reject unknown job types', async () => {
    const { validateJobData } = await import('../../src/utils/validators.js')

    const result = validateJobData('UNKNOWN_JOB' as any, {})
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Unknown job type')
  })
})
