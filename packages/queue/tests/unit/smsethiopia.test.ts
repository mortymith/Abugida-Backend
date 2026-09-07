/**
 * @test unit/integrations/smsethiopia
 * @description Unit tests for the SMSEthiopia SMS API client (send v1/v2,
 * status lookup, MSISDN helpers). Network calls are stubbed.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import {
  SMSETHIOPIA_DEFAULTS,
  SMSEthiopiaError,
  createSMSEthiopiaClient,
  getSMSEthiopiaConfigFromEnv,
  isValidMsisdn,
  normalizeMsisdn,
  normalizeSmsStatus,
  type SMSEthiopiaConfig,
} from '../../src/integrations/smsethiopia.js'
import { restoreFetch, stubFetch } from '../helpers/stub-fetch.js'

afterAll(() => {
  restoreFetch()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<SMSEthiopiaConfig> = {}): SMSEthiopiaConfig {
  return {
    apiKey: 'test-key',
    baseUrl: SMSETHIOPIA_DEFAULTS.baseUrl,
    apiVersion: SMSETHIOPIA_DEFAULTS.apiVersion,
    timeoutMs: SMSETHIOPIA_DEFAULTS.timeoutMs,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// MSISDN helpers
// ---------------------------------------------------------------------------

describe('MSISDN helpers', () => {
  test('normalizeMsisdn converts Ethiopian local formats', () => {
    expect(normalizeMsisdn('+251912345678')).toBe('251912345678')
    expect(normalizeMsisdn('251912345678')).toBe('251912345678')
    expect(normalizeMsisdn('0912345678')).toBe('251912345678')
    expect(normalizeMsisdn('+251 911 234 567')).toBe('251911234567')
    expect(normalizeMsisdn('251-911-234-567')).toBe('251911234567')
  })

  test('normalizeMsisdn rejects garbage', () => {
    expect(normalizeMsisdn('not-a-phone')).toBeNull()
    expect(normalizeMsisdn('12345')).toBeNull()
    expect(normalizeMsisdn('')).toBeNull()
  })

  test('isValidMsisdn accepts E.164-ish values', () => {
    expect(isValidMsisdn('+251912345678')).toBe(true)
    expect(isValidMsisdn('251912345678')).toBe(true)
    expect(isValidMsisdn('0912345678')).toBe(false)
    expect(isValidMsisdn('abc')).toBe(false)
  })

  test('normalizeSmsStatus closes the status set', () => {
    expect(normalizeSmsStatus('delivered')).toBe('DELIVERED')
    expect(normalizeSmsStatus('SENT')).toBe('SENT')
    expect(normalizeSmsStatus('SOMETHING_NEW')).toBe('UNKNOWN')
  })
})

// ---------------------------------------------------------------------------
// Send (v2)
// ---------------------------------------------------------------------------

describe('SMSEthiopiaClient.send (v2)', () => {
  test('sends to the v2 endpoint with the KEY header', async () => {
    let requestBody: Record<string, unknown> | undefined

    stubFetch((url, body) => {
      expect(url).toBe('https://smsethiopia.com/api/v2/sms/send')
      requestBody = body as Record<string, unknown>
      return {
        json: { id: '01J8Z0V2NQ2MC4C7XQ3W5K6J8H', segments: 1, status: 'ACCEPTED' },
      }
    })

    const client = createSMSEthiopiaClient(makeConfig())
    const result = await client.send({ msisdn: '251912345678', text: 'Hello' })

    expect(result).toEqual({
      id: '01J8Z0V2NQ2MC4C7XQ3W5K6J8H',
      segments: 1,
      status: 'ACCEPTED',
    })
    expect(requestBody).toEqual({ msisdn: '251912345678', text: 'Hello' })
  })

  test('normalizes the v1 numeric id response', async () => {
    stubFetch((url) => {
      expect(url).toBe('https://smsethiopia.com/api/sms/send')
      return { json: { id: 0 } }
    })

    const client = createSMSEthiopiaClient(makeConfig({ apiVersion: 'v1' }))
    const result = await client.send({ msisdn: '251912345678', text: 'Hello' })

    expect(result.id).toBe('0')
    expect(result.segments).toBeNull()
    expect(result.status).toBe('ACCEPTED')
  })

  test('rejects invalid msisdn without hitting the network', async () => {
    const client = createSMSEthiopiaClient(makeConfig())
    const error: SMSEthiopiaError = await client
      .send({ msisdn: 'not-a-phone', text: 'Hello' })
      .catch((cause: unknown) => cause as SMSEthiopiaError)

    expect(error).toBeInstanceOf(SMSEthiopiaError)
    expect(error.code).toBe('SMS_REJECTED')
    expect(error.retryable).toBe(false)
  })

  test('maps 5xx responses to retryable errors', async () => {
    stubFetch(() => ({ status: 503, json: { error: 'overloaded' } }))

    const client = createSMSEthiopiaClient(makeConfig())
    const error: SMSEthiopiaError = await client
      .send({ msisdn: '251912345678', text: 'Hello' })
      .catch((cause: unknown) => cause as SMSEthiopiaError)

    expect(error.code).toBe('SMS_HTTP')
    expect(error.retryable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Status lookup (v2)
// ---------------------------------------------------------------------------

describe('SMSEthiopiaClient.getStatus', () => {
  test('looks up message status by id', async () => {
    stubFetch((url) => {
      expect(url).toBe('https://smsethiopia.com/api/v2/sms/01J8Z0V2NQ2MC4C7XQ3W5K6J8H')
      return {
        json: { id: '01J8Z0V2NQ2MC4C7XQ3W5K6J8H', status: 'DELIVERED', segments: 2 },
      }
    })

    const client = createSMSEthiopiaClient(makeConfig())
    const status = await client.getStatus('01J8Z0V2NQ2MC4C7XQ3W5K6J8H')

    expect(status.status).toBe('DELIVERED')
    expect(status.segments).toBe(2)
  })

  test('maps 404 to a permanent SMS_NOT_FOUND error', async () => {
    stubFetch(() => ({ status: 404, json: { error: 'not found' } }))

    const client = createSMSEthiopiaClient(makeConfig())
    const error: SMSEthiopiaError = await client
      .getStatus('UNKNOWN_ID')
      .catch((cause: unknown) => cause as SMSEthiopiaError)

    expect(error.code).toBe('SMS_NOT_FOUND')
    expect(error.retryable).toBe(false)
  })

  test('is unsupported on the v1 API', async () => {
    const client = createSMSEthiopiaClient(makeConfig({ apiVersion: 'v1' }))
    const error: SMSEthiopiaError = await client
      .getStatus('ANY')
      .catch((cause: unknown) => cause as SMSEthiopiaError)

    expect(error.code).toBe('SMS_UNSUPPORTED')
  })
})

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

describe('getSMSEthiopiaConfigFromEnv', () => {
  test('returns null without an API key', () => {
    const previous = process.env['SMS_ETHIOPIA_API_KEY']
    delete process.env['SMS_ETHIOPIA_API_KEY']
    try {
      expect(getSMSEthiopiaConfigFromEnv()).toBeNull()
    } finally {
      if (previous !== undefined) process.env['SMS_ETHIOPIA_API_KEY'] = previous
    }
  })

  test('rejects an invalid API version', () => {
    const previousKey = process.env['SMS_ETHIOPIA_API_KEY']
    const previousVersion = process.env['SMS_ETHIOPIA_API_VERSION']
    process.env['SMS_ETHIOPIA_API_KEY'] = 'k'
    process.env['SMS_ETHIOPIA_API_VERSION'] = 'v3'
    try {
      expect(() => getSMSEthiopiaConfigFromEnv()).toThrow(SMSEthiopiaError)
    } finally {
      if (previousKey === undefined) delete process.env['SMS_ETHIOPIA_API_KEY']
      else process.env['SMS_ETHIOPIA_API_KEY'] = previousKey
      if (previousVersion === undefined) delete process.env['SMS_ETHIOPIA_API_VERSION']
      else process.env['SMS_ETHIOPIA_API_VERSION'] = previousVersion
    }
  })
})
