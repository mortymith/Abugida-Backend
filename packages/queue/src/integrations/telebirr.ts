/**
 * @module integrations/telebirr
 * @description Client for the Ethio Telecom Telebirr H5 C2B Web Payment
 * gateway, implementing the merchant-side flow from the developer portal
 * quick guide:
 *
 * 1. {@link TelebirrClient.applyFabricToken} – fabric token (Step 1)
 * 2. {@link TelebirrClient.createOrder} – create a prepay order (Step 2)
 * 3. {@link TelebirrClient.buildCheckoutUrl} – assemble the checkout URL (Step 3)
 * 4. {@link TelebirrClient.queryOrder} – reconcile an order (Step 5)
 *
 * Request bodies are signed with the merchant's RSA private key. Per the
 * portal's signing sample (`SHA256withRSAandMGF1`) the default algorithm is
 * RSASSA-PSS with MGF1/SHA-256 and a digest-sized salt; plain PKCS#1 v1.5
 * can be selected via `signaturePadding` if the merchant's onboarding
 * requires it. Responses and payment notifications are verified with the
 * platform's public key.
 *
 * Configuration is read from the environment by {@link getTelebirrClient}:
 *
 * | Variable | Description |
 * | --- | --- |
 * | `TELEBIRR_FABRIC_APP_ID` | Fabric `X-APP-Key` (required) |
 * | `TELEBIRR_APP_SECRET` | Fabric app secret (required) |
 * | `TELEBIRR_MERCHANT_APP_ID` | Merchant `appid` (required) |
 * | `TELEBIRR_MERCHANT_CODE` | Merchant short code (required) |
 * | `TELEBIRR_PRIVATE_KEY` / `TELEBIRR_PRIVATE_KEY_PATH` | Merchant RSA key used for signing (required) |
 * | `TELEBIRR_PUBLIC_KEY` / `TELEBIRR_PUBLIC_KEY_PATH` | Telebirr platform key used for verification |
 * | `TELEBIRR_BASE_URL` | Gateway base URL (default: test bed) |
 * | `TELEBIRR_NOTIFY_URL` | Default payment notification callback URL |
 * | `TELEBIRR_REDIRECT_URL` | Default post-payment redirect URL |
 * | `TELEBIRR_CHECKOUT_BASE_URL` | Web checkout base URL provided during onboarding |
 * | `TELEBIRR_TRADE_TYPE` / `TELEBIRR_CURRENCY` / `TELEBIRR_TIMEOUT_EXPRESS` | Order defaults |
 * | `TELEBIRR_SIGNATURE_PADDING` | `pss` (default) or `pkcs1v15` |
 * | `TELEBIRR_TIMEOUT_MS` | HTTP timeout (default: `30000`) |
 */

