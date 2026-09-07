/**
 * @test unit/processors
 * @description Unit tests for all job processors. Integration-backed
 * processors (SMS, Telebirr) run against a stubbed global fetch with a
 * real in-memory RSA keypair so signature handling is exercised end to end.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { UnrecoverableError } from 'bullmq'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { SIGN_TYPE, buildStringToSign, signPayload } from '../../src/integrations/telebirr.js'
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
  test('allProcessors should export all 14 job types', async () => {
    const { allProcessors } = await import('../../src/processors/index.js')
    const { JobType } = await import('../../src/core/types.js')

    const expectedTypes = Object.values(JobType)
    const registeredTypes = allProcessors.map((p) => p.jobType)

    for (const type of expectedTypes) {
      expect(registeredTypes).toContain(type)
    }
  })

  test('getProcessorsForQueue should filter correctly', async () => {
    const { getProcessorsForQueue } = await import('../../src/processors/index.js')
    const { JobType } = await import('../../src/core/types.js')

    const purchaseProcessors = getProcessorsForQueue('abugida.purchases')
    expect(purchaseProcessors).toHaveLength(2)
    expect(purchaseProcessors.map((p) => p.jobType)).toContain(JobType.PURCHASE_INITIATE)
    expect(purchaseProcessors.map((p) => p.jobType)).toContain(JobType.PURCHASE_COMPLETE)
  })

  test('getProcessorForJobType should find the right processor', async () => {
    const { getProcessorForJobType } = await import('../../src/processors/index.js')
    const { JobType } = await import('../../src/core/types.js')

    const entry = getProcessorForJobType(JobType.DATA_EXPORT)
    expect(entry).toBeDefined()
    expect(entry?.queueName).toBe('abugida.exports')
  })
})

// ---------------------------------------------------------------------------
// Individual Processor Tests
// ---------------------------------------------------------------------------

describe('Purchase Processors', () => {
  test('processPurchaseInitiate should create a Telebirr order', async () => {
    stubTelebirrGateway()

    const { purchaseProcessors } = await import('../../src/processors/purchase.js')

    const processor = purchaseProcessors.find((p) => p.jobType === 'PURCHASE_INITIATE')
    expect(processor).toBeDefined()

    const result = (await processor!.processor(
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
    const { purchaseProcessors } = await import('../../src/processors/purchase.js')

    const processor = purchaseProcessors.find((p) => p.jobType === 'PURCHASE_INITIATE')

    await expect(
      processor!.processor(
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
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })

  test('processPurchaseComplete should verify the callback signature', async () => {
    const { purchaseProcessors } = await import('../../src/processors/purchase.js')

    const processor = purchaseProcessors.find((p) => p.jobType === 'PURCHASE_COMPLETE')
    expect(processor).toBeDefined()

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

    const result = (await processor!.processor(
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
    const { purchaseProcessors } = await import('../../src/processors/purchase.js')

    const processor = purchaseProcessors.find((p) => p.jobType === 'PURCHASE_COMPLETE')

    await expect(
      processor!.processor(
        {
          purchaseId: 'purchase-1',
          transactionId: 'txn-123',
          status: 'success',
          callbackPayload: { transactionId: 'txn-123', sign: 'bogus-signature' },
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'PURCHASE_COMPLETE' },
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })
})

describe('Notification Processors', () => {
  test('processSmsNotification should send via SMSEthiopia and mask the phone', async () => {
    stubFetch((url, body) => {
      expect(url).toBe('https://smsethiopia.com/api/v2/sms/send')
      expect((body as Record<string, unknown>)['msisdn']).toBe('251912345678')
      return { json: { id: '01J8Z0V2NQ2MC4C7XQ3W5K6J8H', segments: 1, status: 'ACCEPTED' } }
    })

    const { notificationProcessors } = await import('../../src/processors/notification.js')

    const processor = notificationProcessors.find((p) => p.jobType === 'SMS_NOTIFICATION')
    expect(processor).toBeDefined()

    const result = (await processor!.processor(
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
    const { notificationProcessors } = await import('../../src/processors/notification.js')

    const processor = notificationProcessors.find((p) => p.jobType === 'SMS_NOTIFICATION')

    await expect(
      processor!.processor(
        {
          recipientPhone: 'not-a-phone',
          message: 'Hello',
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'SMS_NOTIFICATION' },
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })
})

describe('Webhook Processors', () => {
  test('processWebhook should verify and route signed telebirr webhooks', async () => {
    const { webhookProcessors } = await import('../../src/processors/webhook.js')

    const processor = webhookProcessors.find((p) => p.jobType === 'WEBHOOK_PROCESS')
    expect(processor).toBeDefined()

    const payload = {
      externalTransactionId: 'ext-1',
      transactionId: 'txn-123',
      status: 'SUCCESS',
      sign_type: SIGN_TYPE,
    }
    const signedPayload = {
      ...payload,
      sign: signPayload(buildStringToSign(payload), PRIVATE_KEY_PEM),
    }

    const result = (await processor!.processor(
      {
        source: 'telebirr',
        payload: signedPayload,
        headers: { 'content-type': 'application/json' },
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
    )) as Record<string, unknown>

    expect(result['processed']).toBe(true)
    expect(result['routedTo']).toBe('PURCHASE_COMPLETE')
    expect(result['status']).toBe('success')
    expect(result['transactionId']).toBe('txn-123')
  })

  test('processWebhook should reject unsigned telebirr webhooks permanently', async () => {
    const { webhookProcessors } = await import('../../src/processors/webhook.js')

    const processor = webhookProcessors.find((p) => p.jobType === 'WEBHOOK_PROCESS')

    await expect(
      processor!.processor(
        {
          source: 'telebirr',
          payload: { transactionId: 'txn-123' },
          headers: {},
          idempotencyKey: 'test-key',
        },
        { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })

  test('processWebhook should normalise sms delivery receipts', async () => {
    const { webhookProcessors } = await import('../../src/processors/webhook.js')

    const processor = webhookProcessors.find((p) => p.jobType === 'WEBHOOK_PROCESS')

    const result = (await processor!.processor(
      {
        source: 'sms_ethiopia',
        payload: { messageId: 'MSG1', status: 'DELIVERED' },
        headers: {},
        idempotencyKey: 'test-key',
      },
      { ...JOB_CTX, name: 'WEBHOOK_PROCESS' },
    )) as Record<string, unknown>

    expect(result['processed']).toBe(true)
    expect(result['routedTo']).toBe('SMS_DELIVERY_RECEIPT')
    expect(result['messageId']).toBe('MSG1')
    expect(result['status']).toBe('DELIVERED')
  })
})
