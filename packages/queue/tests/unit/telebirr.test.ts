/**
 * @test unit/integrations/telebirr
 * @description Unit tests for the Telebirr H5 C2B payment gateway client.
 * Network calls are stubbed; signatures use a real in-memory RSA keypair so
 * sign/verify round-trips are exercised end to end.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { UnrecoverableError } from 'bullmq'
import { generateKeyPairSync } from 'node:crypto'
import {
  SIGN_TYPE,
  TELEBIRR_TESTBED_BASE_URL,
  TelebirrError,
  buildStringToSign,
  createTelebirrClient,
  signPayload,
  verifyPayload,
  type TelebirrConfig,
} from '../../src/integrations/telebirr.js'
import { SMSEthiopiaError } from '../../src/integrations/smsethiopia.js'
import { toJobError } from '../../src/integrations/job-error.js'
import { restoreFetch, stubFetch, telebirrTimestamp } from '../helpers/stub-fetch.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()

function makeConfig(overrides: Partial<TelebirrConfig> = {}): TelebirrConfig {
  return {
    baseUrl: TELEBIRR_TESTBED_BASE_URL,
    fabricAppId: 'fabric-app-id',
    appSecret: 'test-app-secret',
    merchantAppId: '1227484825753601',
    merchantCode: '101011',
    privateKey: PRIVATE_KEY_PEM,
    publicKey: PUBLIC_KEY_PEM,
    notifyUrl: 'https://api.example.com/webhooks/telebirr',
    ...overrides,
  }
}

function fabricTokenResponse(): { json: unknown } {
  return {
    json: {
      token: 'Bearer test-token',
      effectiveDate: telebirrTimestamp(new Date()),
      expirationDate: telebirrTimestamp(new Date(Date.now() + 3_600_000)),
    },
  }
}

function signedResponse(response: Record<string, unknown>): { json: unknown } {
  return {
    json: { ...response, sign: signPayload(buildStringToSign(response), PRIVATE_KEY_PEM) },
  }
}

afterAll(() => {
  restoreFetch()
})

// ---------------------------------------------------------------------------
// String-to-sign (golden sample from the portal signature guide)
// ---------------------------------------------------------------------------

describe('buildStringToSign', () => {
  test('matches the portal guide sample', () => {
    const request = {
      timestamp: '1755866096',
      nonce_str: 'RQWL32B8Q6IIBS5OHIECTM02P20373A7',
      method: 'payment.preorder',
      version: '1.0',
      biz_content: {
        notify_url: 'https://www.google.com',
        appid: '1227484825753601',
        merch_code: '101011',
        merch_order_id: '1755866096256',
        trade_type: 'Checkout',
        title: 'diamond_1.5',
        total_amount: '1.5',
        trans_currency: 'ETB',
        timeout_express: '120m',
      },
    }

    expect(buildStringToSign(request)).toBe(
      'appid=1227484825753601&merch_code=101011&merch_order_id=1755866096256' +
        '&method=payment.preorder&nonce_str=RQWL32B8Q6IIBS5OHIECTM02P20373A7' +
        '&notify_url=https://www.google.com&timeout_express=120m&timestamp=1755866096' +
        '&title=diamond_1.5&total_amount=1.5&trade_type=Checkout&trans_currency=ETB&version=1.0',
    )
  })

  test('excludes sign fields and flattens biz_content', () => {
    const body = {
      sign: 'should-be-excluded',
      sign_type: SIGN_TYPE,
      method: 'payment.preorder',
      biz_content: { appid: 'A1' },
    }
    expect(buildStringToSign(body)).toBe('appid=A1&method=payment.preorder')
  })
})

// ---------------------------------------------------------------------------
// Signing primitives
// ---------------------------------------------------------------------------

describe('signPayload / verifyPayload', () => {
  test('round-trips with PSS padding (SHA256withRSAandMGF1)', () => {
    const text = 'appid=1227484825753601&merch_code=101011'
    const sign = signPayload(text, PRIVATE_KEY_PEM, 'pss')
    expect(verifyPayload(text, sign, PUBLIC_KEY_PEM, 'pss')).toBe(true)
  })

  test('round-trips with PKCS#1 v1.5 padding (SHA256WithRSA)', () => {
    const text = 'appid=1227484825753601&merch_code=101011'
    const sign = signPayload(text, PRIVATE_KEY_PEM, 'pkcs1v15')
    expect(verifyPayload(text, sign, PUBLIC_KEY_PEM, 'pkcs1v15')).toBe(true)
  })

  test('rejects tampered payloads and mismatched padding', () => {
    const sign = signPayload('a=1', PRIVATE_KEY_PEM)
    expect(verifyPayload('a=2', sign, PUBLIC_KEY_PEM)).toBe(false)
    expect(verifyPayload('a=1', sign, PUBLIC_KEY_PEM, 'pkcs1v15')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Client flows
// ---------------------------------------------------------------------------

describe('TelebirrClient.createOrder', () => {
  test('creates an order and verifies the response signature', async () => {
    let preOrderBody: Record<string, unknown> | undefined

    stubFetch((url, body) => {
      if (url.endsWith('/payment/v1/token')) return fabricTokenResponse()
      if (url.endsWith('/payment/v1/merchant/preOrder')) {
        preOrderBody = body as Record<string, unknown>
        return signedResponse({
          result: 'SUCCESS',
          code: '0',
          msg: 'success',
          nonce_str: '97fe4ae0c0604854a749fbf2cc1cc712',
          sign_type: SIGN_TYPE,
          biz_content: { merch_order_id: 'MERCH1', prepay_id: 'PREPAY1' },
        })
      }
      return { status: 404, json: {} }
    })

    const client = createTelebirrClient(makeConfig())
    const order = await client.createOrder({
      title: 'diamond_1.5',
      amount: '1.5',
      merchOrderId: 'MERCH1',
    })

    expect(order.prepayId).toBe('PREPAY1')
    expect(order.merchOrderId).toBe('MERCH1')

    // The outgoing request must be signed with the merchant key.
    expect(preOrderBody).toBeDefined()
    const requestSign = preOrderBody?.['sign']
    expect(preOrderBody?.['sign_type']).toBe(SIGN_TYPE)
    expect(preOrderBody?.['method']).toBe('payment.preorder')
    expect(typeof requestSign).toBe('string')
    expect(
      verifyPayload(
        buildStringToSign(preOrderBody as Record<string, unknown>),
        requestSign as string,
        PUBLIC_KEY_PEM,
      ),
    ).toBe(true)

    const biz = preOrderBody?.['biz_content'] as Record<string, string>
    expect(biz['notify_url']).toBe('https://api.example.com/webhooks/telebirr')
    expect(biz['appid']).toBe('1227484825753601')
    expect(biz['merch_code']).toBe('101011')
    expect(biz['total_amount']).toBe('1.5')
    expect(biz['trade_type']).toBe('Checkout')
    expect(biz['trans_currency']).toBe('ETB')
  })

  test('normalizes numeric amounts and skips verification without a public key', async () => {
    let totalAmount: string | undefined

    stubFetch((url, body) => {
      if (url.endsWith('/payment/v1/token')) return fabricTokenResponse()
      if (url.endsWith('/payment/v1/merchant/preOrder')) {
        totalAmount =
          (body as Record<string, unknown>)['biz_content'] &&
          ((body as Record<string, unknown>)['biz_content'] as Record<string, string>)[
            'total_amount'
          ]
        return {
          json: {
            result: 'SUCCESS',
            code: '0',
            biz_content: { merch_order_id: 'M2', prepay_id: 'P2' },
            // no signature – verification must be skipped when no public key
          },
        }
      }
      return { status: 404, json: {} }
    })

    const { publicKey: _publicKey, ...configWithoutVerification } = makeConfig()
    const client = createTelebirrClient(configWithoutVerification)
    const order = await client.createOrder({ title: 'Course', amount: 10, merchOrderId: 'M2' })

    expect(order.prepayId).toBe('P2')
    expect(totalAmount).toBe('10.00')
  })

  test('requires notify_url', async () => {
    const { notifyUrl: _notifyUrl, ...configWithoutNotify } = makeConfig()
    const client = createTelebirrClient(configWithoutNotify)
    expect(client.createOrder({ title: 't', amount: 5 })).rejects.toThrow('notify_url')
  })

  test('caches the fabric token across orders', async () => {
    let tokenRequests = 0
    let preOrderRequests = 0

    stubFetch((url) => {
      if (url.endsWith('/payment/v1/token')) {
        tokenRequests++
        return fabricTokenResponse()
      }
      if (url.endsWith('/payment/v1/merchant/preOrder')) {
        preOrderRequests++
        return signedResponse({
          result: 'SUCCESS',
          code: '0',
          biz_content: { merch_order_id: 'M3', prepay_id: 'P3' },
        })
      }
      return { status: 404, json: {} }
    })

    const client = createTelebirrClient(makeConfig())
    await client.createOrder({ title: 't', amount: 10, merchOrderId: 'M3' })
    await client.createOrder({ title: 't', amount: 10, merchOrderId: 'M4' })

    expect(tokenRequests).toBe(1)
    expect(preOrderRequests).toBe(2)
  })

  test('surfaces business rejections as permanent errors', async () => {
    stubFetch((url) => {
      if (url.endsWith('/payment/v1/token')) return fabricTokenResponse()
      return signedResponse({ result: 'FAIL', code: '2000', msg: 'INSUFFICIENT_FUNDS' })
    })

    const client = createTelebirrClient(makeConfig())
    const error: TelebirrError = await client
      .createOrder({ title: 't', amount: 10 })
      .catch((cause: unknown) => cause as TelebirrError)

    expect(error).toBeInstanceOf(TelebirrError)
    expect(error.code).toBe('TELEBIRR_ORDER')
    expect(error.retryable).toBe(false)
  })

  test('rejects responses whose signature does not verify', async () => {
    stubFetch((url) => {
      if (url.endsWith('/payment/v1/token')) return fabricTokenResponse()
      return {
        json: {
          result: 'SUCCESS',
          code: '0',
          sign: 'not-a-valid-signature',
          biz_content: { merch_order_id: 'M5', prepay_id: 'P5' },
        },
      }
    })

    const client = createTelebirrClient(makeConfig())
    const error: TelebirrError = await client
      .createOrder({ title: 't', amount: 10 })
      .catch((cause: unknown) => cause as TelebirrError)

    expect(error.code).toBe('TELEBIRR_VERIFY')
  })

  test('maps transport failures: 5xx retryable, 4xx permanent', async () => {
    stubFetch(() => ({ status: 500, json: {} }))
    const client = createTelebirrClient(makeConfig())
    const serverError: TelebirrError = await client
      .createOrder({ title: 't', amount: 10 })
      .catch((cause: unknown) => cause as TelebirrError)
    expect(serverError.code).toBe('TELEBIRR_HTTP')
    expect(serverError.retryable).toBe(true)

    stubFetch(() => ({ status: 400, json: {} }))
    const client2 = createTelebirrClient(makeConfig())
    const clientError: TelebirrError = await client2
      .createOrder({ title: 't', amount: 10 })
      .catch((cause: unknown) => cause as TelebirrError)
    expect(clientError.code).toBe('TELEBIRR_HTTP')
    expect(clientError.retryable).toBe(false)
  })
})

describe('TelebirrClient.buildCheckoutUrl', () => {
  test('assembles the rawRequest per Step 3 of the guide', () => {
    const client = createTelebirrClient(
      makeConfig({ checkoutBaseUrl: 'https://checkout.example.com/pay' }),
    )
    const url = client.buildCheckoutUrl('PREPAY1')

    expect(url.startsWith('https://checkout.example.com/pay?')).toBe(true)

    const parts = url.split('?')[1]?.split('&') ?? []
    expect(parts.map((part) => part.split('=')[0] ?? '')).toEqual([
      'appid',
      'merch_code',
      'nonce_str',
      'prepay_id',
      'timestamp',
      'sign',
      'sign_type',
    ])
    expect(parts[6]).toBe(`sign_type=${SIGN_TYPE}`)

    // The sign must verify against the appid..timestamp map.
    const signedMap: Record<string, string> = {}
    for (const part of parts.slice(0, 5)) {
      const separator = part.indexOf('=')
      if (separator > 0) signedMap[part.slice(0, separator)] = part.slice(separator + 1)
    }
    const sign = parts.find((part) => part.startsWith('sign='))?.slice(5) ?? ''
    expect(verifyPayload(buildStringToSign(signedMap), sign, PUBLIC_KEY_PEM)).toBe(true)
  })

  test('requires TELEBIRR_CHECKOUT_BASE_URL', () => {
    const { checkoutBaseUrl: _checkoutBaseUrl, ...configWithoutCheckout } = makeConfig()
    const client = createTelebirrClient(configWithoutCheckout)
    expect(() => client.buildCheckoutUrl('PREPAY1')).toThrow(TelebirrError)
  })
})

describe('TelebirrClient.queryOrder', () => {
  test('returns the normalized order status', async () => {
    let queryBody: Record<string, unknown> | undefined

    stubFetch((url, body) => {
      if (url.endsWith('/payment/v1/token')) return fabricTokenResponse()
      if (url.endsWith('/payment/v1/merchant/orderQuery')) {
        queryBody = body as Record<string, unknown>
        return signedResponse({
          result: 'SUCCESS',
          code: '0',
          msg: 'success',
          nonce_str: 'b93f8165b83e46a9abea4aaa7dc173a8',
          sign_type: SIGN_TYPE,
          biz_content: {
            merch_order_id: 'MERCH9',
            order_status: 'PAY_SUCCESS',
            payment_order_id: '11801107AD19191408215009',
            trans_time: '2025-10-13 19:19:38',
            trans_currency: 'ETB',
            total_amount: '1260.00',
            trans_id: 'CJD7GBOXIP',
          },
        })
      }
      return { status: 404, json: {} }
    })

    const client = createTelebirrClient(makeConfig())
    const status = await client.queryOrder('MERCH9')

    expect(status.orderStatus).toBe('PAY_SUCCESS')
    expect(status.transId).toBe('CJD7GBOXIP')
    expect(status.paymentOrderId).toBe('11801107AD19191408215009')
    expect(status.amount).toBe('1260.00')
    expect(status.currency).toBe('ETB')

    expect(queryBody?.['method']).toBe('payment.queryorder')
    const biz = queryBody?.['biz_content'] as Record<string, string>
    expect(biz['merch_order_id']).toBe('MERCH9')
  })
})

describe('TelebirrClient.verifyCallback', () => {
  test('verifies signed notifications and rejects tampered ones', () => {
    const client = createTelebirrClient(makeConfig())
    const payload = {
      transactionId: 'TX1',
      amount: '10.00',
      status: 'SUCCESS',
      sign_type: SIGN_TYPE,
    }
    const signed = { ...payload, sign: signPayload(buildStringToSign(payload), PRIVATE_KEY_PEM) }

    expect(client.verifyCallback(signed)).toBe(true)
    expect(client.verifyCallback({ ...signed, amount: '99.00' })).toBe(false)
    expect(client.verifyCallback({ transactionId: 'TX1' })).toBe(false)
  })

  test('throws TELEBIRR_CONFIG without a configured public key', () => {
    const { publicKey: _publicKey, ...configWithoutKey } = makeConfig()
    const client = createTelebirrClient(configWithoutKey)
    expect(() => client.verifyCallback({ sign: 'x' })).toThrow(TelebirrError)
  })
})

// ---------------------------------------------------------------------------
// Job error mapping
// ---------------------------------------------------------------------------

describe('toJobError', () => {
  test('wraps permanent integration errors in UnrecoverableError', () => {
    const error = new TelebirrError('bad config', 'TELEBIRR_TOKEN', false)
    const jobError = toJobError(error)
    expect(jobError).toBeInstanceOf(UnrecoverableError)
    expect(jobError.message).toContain('TELEBIRR_TOKEN')
  })

  test('passes retryable integration errors through', () => {
    const error = new SMSEthiopiaError('network down', 'SMS_HTTP', true)
    expect(toJobError(error)).toBe(error)
  })
})
