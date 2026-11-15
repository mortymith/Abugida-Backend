/**
 * @test unit/processors
 * @description Unit tests for all job processors and the registry that binds
 * them to job types. Integration-backed processors (SMS, Telebirr) run against
 * a stubbed global fetch with a real in-memory RSA keypair so signature
 * handling is exercised end to end.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as BullMQ from 'bullmq'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { JobType } from '@abugida/queue'
import { SIGN_TYPE, buildStringToSign, signPayload } from '@/integrations/telebirr'
import { processors } from '@/runtime/processors'
import { ProcessorRegistry } from '@/runtime/registry'
import { restoreFetch, stubFetch, telebirrTimestamp } from '../helpers/stub-fetch.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()

const ENV_BACKUP: Record<string, string | undefined> = {}
const ENV_KEYS = [
  'SMS_ETHIOPIA_API_KEY',
  'TELEBIRR_FABRIC_APP_ID',
  'TELEBIRR_APP_SECRET',
  'TELEBIRR_MERCHANT_APP_ID',
  'TELEBIRR_MERCHANT_CODE',
  'TELEBIRR_PRIVATE_KEY',
  'TELEBIRR_PUBLIC_KEY',
  'TELEBIRR_NOTIFY_URL',
  'TELEBIRR_CHECKOUT_BASE_URL',
  'TELEBIRR_SIGNATURE_PADDING',
] as const

const JOB_CTX = { id: 'job-1', name: '', attemptsMade: 0, timestamp: Date.now() }

function stubTelebirrGateway(): void {
  stubFetch((url) => {
    if (url.endsWith('/payment/v1/token')) {
      return {
        json: {
          token: 'Bearer test-token',
          effectiveDate: telebirrTimestamp(new Date()),
          expirationDate: telebirrTimestamp(new Date(Date.now() + 3_600_000)),
        },
      }
    }
    if (url.endsWith('/payment/v1/merchant/preOrder')) {
      const response = {
        result: 'SUCCESS',
        code: '0',
        msg: 'success',
        nonce_str: '97fe4ae0c0604854a749fbf2cc1cc712',
        sign_type: SIGN_TYPE,
        biz_content: { merch_order_id: 'MERCH1', prepay_id: 'PREPAY1' },
      }
      return {
        json: { ...response, sign: signPayload(buildStringToSign(response), PRIVATE_KEY_PEM) },
      }
    }
    return { status: 404, json: {} }
  })
}

beforeAll(() => {
  for (const key of ENV_KEYS) ENV_BACKUP[key] = process.env[key]

  process.env['SMS_ETHIOPIA_API_KEY'] = 'test-sms-key'
  process.env['TELEBIRR_FABRIC_APP_ID'] = 'fabric-app-id'
  process.env['TELEBIRR_APP_SECRET'] = 'test-app-secret'
  process.env['TELEBIRR_MERCHANT_APP_ID'] = '1227484825753601'
  process.env['TELEBIRR_MERCHANT_CODE'] = '101011'
  process.env['TELEBIRR_PRIVATE_KEY'] = PRIVATE_KEY_PEM
  process.env['TELEBIRR_PUBLIC_KEY'] = PUBLIC_KEY_PEM
  process.env['TELEBIRR_NOTIFY_URL'] = 'https://api.example.com/webhooks/telebirr'
  process.env['TELEBIRR_CHECKOUT_BASE_URL'] = 'https://checkout.example.com/pay'
})

afterAll(() => {
  restoreFetch()
  for (const key of ENV_KEYS) {
    const value = ENV_BACKUP[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

// ---------------------------------------------------------------------------
// Processor Registry
// ---------------------------------------------------------------------------

describe('Processor Registry', () => {
  test('registers exactly one processor per job type', () => {
    const registry = new ProcessorRegistry(Object.values(processors))

    expect(registry.getAll()).toHaveLength(Object.values(JobType).length)
    for (const jobType of Object.values(JobType)) {
      expect(registry.has(jobType)).toBe(true)
      expect(registry.get(jobType)?.jobType).toBe(jobType)
    }
  })

  test('groups entries by queue', () => {
    const registry = new ProcessorRegistry(Object.values(processors))
    const byQueue = registry.getByQueue()

    const purchases = byQueue.get('abugida.purchases') ?? []
    expect(purchases.map((entry) => entry.jobType)).toContain(JobType.PURCHASE_INITIATE)
    expect(purchases.map((entry) => entry.jobType)).toContain(JobType.PURCHASE_COMPLETE)
  })

  test('starts empty and accepts registrations', () => {
    const registry = new ProcessorRegistry()

    expect(registry.getAll()).toEqual([])
    registry.register(processors[JobType.DATA_EXPORT]!)

    expect(registry.get(JobType.DATA_EXPORT)?.queueName).toBe('abugida.exports')
  })
})

// ---------------------------------------------------------------------------
// Purchase Processors
// ---------------------------------------------------------------------------

describe('Purchase Processors', () => {
  test('processPurchaseInitiate should create a Telebirr order', async () => {
    stubTelebirrGateway()

    const entry = processors[JobType.PURCHASE_INITIATE]!

    const result = (await entry.processor(
      {
        userId: 'user-1',
        courseId: 'course-1',
        amount: 500,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'PURCHASE_INITIATE' },
    )) as Record<string, unknown>

    expect(result).toBeDefined()
    expect(result['status']).toBe('pending')
    expect(result['paymentReference']).toBe('PREPAY1')
    // Deterministic merchant order id derived from the idempotency key.
    const expectedOrderId =
      'ABG' + createHash('sha256').update('test-key').digest('hex').slice(0, 24).toUpperCase()
    expect(result['merchOrderId']).toBe(expectedOrderId)
    expect(String(result['checkoutUrl'])).toContain('https://checkout.example.com/pay?')
  })

  test('processPurchaseInitiate should reject unsupported payment methods permanently', async () => {
    const entry = processors[JobType.PURCHASE_INITIATE]!

    await expect(
      entry.processor(
        {
          userId: 'user-1',
          courseId: 'course-1',
          amount: 500,
          currency: 'ETB',
          paymentMethod: 'chapa',
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'PURCHASE_INITIATE' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })

  test('processPurchaseComplete should verify the callback signature', async () => {
    const entry = processors[JobType.PURCHASE_COMPLETE]!

    const payload = {
      transactionId: 'txn-123',
      amount: '500.00',
      status: 'SUCCESS',
      sign_type: SIGN_TYPE,
    }
    const signedPayload = {
      ...payload,
      sign: signPayload(buildStringToSign(payload), PRIVATE_KEY_PEM),
    }

    const result = (await entry.processor(
      {
        purchaseId: 'purchase-1',
        transactionId: 'txn-123',
        status: 'success',
        callbackPayload: signedPayload,
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'PURCHASE_COMPLETE' },
    )) as Record<string, unknown>

    expect(result['status']).toBe('success')
    expect(result['transactionId']).toBe('txn-123')
  })

  test('processPurchaseComplete should reject invalid signatures permanently', async () => {
    const entry = processors[JobType.PURCHASE_COMPLETE]!

    await expect(
      entry.processor(
        {
          purchaseId: 'purchase-1',
          transactionId: 'txn-123',
          status: 'success',
          callbackPayload: { transactionId: 'txn-123', sign: 'bogus-signature' },
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'PURCHASE_COMPLETE' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })
})

// ---------------------------------------------------------------------------
// Notification Processors
// ---------------------------------------------------------------------------

describe('Notification Processors', () => {
  test('processSmsNotification should send via SMSEthiopia and mask the phone', async () => {
    stubFetch((url, body) => {
      expect(url).toBe('https://smsethiopia.com/api/v2/sms/send')
      expect((body as Record<string, unknown>)['msisdn']).toBe('251912345678')
      return { json: { id: '01J8Z0V2NQ2MC4C7XQ3W5K6J8H', segments: 1, status: 'ACCEPTED' } }
    })

    const entry = processors[JobType.SMS_NOTIFICATION]!

    const result = (await entry.processor(
      {
        recipientPhone: '+251912345678',
        message: 'Your enrollment is confirmed!',
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'SMS_NOTIFICATION' },
    )) as Record<string, unknown>

    expect(result).toBeDefined()
    expect(result['status']).toBe('sent')
    expect(result['messageId']).toBe('01J8Z0V2NQ2MC4C7XQ3W5K6J8H')
    // Phone should be masked in result
    expect(result['recipientPhone']).not.toBe('+251912345678')
  })

  test('processSmsNotification should reject invalid phone numbers permanently', async () => {
    const entry = processors[JobType.SMS_NOTIFICATION]!

    await expect(
      entry.processor(
        {
          recipientPhone: 'not-a-phone',
          message: 'Hello',
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'SMS_NOTIFICATION' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })

  test('processEmailNotification is gated until an email service exists', async () => {
    const entry = processors[JobType.EMAIL_NOTIFICATION]!

    await expect(
      entry.processor(
        {
          recipientEmail: 'user@example.com',
          subject: 'Welcome',
          htmlBody: '<p>Hi</p>',
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'EMAIL_NOTIFICATION' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })
})

// ---------------------------------------------------------------------------
// Webhook Processors
// ---------------------------------------------------------------------------

describe('Webhook Processors', () => {
  test('rejects an unsigned telebirr webhook permanently', async () => {
    const entry = processors[JobType.WEBHOOK_PROCESS]!

    await expect(
      entry.processor(
        {
          source: 'telebirr',
          payload: { transactionId: 'txn-123' },
          headers: {},
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })

  test('rejects a signed telebirr webhook that cannot be routed yet', async () => {
    const entry = processors[JobType.WEBHOOK_PROCESS]!

    const payload = {
      transactionId: 'txn-123',
      status: 'SUCCESS',
      sign_type: SIGN_TYPE,
    }
    const signedPayload = {
      ...payload,
      sign: signPayload(buildStringToSign(payload), PRIVATE_KEY_PEM),
    }

    await expect(
      entry.processor(
        {
          source: 'telebirr',
          payload: signedPayload,
          headers: { 'content-type': 'application/json' },
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })

  test('rejects an sms delivery receipt that cannot be recorded yet', async () => {
    const entry = processors[JobType.WEBHOOK_PROCESS]!

    await expect(
      entry.processor(
        {
          source: 'sms_ethiopia',
          payload: { messageId: 'MSG1', status: 'DELIVERED' },
          headers: {},
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
      ),
    ).rejects.toBeInstanceOf(BullMQ.UnrecoverableError)
  })

  test('acknowledges an unknown webhook source without completing the job', async () => {
    const entry = processors[JobType.WEBHOOK_PROCESS]!

    const result = (await entry.processor(
      {
        source: 'other',
        payload: {},
        headers: {},
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
    )) as Record<string, unknown>

    expect(result['processed']).toBe(false)
    expect(result['reason']).toBe('Unknown source')
  })
})
