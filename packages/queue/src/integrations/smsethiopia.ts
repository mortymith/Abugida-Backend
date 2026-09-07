/**
 * @module integrations/smsethiopia
 * @description Client for the SMSEthiopia SMS API (send + message status).
 *
 * Uses API v2 by default (`/api/v2/sms/send`, real ULID message ids,
 * segment counts, status lookup). API v1 remains available via
 * `apiVersion: "v1"` – same authentication (`KEY` header) and request body,
 * but the response `id` is a number (always `0`) and status lookup is not
 * available.
 *
 * Configuration is read from the environment by {@link getSMSEthiopiaClient}:
 *
 * | Variable | Description |
 * | --- | --- |
 * | `SMS_ETHIOPIA_API_KEY` | API key sent as the `KEY` header (required) |
 * | `SMS_ETHIOPIA_BASE_URL` | API base URL (default: `https://smsethiopia.com`) |
 * | `SMS_ETHIOPIA_API_VERSION` | `v2` (default) or `v1` |
 * | `SMS_ETHIOPIA_MESSAGE_TYPE` | Default `messageType` for sends |
 * | `SMS_ETHIOPIA_TIMEOUT_MS` | HTTP timeout (default: `15000`) |
 *
 * Retry behaviour is delegated to the queue (notification jobs retry with
 * exponential backoff), so the client itself does not retry; it classifies
 * failures via {@link SMSEthiopiaError.retryable}.
 */

import { envNumber } from '../config/env.js'
import { IntegrationError, describeError } from './errors.js'
import { fetchJson, HttpError, isRetryableHttpError } from './http.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default API base URL. */
export const SMSETHIOPIA_DEFAULTS = {
  baseUrl: 'https://smsethiopia.com',
  apiVersion: 'v2' as const,
  timeoutMs: 15_000,
} as const

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SMSEthiopiaErrorCode =
  'SMS_CONFIG' | 'SMS_HTTP' | 'SMS_REJECTED' | 'SMS_NOT_FOUND' | 'SMS_UNSUPPORTED'

