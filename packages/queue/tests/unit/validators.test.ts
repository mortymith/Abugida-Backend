/**
 * @test unit/validators
 * @description Unit tests for the payload validators that form the contract
 * half of `@abugida/queue`.
 */

import { describe, test, expect } from 'bun:test'

import { JobType, validateJobData } from '../../src/index.js'

// ---------------------------------------------------------------------------
// Validator Tests
// ---------------------------------------------------------------------------

describe('Validators', () => {
  test('validateJobData should validate PURCHASE_INITIATE', () => {
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

  test('validateJobData should validate WEBHOOK_PROCESS with enum', () => {
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

  test('validateJobData should reject unknown job types', () => {
    const result = validateJobData('UNKNOWN_JOB' as never, {})
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Unknown job type')
  })

  test('every job type has a validator', () => {
    for (const jobType of Object.values(JobType)) {
      const result = validateJobData(jobType, {})
      // A missing-payload fixture may be invalid, but it must never be
      // rejected as an *unknown* job type.
      expect(result.errors).not.toContain(`Unknown job type: ${jobType}`)
    }
  })
})