import { createSign, createVerify, constants, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { envNumber } from '../config/env.js'
import { IntegrationError, describeError } from './errors.js'
import { fetchJson, HttpError, isRetryableHttpError } from './http.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Gateway base URL for the developer portal test bed. */
export const TELEBIRR_TESTBED_BASE_URL =
  'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway'

/** Gateway base URL for production. */
export const TELEBIRR_PRODUCTION_BASE_URL =
  'https://superapp.ethiomobilemoney.et:38443/apiaccess/payment/gateway'

/** Fixed `sign_type` value for Telebirr API requests. */
export const SIGN_TYPE = 'SHA256WithRSA'

/** Fixed interface version. */
const VERSION = '1.0'

const DEFAULT_TIMEOUT_MS = 30_000
const NONCE_LENGTH = 32
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// Fabric tokens are issued for one hour; cache for at most 50 minutes and
// refresh 60 seconds before the reported expiration.
const TOKEN_MAX_TTL_MS = 50 * 60 * 1000
const TOKEN_EXPIRY_SKEW_MS = 60_000

/**
 * Request fields excluded from the signature. Fields inside `biz_content`
 * participate in the signature (flattened), as specified by the portal's
 * "Request Signature Process" guide.
 */
const SIGN_EXCLUDED_FIELDS = new Set([
  'sign',
  'sign_type',
  'header',
  'refund_info',
  'openType',
  'raw_request',
  'biz_content',
  'wallet_reference_data',
])

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type TelebirrErrorCode =
  | 'TELEBIRR_CONFIG'
  | 'TELEBIRR_HTTP'
  | 'TELEBIRR_TOKEN'
  | 'TELEBIRR_ORDER'
  | 'TELEBIRR_QUERY'
  | 'TELEBIRR_SIGN'
  | 'TELEBIRR_VERIFY'

/** Error raised by the Telebirr client. */
export class TelebirrError extends IntegrationError {
  constructor(message: string, code: TelebirrErrorCode, retryable: boolean, cause?: unknown) {
    super(message, code, retryable, cause)
    this.name = 'TelebirrError'
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Signature algorithm used for outgoing requests and incoming payloads. */
export type TelebirrSignaturePadding = 'pss' | 'pkcs1v15'

/** `trade_type` values accepted by the preOrder API. */
export type TelebirrTradeType =
  'InApp' | 'Cross-App' | 'Checkout' | 'PWA' | 'QrCode' | 'QuickPay' | 'BankTrade'

export interface TelebirrConfig {
  /** Gateway base URL. Default: {@link TELEBIRR_TESTBED_BASE_URL}. */
  baseUrl: string
  /** Fabric App ID, sent as the `X-APP-Key` header. */
  fabricAppId: string
  /** Fabric app secret, used to obtain fabric tokens. */
  appSecret: string
  /** Merchant application ID (`biz_content.appid`). */
  merchantAppId: string
  /** Merchant short code (`biz_content.merch_code`). */
  merchantCode: string
  /** Merchant RSA private key (PEM) used to sign outgoing requests. */
  privateKey: string
  /** Telebirr platform RSA public key (PEM) used to verify responses/callbacks. */
  publicKey?: string
  /** Default payment notification callback URL (`notify_url`, required by the API). */
  notifyUrl?: string
  /** Default post-payment redirect URL (`redirect_url`). */
  redirectUrl?: string
  /** Web checkout base URL provided by Ethio Telecom during onboarding. */
  checkoutBaseUrl?: string
  /** Default trade type. Default: `"Checkout"`. */
  tradeType?: TelebirrTradeType
  /** Default business type. Default: `"BuyGoods"`. */
  businessType?: string
  /** Default transaction currency. Default: `"ETB"`. */
  currency?: string
  /** Default order expiry. Default: `"120m"` (1–120 minutes). */
  timeoutExpress?: string
  /** Signature algorithm. Default: `"pss"` (SHA256withRSAandMGF1). */
  signaturePadding?: TelebirrSignaturePadding
  /** HTTP timeout in ms. Default: `30000`. */
  timeoutMs?: number
}

/** Parameters for creating a prepay order. */
export interface CreateOrderParams {
  /** Order title shown to the payer (no `~\`!#$%^*-+=|` characters). */
  title: string
  /** Order amount; string or number, at most 2 decimals. */
  amount: string | number
  /** Merchant order id (alphanumeric, <= 64 chars). Generated when omitted. */
  merchOrderId?: string
  /** Payment notification callback URL; falls back to the configured default. */
  notifyUrl?: string
  /** Post-payment redirect URL; falls back to the configured default. */
  redirectUrl?: string
  /** 3-letter currency code. Default: `"ETB"`. */
  currency?: string
  /** Trade type. Default: `"Checkout"`. */
  tradeType?: TelebirrTradeType
  /** Order expiry (1–120 minutes, e.g. `"90m"`). Default: `"120m"`. */
  timeoutExpress?: string
}

export interface CreateOrderResult {
  /** Echoed merchant order id. */
  merchOrderId: string
  /** Prepay id used to assemble the checkout URL. */
  prepayId: string
  /** Raw verified API response. */
  raw: TelebirrApiResponse<TelebirrOrderResponseBiz>
}

/** Envelope of every Telebirr gateway response. */
export interface TelebirrApiResponse<B = Record<string, unknown>> {
  result?: string
  code?: string
  msg?: string
  nonce_str?: string
  sign?: string
  sign_type?: string
  biz_content?: B
}

/** `biz_content` of the preOrder response. */
export interface TelebirrOrderResponseBiz {
  merch_order_id?: string
  prepay_id?: string
}

/** `biz_content` of the order query response. */
export interface TelebirrQueryResponseBiz {
  merch_order_id?: string
  order_status?: string
  payment_order_id?: string
  trans_time?: string
  trans_currency?: string
  total_amount?: string
  trans_id?: string
}

/** Normalized result of {@link TelebirrClient.queryOrder}. */
export interface TelebirrOrderStatus {
  merchOrderId: string
  /** e.g. `PAY_SUCCESS`. Only `PAY_SUCCESS` confirms payment. */
  orderStatus: string
  paymentOrderId: string | null
  transId: string | null
  amount: string | null
  currency: string | null
  transTime: string | null
}

interface FabricTokenResponse {
  token?: string
  effectiveDate?: string
  expirationDate?: string
  code?: string
  msg?: string
}

// ---------------------------------------------------------------------------
// Signing primitives (also used for webhook verification)
// ---------------------------------------------------------------------------

/**
 * Build the string-to-sign for a request/response body per the portal's
 * signature guide: exclude `sign`/`sign_type` (and other excluded fields),
 * flatten `biz_content` into the top level, sort keys alphabetically and
 * join `key=value` pairs with `&`.
 */
export function buildStringToSign(body: Record<string, unknown>): string {
  const fields = new Map<string, string>()
  collectSignFields(body, fields)

  const bizContent = body['biz_content']
  if (bizContent !== null && typeof bizContent === 'object' && !Array.isArray(bizContent)) {
    collectSignFields(bizContent as Record<string, unknown>, fields)
  }

  const parts: string[] = []
  for (const key of [...fields.keys()].sort()) {
    const value = fields.get(key)
    if (value !== undefined) parts.push(`${key}=${value}`)
  }
  return parts.join('&')
}

/**
 * Sign a string-to-sign with an RSA private key (PEM).
 *
 * @param padding `"pss"` (SHA256withRSAandMGF1, default) or `"pkcs1v15"` (SHA256WithRSA).
 * @throws {TelebirrError} If the key is invalid or signing fails.
 */
export function signPayload(
  text: string,
  privateKeyPem: string,
  padding: TelebirrSignaturePadding = 'pss',
): string {
  try {
    const signer = createSign('SHA256')
    signer.update(text)
    return signer.sign(signingKeyOptions(privateKeyPem, padding), 'base64')
  } catch (error) {
    throw new TelebirrError(
      `Failed to sign Telebirr payload: ${describeError(error)}`,
      'TELEBIRR_SIGN',
      false,
      error,
    )
  }
}

/**
 * Verify a payload signature with an RSA public key (PEM).
 * Returns `false` on any verification failure (including malformed keys).
 */
export function verifyPayload(
  text: string,
  signature: string,
  publicKeyPem: string,
  padding: TelebirrSignaturePadding = 'pss',
): boolean {
  try {
    const verifier = createVerify('SHA256')
    verifier.update(text)
    return verifier.verify(signingKeyOptions(publicKeyPem, padding), signature, 'base64')
  } catch {
    return false
  }
}

function signingKeyOptions(
  pem: string,
  padding: TelebirrSignaturePadding,
): {
  key: string
  padding?: number
  saltLength?: number
} {
  if (padding === 'pss') {
    return {
      key: pem,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }
  }
  return { key: pem }
}

function collectSignFields(source: Record<string, unknown>, into: Map<string, string>): void {
  for (const [key, value] of Object.entries(source)) {
    if (SIGN_EXCLUDED_FIELDS.has(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') {
      into.set(key, JSON.stringify(value))
      continue
    }
    into.set(key, String(value))
  }
}

// ---------------------------------------------------------------------------
// Request primitives (per the portal demo tools)
// ---------------------------------------------------------------------------

/** UTC timestamp in seconds, as a string. */
function createTimeStamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

/** Random alphanumeric nonce, 32 characters (`nonce_str` constraint). */
function createNonceStr(): string {
  const bytes = randomBytes(NONCE_LENGTH)
  let nonce = ''
  for (let i = 0; i < NONCE_LENGTH; i++) {
    nonce += NONCE_ALPHABET[(bytes[i] ?? 0) % NONCE_ALPHABET.length]
  }
  return nonce
}

/** Default merchant order id: epoch milliseconds (per the portal demo). */
function createMerchantOrderId(): string {
  return Date.now().toString()
}

/**
 * Parse a Telebirr `yyyyMMddHHmmss` timestamp (e.g. token expiration) as UTC.
 * Returns `null` when the value is absent or malformed.
 */
function parseTelebirrTimestamp(value: string | undefined): number | null {
  if (!value || !/^\d{14}$/.test(value)) return null
  const ms = Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
    Number(value.slice(8, 10)),
    Number(value.slice(10, 12)),
    Number(value.slice(12, 14)),
  )
  return Number.isNaN(ms) ? null : ms
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Telebirr H5 C2B Web Payment client.
 *
 * Instances are stateless apart from a cached fabric token; create them via
 * {@link createTelebirrClient} or {@link getTelebirrClient}.
 */
export class TelebirrClient {
  private tokenCache: { token: string; expiresAtMs: number } | null = null

  constructor(private readonly config: TelebirrConfig) {
    const requiredKeys = [
      'baseUrl',
      'fabricAppId',
      'appSecret',
      'merchantAppId',
      'merchantCode',
      'privateKey',
    ] as const
    const missing = requiredKeys.filter((key) => {
      const value: unknown = this.config[key]
      return typeof value !== 'string' || value.length === 0
    })
    if (missing.length > 0) {
      throw new TelebirrError(
        `Telebirr client is missing required configuration: ${missing.join(', ')}`,
        'TELEBIRR_CONFIG',
        false,
      )
    }
  }

  // -----------------------------------------------------------------------
  // Step 1: Apply Fabric Token
  // -----------------------------------------------------------------------

  /**
   * Obtain a fabric token, using the cached one while it is still valid
   * (tokens are issued for one hour; cached for at most 50 minutes).
   */
  async applyFabricToken(): Promise<string> {
    const cached = this.tokenCache
    if (cached && cached.expiresAtMs > Date.now()) return cached.token

    const response = await this.post<FabricTokenResponse>('/payment/v1/token', {
      appSecret: this.config.appSecret,
    })

    const token = response.token
    if (!token || token.length === 0) {
      throw new TelebirrError(
        `Fabric token request failed: code=${response.code ?? 'n/a'} msg=${response.msg ?? 'no message'}`,
        'TELEBIRR_TOKEN',
        false,
      )
    }

    this.tokenCache = { token, expiresAtMs: tokenExpiryMs(response.expirationDate) }
    return token
  }

  // -----------------------------------------------------------------------
  // Step 2: Request Create Order
  // -----------------------------------------------------------------------

  /**
   * Create a prepay order (`payment.preorder`).
   *
   * @returns The prepay id and echoed merchant order id.
   * @throws {TelebirrError} On configuration problems, transport failures,
   * business rejections (`result=FAIL`) or response signature mismatches.
   */
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const notifyUrl = params.notifyUrl ?? this.config.notifyUrl
    if (!notifyUrl) {
      throw new TelebirrError(
        'notify_url is required for Telebirr order creation – pass it via params or TELEBIRR_NOTIFY_URL',
        'TELEBIRR_CONFIG',
        false,
      )
    }

    const totalAmount = normalizeAmount(params.amount)
    const merchOrderId = params.merchOrderId ?? createMerchantOrderId()
    const tradeType = params.tradeType ?? this.config.tradeType ?? 'Checkout'
    const currency = (params.currency ?? this.config.currency ?? 'ETB').toUpperCase()
    const timeoutExpress = params.timeoutExpress ?? this.config.timeoutExpress ?? '120m'
    const redirectUrl = params.redirectUrl ?? this.config.redirectUrl

    const body: Record<string, unknown> = {
      timestamp: createTimeStamp(),
      nonce_str: createNonceStr(),
      method: 'payment.preorder',
      version: VERSION,
      biz_content: {
        notify_url: notifyUrl,
        appid: this.config.merchantAppId,
        merch_code: this.config.merchantCode,
        merch_order_id: merchOrderId,
        trade_type: tradeType,
        title: params.title,
        total_amount: totalAmount,
        trans_currency: currency,
        timeout_express: timeoutExpress,
        business_type: this.config.businessType ?? 'BuyGoods',
        ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
      },
    }
    body['sign'] = this.signBody(body)
    body['sign_type'] = SIGN_TYPE

    const token = await this.applyFabricToken()
    const response = await this.post<TelebirrApiResponse<TelebirrOrderResponseBiz>>(
      '/payment/v1/merchant/preOrder',
      body,
      token,
    )
    this.assertVerifiedResponse(response)

    if (response.result !== 'SUCCESS' || response.code !== '0') {
      throw new TelebirrError(
        `Telebirr preOrder failed: result=${response.result ?? 'n/a'} code=${response.code ?? 'n/a'} msg=${response.msg ?? 'no message'}`,
        'TELEBIRR_ORDER',
        false,
      )
    }

    const prepayId = response.biz_content?.prepay_id
    if (!prepayId) {
      throw new TelebirrError(
        'Telebirr preOrder response is missing biz_content.prepay_id',
        'TELEBIRR_ORDER',
        false,
      )
    }

    return { merchOrderId, prepayId, raw: response }
  }

  // -----------------------------------------------------------------------
  // Step 3: Generate Checkout Url
  // -----------------------------------------------------------------------

  /**
   * Assemble the web checkout URL for a prepay id: the payment parameters
   * plus a fresh signature are joined in ASCII order and appended to the
   * configured checkout base URL.
   *
   * @throws {TelebirrError} `TELEBIRR_CONFIG` when `checkoutBaseUrl` is not
   * configured (`TELEBIRR_CHECKOUT_BASE_URL`).
   */
  buildCheckoutUrl(prepayId: string): string {
    const checkoutBaseUrl = this.config.checkoutBaseUrl
    if (!checkoutBaseUrl) {
      throw new TelebirrError(
        'Telebirr checkoutBaseUrl is not configured (TELEBIRR_CHECKOUT_BASE_URL) – cannot assemble a checkout URL',
        'TELEBIRR_CONFIG',
        false,
      )
    }

    const nonceStr = createNonceStr()
    const timestamp = createTimeStamp()
    const map = {
      appid: this.config.merchantAppId,
      merch_code: this.config.merchantCode,
      nonce_str: nonceStr,
      prepay_id: prepayId,
      timestamp,
    }
    const sign = signPayload(buildStringToSign(map), this.config.privateKey, this.padding)

    const rawRequest = [
      `appid=${map.appid}`,
      `merch_code=${map.merch_code}`,
      `nonce_str=${map.nonce_str}`,
      `prepay_id=${map.prepay_id}`,
      `timestamp=${map.timestamp}`,
      `sign=${sign}`,
      `sign_type=${SIGN_TYPE}`,
    ].join('&')

    return `${checkoutBaseUrl}${checkoutBaseUrl.includes('?') ? '&' : '?'}${rawRequest}`
  }

  /**
   * Convenience: create an order and build its checkout URL in one call.
   * `checkoutUrl` is omitted when the checkout base URL is not configured.
   */
  async createCheckoutUrl(
    params: CreateOrderParams,
  ): Promise<CreateOrderResult & { checkoutUrl?: string }> {
    const order = await this.createOrder(params)

    let checkoutUrl: string | undefined
    try {
      checkoutUrl = this.buildCheckoutUrl(order.prepayId)
    } catch (error) {
      if (!(error instanceof TelebirrError && error.code === 'TELEBIRR_CONFIG')) throw error
    }

    return { ...order, ...(checkoutUrl ? { checkoutUrl } : {}) }
  }

  // -----------------------------------------------------------------------
  // Step 5: queryOrder
  // -----------------------------------------------------------------------

  /**
   * Query the payment status of an order (`payment.queryorder`), e.g. when
   * a payment notification did not arrive.
   *
   * @throws {TelebirrError} On configuration problems, transport failures,
   * business rejections or response signature mismatches.
   */
  async queryOrder(merchOrderId: string): Promise<TelebirrOrderStatus> {
    if (!merchOrderId || merchOrderId.length === 0) {
      throw new TelebirrError(
        'merchOrderId is required to query a Telebirr order',
        'TELEBIRR_QUERY',
        false,
      )
    }

    const body: Record<string, unknown> = {
      timestamp: createTimeStamp(),
      nonce_str: createNonceStr(),
      method: 'payment.queryorder',
      version: VERSION,
      biz_content: {
        appid: this.config.merchantAppId,
        merch_code: this.config.merchantCode,
        merch_order_id: merchOrderId,
      },
    }
    body['sign'] = this.signBody(body)
    body['sign_type'] = SIGN_TYPE

    const token = await this.applyFabricToken()
    const response = await this.post<TelebirrApiResponse<TelebirrQueryResponseBiz>>(
      '/payment/v1/merchant/orderQuery',
      body,
      token,
    )
    this.assertVerifiedResponse(response)

    if (response.result !== 'SUCCESS' || response.code !== '0') {
      throw new TelebirrError(
        `Telebirr order query failed: result=${response.result ?? 'n/a'} code=${response.code ?? 'n/a'} msg=${response.msg ?? 'no message'}`,
        'TELEBIRR_QUERY',
        false,
      )
    }

    const biz = response.biz_content ?? {}
    return {
      merchOrderId: biz.merch_order_id ?? merchOrderId,
      orderStatus: biz.order_status ?? 'UNKNOWN',
      paymentOrderId: biz.payment_order_id ?? null,
      transId: biz.trans_id ?? null,
      amount: biz.total_amount ?? null,
      currency: biz.trans_currency ?? null,
      transTime: biz.trans_time ?? null,
    }
  }

  // -----------------------------------------------------------------------
  // Signature verification (responses & payment notifications)
  // -----------------------------------------------------------------------

  /**
   * Verify the signature of a Telebirr payment notification / callback body.
   * The body must carry `sign` (and optionally `sign_type`); the string-to-sign
   * is rebuilt from the remaining fields and verified with the platform key.
   *
   * @throws {TelebirrError} `TELEBIRR_CONFIG` when no platform public key is configured.
   */
  verifyCallback(payload: Record<string, unknown>): boolean {
    const publicKey = this.requirePublicKey()
    const sign = payload['sign']
    if (typeof sign !== 'string' || sign.length === 0) return false
    return verifyPayload(buildStringToSign(payload), sign, publicKey, this.padding)
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private get padding(): TelebirrSignaturePadding {
    return this.config.signaturePadding ?? 'pss'
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private requirePublicKey(): string {
    const publicKey = this.config.publicKey
    if (!publicKey) {
      throw new TelebirrError(
        'Telebirr platform public key is not configured (TELEBIRR_PUBLIC_KEY) – cannot verify platform signatures',
        'TELEBIRR_CONFIG',
        false,
      )
    }
    return publicKey
  }

  private signBody(body: Record<string, unknown>): string {
    return signPayload(buildStringToSign(body), this.config.privateKey, this.padding)
  }

  /**
   * Verify the `sign` of a gateway response when a platform public key is
   * configured; verification is skipped otherwise (opt-in).
   */
  private assertVerifiedResponse<B extends object>(response: TelebirrApiResponse<B>): void {
    if (!this.config.publicKey) return

    const sign = response.sign
    if (typeof sign !== 'string' || sign.length === 0) {
      throw new TelebirrError(
        'Telebirr response is missing its signature while signature verification is enabled',
        'TELEBIRR_VERIFY',
        false,
      )
    }

    const valid = verifyPayload(
      buildStringToSign(response as unknown as Record<string, unknown>),
      sign,
      this.config.publicKey,
      this.padding,
    )
    if (!valid) {
      throw new TelebirrError(
        'Telebirr response signature verification failed',
        'TELEBIRR_VERIFY',
        false,
      )
    }
  }

  private async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    try {
      return await fetchJson<T>(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'X-APP-Key': this.config.fabricAppId,
          ...(token ? { Authorization: token } : {}),
        },
        body,
        timeoutMs: this.timeoutMs,
      })
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        // 404 from the gateway means a wrong path/merchant setup – not transient.
        throw new TelebirrError(
          `Telebirr endpoint not found (${path}): HTTP 404`,
          'TELEBIRR_HTTP',
          false,
          error,
        )
      }
      throw new TelebirrError(
        `Telebirr request to ${path} failed: ${describeError(error)}`,
        'TELEBIRR_HTTP',
        isRetryableHttpError(error),
        error,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAmount(amount: string | number): string {
  const normalized = typeof amount === 'number' ? amount.toFixed(2) : amount.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new TelebirrError(
      `Invalid Telebirr total_amount "${normalized}" – expected a positive amount with at most 2 decimals`,
      'TELEBIRR_ORDER',
      false,
    )
  }
  return normalized
}

function tokenExpiryMs(expirationDate: string | undefined): number {
  const fallback = Date.now() + TOKEN_MAX_TTL_MS
  const parsed = parseTelebirrTimestamp(expirationDate)
  if (parsed === null) return fallback

  const withSkew = parsed - TOKEN_EXPIRY_SKEW_MS
  // A parsed expiration in the past for a freshly issued token indicates a
  // clock/timezone mismatch – fall back to the conservative TTL.
  if (withSkew <= Date.now()) return fallback
  return Math.min(withSkew, fallback)
}

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

const TRADE_TYPES: readonly TelebirrTradeType[] = [
  'InApp',
  'Cross-App',
  'Checkout',
  'PWA',
  'QrCode',
  'QuickPay',
  'BankTrade',
]

function parseTradeType(value: string | undefined): TelebirrTradeType | undefined {
  if (!value) return undefined
  if (!(TRADE_TYPES as readonly string[]).includes(value)) {
    throw new TelebirrError(
      `Invalid TELEBIRR_TRADE_TYPE "${value}" – expected one of: ${TRADE_TYPES.join(', ')}`,
      'TELEBIRR_CONFIG',
      false,
    )
  }
  return value as TelebirrTradeType
}

function parseSignaturePadding(value: string | undefined): TelebirrSignaturePadding | undefined {
  if (!value) return undefined
  if (value !== 'pss' && value !== 'pkcs1v15') {
    throw new TelebirrError(
      `Invalid TELEBIRR_SIGNATURE_PADDING "${value}" – expected "pss" or "pkcs1v15"`,
      'TELEBIRR_CONFIG',
      false,
    )
  }
  return value
}

/**
 * Load a PEM key from an inline env var (supports literal `\n` escapes) or
 * from a file path env var. Returns `null` when neither is set.
 */
function loadPem(inlineKey: string, pathKey: string): string | null {
  const inline = optionalEnv(inlineKey)
  if (inline) return inline.replace(/\\n/g, '\n').trim()

  const path = optionalEnv(pathKey)
  if (!path) return null
  try {
    return readFileSync(path, 'utf8').trim()
  } catch (error) {
    throw new TelebirrError(
      `Failed to read ${inlineKey} from ${pathKey}=${path}: ${describeError(error)}`,
      'TELEBIRR_CONFIG',
      false,
      error,
    )
  }
}

/**
 * Read the Telebirr configuration from the environment.
 * Returns `null` when any required variable is missing.
 *
 * @throws {TelebirrError} On present-but-invalid optional values.
 */
export function getTelebirrConfigFromEnv(): TelebirrConfig | null {
  const fabricAppId = optionalEnv('TELEBIRR_FABRIC_APP_ID')
  const appSecret = optionalEnv('TELEBIRR_APP_SECRET')
  const merchantAppId = optionalEnv('TELEBIRR_MERCHANT_APP_ID')
  const merchantCode = optionalEnv('TELEBIRR_MERCHANT_CODE')
  const privateKey = loadPem('TELEBIRR_PRIVATE_KEY', 'TELEBIRR_PRIVATE_KEY_PATH')
  if (!fabricAppId || !appSecret || !merchantAppId || !merchantCode || !privateKey) {
    return null
  }

  const publicKey = loadPem('TELEBIRR_PUBLIC_KEY', 'TELEBIRR_PUBLIC_KEY_PATH')
  const tradeType = parseTradeType(optionalEnv('TELEBIRR_TRADE_TYPE'))
  const signaturePadding = parseSignaturePadding(optionalEnv('TELEBIRR_SIGNATURE_PADDING'))
  const notifyUrl = optionalEnv('TELEBIRR_NOTIFY_URL')
  const redirectUrl = optionalEnv('TELEBIRR_REDIRECT_URL')
  const checkoutBaseUrl = optionalEnv('TELEBIRR_CHECKOUT_BASE_URL')
  const currency = optionalEnv('TELEBIRR_CURRENCY')
  const timeoutExpress = optionalEnv('TELEBIRR_TIMEOUT_EXPRESS')
  const businessType = optionalEnv('TELEBIRR_BUSINESS_TYPE')

  return {
    baseUrl: optionalEnv('TELEBIRR_BASE_URL') ?? TELEBIRR_TESTBED_BASE_URL,
    fabricAppId,
    appSecret,
    merchantAppId,
    merchantCode,
    privateKey,
    ...(publicKey ? { publicKey } : {}),
    ...(notifyUrl ? { notifyUrl } : {}),
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(checkoutBaseUrl ? { checkoutBaseUrl } : {}),
    ...(tradeType ? { tradeType } : {}),
    ...(currency ? { currency } : {}),
    ...(timeoutExpress ? { timeoutExpress } : {}),
    ...(businessType ? { businessType } : {}),
    ...(signaturePadding ? { signaturePadding } : {}),
    timeoutMs: envNumber('TELEBIRR_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
  }
}

/**
 * Load only the Telebirr platform public key used for signature verification
 * (webhook workers do not need the full merchant configuration).
 */
export function getTelebirrVerificationKey(): string | null {
  return loadPem('TELEBIRR_PUBLIC_KEY', 'TELEBIRR_PUBLIC_KEY_PATH')
}

/**
 * Signature padding from the environment (default `"pss"`), so webhook
 * verification uses the same algorithm as the merchant's requests.
 */
export function getTelebirrSignaturePadding(): TelebirrSignaturePadding {
  return parseSignaturePadding(optionalEnv('TELEBIRR_SIGNATURE_PADDING')) ?? 'pss'
}

const clientCache = new Map<string, TelebirrClient>()

/** Create a client from an explicit configuration. */
export function createTelebirrClient(config: TelebirrConfig): TelebirrClient {
  return new TelebirrClient(config)
}

/**
 * Get a client from the environment configuration (cached per config).
 *
 * @throws {TelebirrError} `TELEBIRR_CONFIG` when required variables are missing.
 */
export function getTelebirrClient(): TelebirrClient {
  const config = getTelebirrConfigFromEnv()
  if (!config) {
    throw new TelebirrError(
      'Telebirr is not configured – set TELEBIRR_FABRIC_APP_ID, TELEBIRR_APP_SECRET, ' +
        'TELEBIRR_MERCHANT_APP_ID, TELEBIRR_MERCHANT_CODE and TELEBIRR_PRIVATE_KEY ' +
        '(or TELEBIRR_PRIVATE_KEY_PATH)',
      'TELEBIRR_CONFIG',
      false,
    )
  }

  const cacheKey = JSON.stringify(config)
  const cached = clientCache.get(cacheKey)
  if (cached) return cached

  const client = new TelebirrClient(config)
  clientCache.set(cacheKey, client)
  return client
}