/** Error raised by the SMSEthiopia client. */
export class SMSEthiopiaError extends IntegrationError {
  constructor(message: string, code: SMSEthiopiaErrorCode, retryable: boolean, cause?: unknown) {
    super(message, code, retryable, cause)
    this.name = 'SMSEthiopiaError'
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmsApiVersion = 'v1' | 'v2'

/**
 * Message status lifecycle (`ACCEPTED` → `SENT` → `DELIVERED`), extended
 * with the failure states used by delivery reports.
 */
export type SmsMessageStatus = 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'

export interface SMSEthiopiaConfig {
  /** API key, sent as the `KEY` header. */
  apiKey: string
  /** API base URL. Default: `https://smsethiopia.com`. */
  baseUrl: string
  /** API version. Default: `"v2"`. */
  apiVersion: SmsApiVersion
  /** Default `messageType` applied to sends that do not specify one. */
  messageType?: string
  /** HTTP timeout in ms. Default: `15000`. */
  timeoutMs: number
}

/** Parameters for sending an SMS. */
export interface SmsSendParams {
  /** Recipient MSISDN (international format, e.g. `251912345678`). */
  msisdn: string
  /** Message body. */
  text: string
  /** Optional message type override. */
  messageType?: string
}

export interface SmsSendResult {
  /** Message id – a real ULID string on v2, `"0"` on v1. Store for status lookup. */
  id: string
  /** SMS segments used (v2 only; `null` on v1). */
  segments: number | null
  /** Initial message state (`ACCEPTED`). */
  status: SmsMessageStatus
}

export interface SmsDeliveryStatus {
  /** Message id that was looked up. */
  id: string
  /** Current delivery status. */
  status: SmsMessageStatus
  /** Segment count when reported. */
  segments: number | null
  /** Raw status record for forward compatibility. */
  raw: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// MSISDN helpers
// ---------------------------------------------------------------------------

const MSISDN_PATTERN = /^\+?[1-9]\d{6,14}$/

/** Whether a value looks like a valid MSISDN (E.164-ish, 7–15 digits). */
export function isValidMsisdn(value: string): boolean {
  return MSISDN_PATTERN.test(value.trim())
}

/**
 * Normalize a phone number into bare international digits (no leading `+`):
 * separators are stripped and common Ethiopian local formats
 * (`09XXXXXXXX`) are converted to `251XXXXXXXXX`. Returns `null` when the
 * value cannot be a valid MSISDN.
 */
export function normalizeMsisdn(value: string): string | null {
  const digits = value.replace(/[\s\-().]/g, '').trim()
  const withoutPlus = digits.startsWith('+') ? digits.slice(1) : digits
  // Ethiopian local mobile format: 0XXXXXXXXX → 251XXXXXXXXX
  const international = /^0\d{9}$/.test(withoutPlus) ? `251${withoutPlus.slice(1)}` : withoutPlus
  return MSISDN_PATTERN.test(international) ? international : null
}

/**
 * Normalize a status string into the closed {@link SmsMessageStatus} set.
 * Unknown values (future provider states) map to `UNKNOWN`.
 */
export function normalizeSmsStatus(value: string): SmsMessageStatus {
  const upper = value.trim().toUpperCase()
  const known: readonly string[] = ['ACCEPTED', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED']
  return (known.includes(upper) ? upper : 'UNKNOWN') as SmsMessageStatus
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** SMSEthiopia SMS API client. */
export class SMSEthiopiaClient {
  constructor(private readonly config: SMSEthiopiaConfig) {
    if (!config.apiKey || config.apiKey.length === 0) {
      throw new SMSEthiopiaError(
        'SMSEthiopia client requires an apiKey (SMS_ETHIOPIA_API_KEY)',
        'SMS_CONFIG',
        false,
      )
    }
    if (config.apiVersion !== 'v1' && config.apiVersion !== 'v2') {
      throw new SMSEthiopiaError(
        `Invalid SMSEthiopia apiVersion "${String(config.apiVersion)}" – expected "v1" or "v2"`,
        'SMS_CONFIG',
        false,
      )
    }
  }

  /**
   * Send an SMS.
   *
   * @returns The accepted message id, segment count and initial status.
   * @throws {SMSEthiopiaError} `SMS_REJECTED` for invalid input or provider
   * rejections (4xx), `SMS_HTTP` for transport failures/5xx (retryable).
   */
  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const msisdn = params.msisdn.trim()
    if (!isValidMsisdn(msisdn)) {
      throw new SMSEthiopiaError(
        `SMSEthiopia send rejected an invalid msisdn (${msisdn.length} chars)`,
        'SMS_REJECTED',
        false,
      )
    }
    if (params.text.length === 0) {
      throw new SMSEthiopiaError(
        'SMSEthiopia send requires a non-empty text',
        'SMS_REJECTED',
        false,
      )
    }

    const messageType = params.messageType ?? this.config.messageType
    const body = {
      msisdn,
      text: params.text,
      ...(messageType ? { messageType } : {}),
    }

    const path = this.config.apiVersion === 'v1' ? '/api/sms/send' : '/api/v2/sms/send'
    const response = await this.request<Record<string, unknown>>('POST', path, body)

    const id = response['id']
    if (this.config.apiVersion === 'v1') {
      if (typeof id !== 'number') {
        throw new SMSEthiopiaError(
          'SMSEthiopia v1 send response is missing its numeric id',
          'SMS_REJECTED',
          false,
        )
      }
      return { id: String(id), segments: null, status: 'ACCEPTED' }
    }

    if (typeof id !== 'string' || id.length === 0) {
      throw new SMSEthiopiaError(
        'SMSEthiopia v2 send response is missing its message id',
        'SMS_REJECTED',
        false,
      )
    }

    return {
      id,
      segments: typeof response['segments'] === 'number' ? response['segments'] : null,
      status: normalizeSmsStatus(
        typeof response['status'] === 'string' ? response['status'] : 'ACCEPTED',
      ),
    }
  }

  /**
   * Look up the delivery status of a previously sent message (v2 API only).
   *
   * @throws {SMSEthiopiaError} `SMS_UNSUPPORTED` on v1, `SMS_NOT_FOUND` for
   * unknown/foreign ids, `SMS_HTTP` for transport failures/5xx (retryable).
   */
  async getStatus(messageId: string): Promise<SmsDeliveryStatus> {
    if (this.config.apiVersion !== 'v2') {
      throw new SMSEthiopiaError(
        'SMSEthiopia status lookup requires the v2 API – set apiVersion to "v2"',
        'SMS_UNSUPPORTED',
        false,
      )
    }

    const path = `/api/v2/sms/${encodeURIComponent(messageId.trim())}`
    const response = await this.request<Record<string, unknown>>('GET', path)

    const rawStatus = response['status']
    return {
      id: typeof response['id'] === 'string' ? response['id'] : messageId.trim(),
      status: normalizeSmsStatus(typeof rawStatus === 'string' ? rawStatus : 'UNKNOWN'),
      segments: typeof response['segments'] === 'number' ? response['segments'] : null,
      raw: response,
    }
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    try {
      return await fetchJson<T>(`${this.config.baseUrl}${path}`, {
        method,
        headers: { KEY: this.config.apiKey },
        ...(body === undefined ? {} : { body }),
        timeoutMs: this.config.timeoutMs,
      })
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        // The API never confirms foreign ids – 404 means unknown message.
        throw new SMSEthiopiaError(
          `SMSEthiopia message not found: ${path}`,
          'SMS_NOT_FOUND',
          false,
          error,
        )
      }
      throw new SMSEthiopiaError(
        `SMSEthiopia request to ${path} failed: ${describeError(error)}`,
        'SMS_HTTP',
        isRetryableHttpError(error),
        error,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Environment configuration & factory
// ---------------------------------------------------------------------------

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

/**
 * Read the SMSEthiopia configuration from the environment.
 * Returns `null` when `SMS_ETHIOPIA_API_KEY` is not set.
 *
 * @throws {SMSEthiopiaError} On an invalid `SMS_ETHIOPIA_API_VERSION`.
 */
export function getSMSEthiopiaConfigFromEnv(): SMSEthiopiaConfig | null {
  const apiKey = optionalEnv('SMS_ETHIOPIA_API_KEY')
  if (!apiKey) return null

  const versionRaw = optionalEnv('SMS_ETHIOPIA_API_VERSION')
  if (versionRaw && versionRaw !== 'v1' && versionRaw !== 'v2') {
    throw new SMSEthiopiaError(
      `Invalid SMS_ETHIOPIA_API_VERSION "${versionRaw}" – expected "v1" or "v2"`,
      'SMS_CONFIG',
      false,
    )
  }

  const messageType = optionalEnv('SMS_ETHIOPIA_MESSAGE_TYPE')

  return {
    apiKey,
    baseUrl: optionalEnv('SMS_ETHIOPIA_BASE_URL') ?? SMSETHIOPIA_DEFAULTS.baseUrl,
    apiVersion: versionRaw === 'v1' ? 'v1' : SMSETHIOPIA_DEFAULTS.apiVersion,
    ...(messageType ? { messageType } : {}),
    timeoutMs: envNumber('SMS_ETHIOPIA_TIMEOUT_MS', SMSETHIOPIA_DEFAULTS.timeoutMs),
  }
}

const clientCache = new Map<string, SMSEthiopiaClient>()

/** Create a client from an explicit configuration. */
export function createSMSEthiopiaClient(config: SMSEthiopiaConfig): SMSEthiopiaClient {
  return new SMSEthiopiaClient(config)
}

/**
 * Get a client from the environment configuration (cached per config).
 *
 * @throws {SMSEthiopiaError} `SMS_CONFIG` when `SMS_ETHIOPIA_API_KEY` is missing.
 */
export function getSMSEthiopiaClient(): SMSEthiopiaClient {
  const config = getSMSEthiopiaConfigFromEnv()
  if (!config) {
    throw new SMSEthiopiaError(
      'SMSEthiopia is not configured – set SMS_ETHIOPIA_API_KEY (and optionally SMS_ETHIOPIA_BASE_URL / SMS_ETHIOPIA_API_VERSION)',
      'SMS_CONFIG',
      false,
    )
  }

  const cacheKey = JSON.stringify(config)
  const cached = clientCache.get(cacheKey)
  if (cached) return cached

  const client = new SMSEthiopiaClient(config)
  clientCache.set(cacheKey, client)
  return client
}
