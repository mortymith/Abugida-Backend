/**
 * @module request-id
 *
 * Request correlation middleware. The API spec requires `X-Request-ID` to be
 * echoed on responses (and as `meta.requestId` / error `correlationId`), and
 * the documented format is UUID v7. This middleware:
 *
 *   - trusts a client-supplied `X-Request-ID` when it is well-formed,
 *   - otherwise generates a UUID v7,
 *   - stores it on the Hono context (`c.get("requestId")`),
 *   - sets it on the response `X-Request-ID` header.
 *
 * It runs before every other middleware so the observability layer can attach
 * the id to spans and access logs.
 */

import type { MiddlewareHandler } from 'hono'
import { requestId } from 'hono/request-id'
import type { AppEnv } from './types'

/**
 * Generate a UUID v7 (time-ordered, RFC 9562) from the current Unix
 * millisecond timestamp plus cryptographically random bits. No dependency —
 * built on the platform `crypto.getRandomValues`.
 */
export function uuidv7(): string {
  const now = BigInt(Date.now())
  const random = crypto.getRandomValues(new Uint8Array(10))

  const bytes = new Uint8Array(16)
  bytes[0] = Number((now >> 40n) & 0xffn)
  bytes[1] = Number((now >> 32n) & 0xffn)
  bytes[2] = Number((now >> 24n) & 0xffn)
  bytes[3] = Number((now >> 16n) & 0xffn)
  bytes[4] = Number((now >> 8n) & 0xffn)
  bytes[5] = Number(now & 0xffn)
  // version 7 in the high nibble of byte 6
  bytes[6] = 0x70 | (random[0]! & 0x0f)
  bytes[7] = random[1]!
  // variant 10xx (RFC 4122) in the high bits of byte 8
  bytes[8] = 0x80 | (random[2]! & 0x3f)
  bytes[9] = random[3]!
  bytes[10] = random[4]!
  bytes[11] = random[5]!
  bytes[12] = random[6]!
  bytes[13] = random[7]!
  bytes[14] = random[8]!
  bytes[15] = random[9]!

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Create the global request-id middleware. Uses Hono's built-in `requestId`
 * with a UUID v7 generator and the spec's header name.
 */
export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return requestId({
    headerName: 'X-Request-ID',
    generator: () => uuidv7(),
  })
}
